import type { ParsedImport } from "./types";
import { toISODate } from "./parser-functions";

/**
 * Crédit Agricole PEA / CTO CSV parser — ported from v1 tui/helpers/parser-ca-csv.js .
 *
 * Header shape (first ~5 lines):
 *   line 0: "Portefeuille au"
 *   line 1: ends with the report date (DD/MM/YYYY)
 *   line 2: "<contract_code>,<label> (COMPTE PEA|CTO) <LASTNAME> <FIRSTNAME>"
 *   lines 3..4: column headers
 *   lines 5..n-1: data rows, semi-colon separated, with quoted cells,
 *                 commas inside quoted cells are thousand separators (→ replaced by dots)
 *   last line: empty / trailing newline
 */
export async function parseCreditAgricoleCSV(content: string): Promise<ParsedImport> {
  const rawLines = content.split(/\r?\n/);

  // Trust v1's layout: headers on lines 0-4, trailer on last line.
  let lines = rawLines.slice(5).slice(0, -1);

  const headerRow = rawLines[2] ?? "";
  const headerCells = headerRow.split(",");
  const nameCell = headerCells[headerCells.length - 1] ?? "";
  const stripped = nameCell.replace(" (COMPTE PEA)", "").replace(" (COMPTE CTO)", "");
  const [lastname, firstname] = stripped.split(" ");

  const contract_code = (headerCells[0] ?? "").split(" ").pop() ?? "";
  const dateStr = (rawLines[1] ?? "").split(" ").pop() ?? "";
  const isoDate = toISODate(dateStr);

  const type = nameCell.split(" ").pop() ?? "";
  const isPEA = type === "(COMPTE PEA)";
  const product = {
    code: isPEA ? "CA-PEA" : "CA-CTO",
    name: (isPEA ? "PEA" : "CTO") + " (CREDIT AGRICOLE)",
  };

  // Normalize commas inside quoted values → dots (thousand separator → decimal)
  // Then split each line by ; and strip quotes / leading single quotes / spaces.
  lines = lines.map((l) =>
    l.replace(/"([^"]*)"/g, (_, content: string) => `"${content.replace(/,/g, ".")}"`)
  );

  const rows = lines.map((l) =>
    l
      .split(";")
      .map((v) =>
        v
          .replace(/^"+|"+$/g, "")
          .replace(/^'/, "")
          .trim()
      )
      .filter((v) => v !== "")
  );

  const account = {
    firstname: (firstname ?? "").trim(),
    lastname: (lastname ?? "").trim(),
    contracts: [] as ParsedImport["accounts"][number]["contracts"],
  };

  const contract = {
    contract_code,
    product_code: product.code,
    name: product.name,
    date: isoDate,
    allocation: [] as ParsedImport["accounts"][number]["contracts"][number]["allocation"],
  };

  for (const row of rows) {
    const [name, isin, quantity, value, total] = row;
    if (!name || !isin) continue;
    contract.allocation.push({
      code: isin,
      name,
      date: isoDate,
      value: parseFloat((value ?? "0").replace(" €", "")),
      quantity: parseFloat((quantity ?? "0").replace(" ", "")),
      total: parseFloat((total ?? "0").replace(" €", "")),
      latest: true,
    });
  }

  account.contracts.push(contract);

  return { accounts: [account], data: { rawProducts: [product] } };
}
