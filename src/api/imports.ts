import { api } from "./client";
import type { ParsedImport } from "@/import/types";
import type { ImportSummary, PreviewResult } from "@/import/types-preview";

export async function parseFile(formatId: string, content: string): Promise<ParsedImport> {
  return api.post<ParsedImport>("/api/import/parse", { formatId, content });
}

export async function previewImport(
  formatId: string,
  parsed: ParsedImport
): Promise<PreviewResult> {
  return api.post<PreviewResult>("/api/import/preview", { formatId, parsed });
}

export async function commitImportApi(
  formatId: string,
  parsed: ParsedImport
): Promise<ImportSummary> {
  return api.post<ImportSummary>("/api/import/commit", { formatId, parsed });
}
