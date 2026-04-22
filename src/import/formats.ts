import type { ImportFormat, Parser } from "./types";
import { parseCreditAgricoleCSV } from "./parser-ca-csv";

/**
 * The client never actually calls `format.parser` — parsing happens
 * server-side via the `/api/import/parse` endpoint. The field is only
 * used as a "is this format ready?" sentinel for the UI dropdown. For
 * text formats ported from v1 we still ship the client implementation
 * (CA-CSV) in case we ever want to parse locally; for server-only
 * formats (PRGST, PDF), we use this no-op sentinel instead of null so
 * the UI treats them as available.
 */
const SERVER_PARSED: Parser = async () => {
  throw new Error("This format is parsed on the server — call /api/import/parse.");
};

/**
 * Catalogue of known export formats.
 * Add new parsers by implementing one matching the Parser signature
 * and listing it here. `parser: null` marks a format as "known but not
 * yet ported from v1".
 */
export const IMPORT_FORMATS: ImportFormat[] = [
  {
    id: "ca-pea",
    label: "Crédit Agricole — PEA (CSV)",
    issuer: "Crédit Agricole",
    accept: ".csv,text/csv",
    parser: parseCreditAgricoleCSV,
    insurerName: "CREDIT AGRICOLE",
  },
  {
    id: "ca-cto",
    label: "Crédit Agricole — CTO (CSV)",
    issuer: "Crédit Agricole",
    accept: ".csv,text/csv",
    parser: parseCreditAgricoleCSV,
    insurerName: "CREDIT AGRICOLE",
  },

  // ---- Not yet ported from v1 — wire in incrementally --------------------
  // Cardif & CNP PRGST share the same generic parsePrgst — the only
  // difference is which insurer the data ends up under.
  { id: "cardif-prgst", label: "Cardif — PRGST (.txt)", issuer: "Cardif", accept: ".txt", parser: SERVER_PARSED, insurerName: "Cardif" },
  // PRGST is plain text — parsed server-side like CSVs (no `binary` flag).
  { id: "cnp-prgst", label: "CNP — PRGST (.txt)", issuer: "CNP", accept: ".txt", parser: SERVER_PARSED, insurerName: "CNP" },
  { id: "cardif-elite-pdf", label: "Cardif — Elite (PDF)", issuer: "Cardif", accept: ".pdf,application/pdf", parser: null, binary: true, insurerName: "Cardif" },
  { id: "cardif-elite-retraite-pdf", label: "Cardif — Elite Retraite (PDF)", issuer: "Cardif", accept: ".pdf,application/pdf", parser: null, binary: true, insurerName: "Cardif" },
  { id: "alizes-vie-pdf", label: "CNP — Alizes Vie (PDF)", issuer: "CNP", accept: ".pdf,application/pdf", parser: null, binary: true, insurerName: "CNP" },
  { id: "alizes-capi-pdf", label: "CNP — Alizes Capi (PDF)", issuer: "CNP", accept: ".pdf,application/pdf", parser: null, binary: true, insurerName: "CNP" },
  { id: "vie-plus-impact-pdf", label: "Suravenir — Vie Plus Impact (PDF)", issuer: "Suravenir", accept: ".pdf,application/pdf", parser: null, binary: true, insurerName: "Suravenir" },
  { id: "pertinence-retraite-pdf", label: "Suravenir — Pertinence Retraite (PDF)", issuer: "Suravenir", accept: ".pdf,application/pdf", parser: null, binary: true, insurerName: "Suravenir" },
];

export function findFormat(id: string): ImportFormat | undefined {
  return IMPORT_FORMATS.find((f) => f.id === id);
}
