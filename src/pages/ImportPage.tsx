import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Button,
  Flash,
  FormControl,
  Heading,
  Label,
  Select,
  Spinner,
  Text,
} from "@primer/react";
import { DataTable, Table } from "@primer/react/experimental";
import { UploadIcon, ZapIcon } from "@primer/octicons-react";
import { IMPORT_FORMATS, findFormat } from "@/import/formats";
import {
  commitImportApi,
  parseFile,
  previewImport,
} from "@/api/imports";
import type { ParsedImport } from "@/import/types";
import type { PreviewResult } from "@/import/types-preview";
import { formatEuro, formatNumber } from "@/lib/format";
import { StrapiError } from "@/api/client";

export function ImportPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formatId, setFormatId] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const format = formatId ? findFormat(formatId) : undefined;

  // 1) Parse — send raw file content to the backend, get normalized shape.
  const parseMutation = useMutation({
    mutationFn: (args: { formatId: string; content: string }) =>
      parseFile(args.formatId, args.content),
  });

  // 2) Preview — send normalized shape back, get match analysis.
  const previewMutation = useMutation({
    mutationFn: (args: { formatId: string; parsed: ParsedImport }) =>
      previewImport(args.formatId, args.parsed),
  });

  // 3) Commit — transactional server-side import.
  const commitMutation = useMutation({
    mutationFn: (args: { formatId: string; parsed: ParsedImport }) =>
      commitImportApi(args.formatId, args.parsed),
  });

  async function onFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !format) return;

    setFileName(file.name);
    setParsed(null);
    setPreview(null);
    setError(null);
    setSuccess(false);

    try {
      // Binary formats (PDFs) → send base64 so the server can rebuild
      // the raw bytes. Text formats (CSVs) → send the UTF-8 string as-is.
      let content: string;
      if (format.binary) {
        const buf = await file.arrayBuffer();
        content = arrayBufferToBase64(buf);
      } else {
        content = await file.text();
      }
      const p = await parseMutation.mutateAsync({ formatId: format.id, content });
      setParsed(p);

      const pr = await previewMutation.mutateAsync({
        formatId: format.id,
        parsed: p,
      });
      setPreview(pr);
    } catch (err) {
      setError(
        err instanceof StrapiError
          ? err.message
          : (err as Error).message || "Failed to load the file."
      );
    }
  }

  async function onCommit() {
    if (!parsed || !format) return;
    setError(null);
    setSuccess(false);
    try {
      const s = await commitMutation.mutateAsync({
        formatId: format.id,
        parsed,
      });
      await queryClient.invalidateQueries();
      // Success path — reset so Jim can upload the next file without
      // an extra click. Surface row-level errors if there were any,
      // otherwise show a green success banner.
      const errs = s.errors ?? [];
      reset();
      if (errs.length > 0) {
        setError(
          `Import completed with ${errs.length} error${errs.length > 1 ? "s" : ""}:\n` +
            errs.slice(0, 5).map((e) => `• ${e}`).join("\n")
        );
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError(
        err instanceof StrapiError
          ? err.message
          : (err as Error).message || "Import failed."
      );
    }
  }

  function reset() {
    setFormatId("");
    setFileName("");
    setParsed(null);
    setPreview(null);
    setError(null);
    setSuccess(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const isProcessing =
    parseMutation.isPending || previewMutation.isPending || commitMutation.isPending;

  return (
    <Box>
      <Heading as="h2" sx={{ fontSize: 4, mb: 1 }}>
        Import
      </Heading>
      <Text sx={{ color: "fg.muted", fontSize: 1, display: "block", mb: 4 }}>
        Upload a provider export. The file is parsed and previewed by the
        server, then imported transactionally when you confirm.
      </Text>

      {/* Step 1 — format + file */}
      <Box
        sx={{
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: "border.default",
          borderRadius: 2,
          p: 4,
          bg: "canvas.default",
          mb: 3,
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 3,
            alignItems: "end",
          }}
        >
          <FormControl>
            <FormControl.Label>Format</FormControl.Label>
            <Select
              value={formatId}
              onChange={(e) => {
                setFormatId(e.target.value);
                setFileName("");
                setParsed(null);
                setPreview(null);
                setError(null);
                setSuccess(false);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              block
            >
              <Select.Option value="">— Choose a format —</Select.Option>
              {IMPORT_FORMATS.map((f) => {
                // Binary formats (PDFs) are parsed server-side, so a null
                // client parser doesn't mean "coming soon".
                const comingSoon = !f.parser && !f.binary;
                return (
                  <Select.Option key={f.id} value={f.id} disabled={comingSoon}>
                    {f.label}
                    {comingSoon ? " (coming soon)" : ""}
                  </Select.Option>
                );
              })}
            </Select>
          </FormControl>

          <Box>
            <input
              ref={fileInputRef}
              type="file"
              accept={format?.accept}
              onChange={onFileSelected}
              style={{ display: "none" }}
              disabled={isProcessing}
            />
            <Button
              leadingVisual={UploadIcon}
              disabled={!format || (!format.parser && !format.binary) || isProcessing}
              onClick={() => fileInputRef.current?.click()}
            >
              {fileName ? "Pick another file" : "Pick a file"}
            </Button>
          </Box>
        </Box>

        {fileName && (
          <Text sx={{ display: "block", mt: 2, fontSize: 1, color: "fg.muted" }}>
            Selected:{" "}
            <Text sx={{ fontFamily: "mono" }}>{fileName}</Text>
          </Text>
        )}

        {isProcessing && (
          <Box sx={{ mt: 3, display: "flex", gap: 2, alignItems: "center" }}>
            <Spinner size="small" />{" "}
            <Text>
              {parseMutation.isPending
                ? "Parsing…"
                : previewMutation.isPending
                  ? "Analyzing…"
                  : "Importing…"}
            </Text>
          </Box>
        )}

        {error && (
          <Flash variant="danger" sx={{ mt: 3, whiteSpace: "pre-line" }}>
            {error}
          </Flash>
        )}

        {success && (
          <Flash variant="success" sx={{ mt: 3 }}>
            Import complete.
          </Flash>
        )}
      </Box>

      {/* Step 2 — preview */}
      {preview && <PreviewPanel preview={preview} parsed={parsed!} />}

      {/* Commit controls */}
      {preview && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 2,
            mt: 3,
          }}
        >
          <Button onClick={reset} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            variant="primary"
            leadingVisual={ZapIcon}
            disabled={isProcessing}
            onClick={onCommit}
          >
            {commitMutation.isPending ? "Importing…" : "Importer"}
          </Button>
        </Box>
      )}
    </Box>
  );
}

// ---- Preview panel ---------------------------------------------------------

function PreviewPanel({
  preview,
  parsed,
}: {
  preview: PreviewResult;
  parsed: ParsedImport;
}) {
  const grandTotal = useMemo(() => {
    let t = 0;
    for (const acc of parsed.accounts) {
      for (const c of acc.contracts) {
        for (const a of c.allocation) {
          t += (a.quantity ?? 0) * (a.value ?? 0);
        }
      }
    }
    return t;
  }, [parsed]);

  return (
    <Box>
      {/* Top meta cards */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 2,
          mb: 3,
        }}
      >
        <MetaCard
          label="Insurer"
          value={preview.insurer.name}
          status={preview.insurer.status}
        />
        <MetaCard
          label="Products"
          value={preview.products.map((p) => p.name).join(", ") || "—"}
          status={
            preview.products.every((p) => p.status === "matched")
              ? "matched"
              : "will-create"
          }
        />
        <MetaCard label="Portfolio" value={formatEuro(grandTotal)} />
      </Box>

      {preview.warnings.length > 0 && (
        <Flash variant="warning" sx={{ mb: 3 }}>
          {preview.warnings.map((w, i) => (
            <Text key={i} sx={{ display: "block", fontSize: 1 }}>
              • {w}
            </Text>
          ))}
        </Flash>
      )}

      {/* Per-contract detail */}
      <Heading as="h3" sx={{ fontSize: 3, mt: 3, mb: 2 }}>
        Details
      </Heading>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {preview.accounts.map((acc, ai) => (
          <Box
            key={ai}
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}
          >
            {acc.contracts.map((c, ci) => {
              const contractTotal = c.allocations.reduce(
                (s, a) => s + (a.quantity ?? 0) * (a.value ?? 0),
                0
              );
              return (
                <Box
                  key={ci}
                  sx={{
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: "border.default",
                    borderRadius: 2,
                    p: 3,
                  }}
                >
                  {/* Encarts row — CLIENT / ACCOUNT / CONTRACT / PORTFOLIO */}
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: 2,
                      mb: 3,
                    }}
                  >
                    <MetaCard
                      label="Client"
                      value={`${acc.lastname.toUpperCase()} ${acc.firstname}`}
                      status={acc.client.status}
                    />
                    <MetaCard
                      label="Account"
                      value={preview.insurer.name}
                      status={acc.account.status}
                    />
                    <MetaCard
                      label="Contract"
                      value={`${c.contract_code} · ${c.product_name}`}
                      status={c.status}
                    />
                    <MetaCard
                      label="Portfolio"
                      value={formatEuro(contractTotal)}
                    />
                  </Box>

                  <Table.Container>
                    <DataTable
                      aria-label={`Allocations for ${c.contract_code}`}
                      data={c.allocations}
                      columns={[
                        {
                          header: "ISIN",
                          field: "isin",
                          rowHeader: true,
                          renderCell: (a) => (
                            <Text sx={{ fontFamily: "mono" }}>{a.isin}</Text>
                          ),
                        },
                        { header: "Name", field: "name" },
                        {
                          header: "Quantity",
                          field: "quantity",
                          renderCell: (a) => formatNumber(a.quantity),
                        },
                        {
                          header: "Value",
                          field: "value",
                          renderCell: (a) => formatEuro(a.value),
                        },
                        {
                          header: "Total",
                          field: "value",
                          renderCell: (a) =>
                            formatEuro((a.quantity ?? 0) * (a.value ?? 0)),
                        },
                        {
                          header: "Support",
                          field: "support",
                          renderCell: (a) => (
                            <StatusLabel
                              status={a.support.status}
                              entity="support"
                            />
                          ),
                        },
                      ]}
                    />
                  </Table.Container>
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ---- Small UI helpers ------------------------------------------------------

function MetaCard({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status?: "matched" | "will-create";
}) {
  return (
    <Box
      sx={{
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "border.default",
        borderRadius: 2,
        p: 2,
      }}
    >
      <Text
        sx={{
          fontSize: 0,
          color: "fg.muted",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          display: "block",
        }}
      >
        {label}
      </Text>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 1 }}>
        <Text sx={{ fontWeight: 600, fontSize: 1 }}>{value}</Text>
        {status && <StatusLabel status={status} entity="" />}
      </Box>
    </Box>
  );
}

function StatusLabel({
  status,
  entity,
}: {
  status: "matched" | "will-create";
  entity: string;
}) {
  const variant = status === "matched" ? "accent" : "success";
  const prefix = status === "matched" ? "matched" : "new";
  const label = entity ? `${prefix} ${entity}` : prefix;
  return <Label variant={variant}>{label}</Label>;
}

/**
 * ArrayBuffer → base64. Chunked so we don't blow the stack on large PDFs
 * via `String.fromCharCode(...bytes)`.
 */
function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk))
    );
  }
  return btoa(binary);
}

