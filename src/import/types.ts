// Normalized shape produced by every parser — mirrors v1's common output.
// Keeping this uniform across formats lets the orchestrator stay format-agnostic.

export interface ParsedAllocation {
  code: string; // ISIN / ticker
  name: string;
  date: string; // ISO YYYY-MM-DD
  value: number; // unit value
  quantity: number;
  total?: number; // optional — computed from value × quantity when missing
  latest: boolean;
}

export interface ParsedContract {
  contract_code: string;
  product_code: string;
  name: string;
  date: string; // ISO
  allocation: ParsedAllocation[];
}

export interface ParsedAccount {
  firstname: string;
  lastname: string;
  account_code?: string;
  contracts: ParsedContract[];
}

export interface ParsedProduct {
  code: string;
  name: string;
}

export interface ParsedImport {
  accounts: ParsedAccount[];
  data: {
    rawProducts: ParsedProduct[];
  };
}

/** Each parser is an async function file contents → ParsedImport. */
export type Parser = (fileContent: string) => Promise<ParsedImport>;

/** Catalog entry describing one format we know how to parse. */
export interface ImportFormat {
  id: string;
  label: string;
  /** Insurer or bank that issues this export — displayed in the UI. */
  issuer: string;
  /** What kind of file the user should pick (accept attribute). */
  accept: string;
  /**
   * Client-side parser. `null` means either:
   *   - the format isn't ported yet (when `binary` is also false/unset)
   *   - or parsing happens server-side (when `binary: true`)
   *
   * Binary formats (PDFs) are always parsed server-side because the
   * PDF libraries are Node-only. The UI ships the raw bytes as base64.
   */
  parser: Parser | null;
  /** True for binary files (PDFs) — client sends base64, server decodes. */
  binary?: boolean;
  /** Strapi insurer name to match/create against when committing. */
  insurerName: string;
}
