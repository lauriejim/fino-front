import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Heading,
  Text,
  Button,
  FormControl,
  IconButton,
  Checkbox,
  Select,
  Spinner,
  TextInput,
  Flash,
  Label,
} from "@primer/react";
import { DataTable, Table } from "@primer/react/experimental";
import { ArrowLeftIcon, PencilIcon, PlusIcon, ZapIcon } from "@primer/octicons-react";
import { getClient, updateClient } from "@/api/clients";
import { updateContract } from "@/api/contracts";
import { createInvoice } from "@/api/invoices";
import { listIsrEsgProfiles, listRiskProfiles } from "@/api/profiles";
import { StrapiError } from "@/api/client";
import { formatDate, formatEuro, formatNumber, formatPercent } from "@/lib/format";
import {
  CLICKABLE_ROWS_SX,
  hasSelection,
  isInteractiveClick,
  rowIndexFromClick,
} from "@/lib/clickable-rows";
import { Modal } from "@/components/modal/Modal";
import type { Allocation, Contract, Invoice } from "@/types/strapi";

// ---- Row shapes ------------------------------------------------------------

interface ContractRow {
  documentId: string;
  code: string;
  insurer: string;
  product: string;
  amount: number;
  date: string;
  rate: number;
  vat: number;
  rateOverridden: boolean;
  vatOverridden: boolean;
  _contract: Contract;
}

interface AllocationRow {
  isin: string;
  name: string;
  quantity: number;
  repartition: number;
  value: number;
  total: number;
  date: string;
}

interface InvoiceRow {
  documentId: string;
  date: string;
  totalNoTax: number;
  totalTax: number;
  fees: number;
  net: number;
  _invoice: Invoice;
}

// ---- Pure helpers ----------------------------------------------------------

function contractAmount(contract: Contract): number {
  const latest: Allocation[] = (contract.allocations ?? []).filter((a) => a.latest);
  return latest.reduce((sum, a) => sum + (a.quantity ?? 0) * (a.value ?? 0), 0);
}

function invoiceFees(invoice: Invoice): number {
  return (invoice.lines ?? []).reduce((sum, l) => sum + (l.fee ?? 0), 0);
}

function latestInvoiceDate(invoices: Invoice[] | undefined): string | null {
  if (!invoices || invoices.length === 0) return null;
  return invoices.reduce((latest, i) =>
    new Date(i.date) > new Date(latest.date) ? i : latest
  ).date;
}

/** Same formula as v1 `calculate()`: prorata temporis HT / TTC. */
function prorata({
  amount,
  rate,
  vat,
  days,
}: {
  amount: number;
  rate: number;
  vat: number;
  days: number;
}) {
  const r = rate / 100;
  const v = vat / 100;
  const annualNoTax = amount * r;
  const prorataNoTax = (annualNoTax / 365) * days;
  const prorataTax = prorataNoTax * (1 + v);
  return { prorataNoTax, prorataTax };
}

function subtractDaysIso(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() - days);
  return new Date(utc).toISOString().slice(0, 10);
}

function todayIso(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysBetween(d1: string, d2: string): number {
  const a = new Date(d1).getTime();
  const b = new Date(d2).getTime();
  return Math.floor(Math.abs(b - a) / (1000 * 60 * 60 * 24));
}

// ---- Page ------------------------------------------------------------------

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selectedContract, setSelectedContract] = useState<ContractRow | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null);
  const [editingContract, setEditingContract] = useState<ContractRow | null>(null);
  const [autoInvoiceOpen, setAutoInvoiceOpen] = useState(false);
  const [customInvoiceOpen, setCustomInvoiceOpen] = useState(false);
  const [editingClientInfo, setEditingClientInfo] = useState(false);
  const [editingClientData, setEditingClientData] = useState(false);

  const query = useQuery({
    queryKey: ["clients", "detail", id],
    queryFn: () => (id ? getClient(id) : Promise.reject(new Error("Missing id"))),
    enabled: Boolean(id),
  });

  const contracts: ContractRow[] = useMemo(() => {
    const client = query.data;
    if (!client) return [];
    const rows: ContractRow[] = [];
    for (const account of client.accounts ?? []) {
      for (const contract of account.contracts ?? []) {
        const product = contract.product;
        const envelope = product?.envelope;
        const rate = contract.custom_rate ?? envelope?.base_rate ?? 0;
        const vat = contract.custom_vat ?? envelope?.base_vat ?? 0;
        rows.push({
          documentId: contract.documentId,
          code: contract.code ?? "",
          insurer: account.insurer?.name ?? "—",
          product: product?.name ?? contract.name ?? "—",
          amount: contractAmount(contract),
          date: contract.date ?? "",
          rate,
          vat,
          rateOverridden: contract.custom_rate != null,
          vatOverridden: contract.custom_vat != null,
          _contract: contract,
        });
      }
    }
    return rows;
  }, [query.data]);

  const totalAum = useMemo(
    () => contracts.reduce((sum, c) => sum + c.amount, 0),
    [contracts]
  );

  const invoices: InvoiceRow[] = useMemo(() => {
    const list = query.data?.invoices ?? [];
    return [...list]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((inv) => {
        const fees = invoiceFees(inv);
        return {
          documentId: inv.documentId,
          date: inv.date,
          totalNoTax: Number(inv.total_no_tax ?? 0),
          totalTax: Number(inv.total_tax ?? 0),
          fees,
          net: Number(inv.total_tax ?? 0) - fees,
          _invoice: inv,
        };
      });
  }, [query.data]);

  if (query.isLoading || !query.data) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
        <Spinner />
      </Box>
    );
  }

  if (query.isError) {
    return (
      <Flash variant="danger">
        Failed to load client: {(query.error as Error).message}
      </Flash>
    );
  }

  const client = query.data;
  const lastInvoice = latestInvoiceDate(client.invoices);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Button
          variant="invisible"
          leadingVisual={ArrowLeftIcon}
          onClick={() => navigate("/clients")}
        >
          Back to clients
        </Button>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, mb: 4 }}>
        <InfoCard
          title="Client information"
          action={
            <IconButton
              icon={PencilIcon}
              aria-label="Edit client information"
              size="small"
              onClick={() => setEditingClientInfo(true)}
            />
          }
        >
          <InfoRow label="Name" value={`${client.firstname} ${client.lastname}`} />
          <InfoRow label="Email" value={client.email ?? "—"} />
          <InfoRow label="Phone" value={client.phone ?? "—"} />
          <InfoRow label="Birth date" value={formatDate(client.birthdate)} />
        </InfoCard>

        <InfoCard
          title="Client data"
          action={
            <IconButton
              icon={PencilIcon}
              aria-label="Edit client data"
              size="small"
              onClick={() => setEditingClientData(true)}
            />
          }
        >
          <InfoRow label="Risk profile" value={client.risk_profile?.name ?? "—"} />
          <InfoRow label="ISR/ESG profile" value={client.isr_esg_profile?.name ?? "—"} />
          <InfoRow label="Assets under management" value={formatEuro(totalAum)} />
          <InfoRow label="Last invoice" value={formatDate(lastInvoice)} />
        </InfoCard>
      </Box>

      {/* Contracts */}
      <Heading as="h3" sx={{ fontSize: 3, mb: 2 }}>
        Contracts
      </Heading>

      {contracts.length === 0 ? (
        <Text sx={{ color: "fg.muted" }}>No contracts yet.</Text>
      ) : (
        <Box
          sx={CLICKABLE_ROWS_SX}
          onClickCapture={(e: MouseEvent<HTMLElement>) => {
            if (hasSelection() || isInteractiveClick(e)) return;
            const idx = rowIndexFromClick(e);
            if (idx === null) return;
            const row = contracts[idx];
            if (row) setSelectedContract(row);
          }}
        >
          <Table.Container>
            <DataTable<ContractRow>
              aria-label="Contracts"
              data={contracts}
              columns={[
                { header: "Code", field: "code", rowHeader: true },
                { header: "Insurer", field: "insurer" },
                { header: "Contract", field: "product" },
                {
                  header: "Amount",
                  field: "amount",
                  renderCell: (row) => formatEuro(row.amount),
                },
                {
                  header: "Date",
                  field: "date",
                  renderCell: (row) => formatDate(row.date),
                },
                {
                  header: "Rate",
                  field: "rate",
                  renderCell: (row) => (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <span>{formatPercent(row.rate)}</span>
                      {row.rateOverridden && <Label variant="attention">custom</Label>}
                    </Box>
                  ),
                },
                {
                  header: "VAT",
                  field: "vat",
                  renderCell: (row) => (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <span>{formatPercent(row.vat)}</span>
                      {row.vatOverridden && <Label variant="attention">custom</Label>}
                    </Box>
                  ),
                },
                {
                  header: "",
                  field: "documentId",
                  align: "end",
                  renderCell: (row) => (
                    <Box sx={{ display: "flex", justifyContent: "flex-end", width: "100%" }}>
                      <IconButton
                        icon={PencilIcon}
                        aria-label={`Edit contract ${row.code}`}
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingContract(row);
                        }}
                      />
                    </Box>
                  ),
                },
              ]}
            />
          </Table.Container>
        </Box>
      )}

      {/* Invoices */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mt: 4,
          mb: 2,
        }}
      >
        <Heading as="h3" sx={{ fontSize: 3 }}>
          Invoices
        </Heading>
        <Box sx={{ display: "flex", gap: 2 }}>
          <Button
            size="small"
            leadingVisual={ZapIcon}
            disabled={contracts.length === 0}
            onClick={() => setAutoInvoiceOpen(true)}
          >
            New auto invoice
          </Button>
          <Button
            size="small"
            leadingVisual={PlusIcon}
            disabled={contracts.length === 0}
            onClick={() => setCustomInvoiceOpen(true)}
          >
            New custom invoice
          </Button>
        </Box>
      </Box>

      {invoices.length === 0 ? (
        <Box sx={{ p: 3, bg: "canvas.subtle", borderRadius: 2 }}>
          <Text sx={{ color: "fg.muted", fontSize: 1 }}>No invoices yet.</Text>
        </Box>
      ) : (
        <Box
          sx={CLICKABLE_ROWS_SX}
          onClickCapture={(e: MouseEvent<HTMLElement>) => {
            if (hasSelection()) return;
            const idx = rowIndexFromClick(e);
            if (idx === null) return;
            const row = invoices[idx];
            if (row) setSelectedInvoice(row);
          }}
        >
          <Table.Container>
            <DataTable<InvoiceRow>
              aria-label="Invoices"
              data={invoices}
              columns={[
                {
                  header: "Date",
                  field: "date",
                  rowHeader: true,
                  renderCell: (row) => formatDate(row.date),
                },
                {
                  header: "Total HT",
                  field: "totalNoTax",
                  renderCell: (row) => formatEuro(row.totalNoTax),
                },
                {
                  header: "Total TTC",
                  field: "totalTax",
                  renderCell: (row) => formatEuro(row.totalTax),
                },
                {
                  header: "Fees",
                  field: "fees",
                  renderCell: (row) => formatEuro(row.fees),
                },
                {
                  header: "Net invoice",
                  field: "net",
                  renderCell: (row) => (
                    <Text sx={{ fontWeight: "bold" }}>{formatEuro(row.net)}</Text>
                  ),
                },
              ]}
            />
          </Table.Container>
        </Box>
      )}

      {selectedContract && (
        <AllocationsDialog
          row={selectedContract}
          onClose={() => setSelectedContract(null)}
        />
      )}

      {selectedInvoice && (
        <InvoiceDetailDialog
          row={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />
      )}

      {editingContract && id && (
        <ContractEditDialog
          row={editingContract}
          clientDocumentId={id}
          onClose={() => setEditingContract(null)}
        />
      )}

      {autoInvoiceOpen && id && (
        <AutoInvoiceDialog
          client={client}
          clientDocumentId={id}
          onClose={() => setAutoInvoiceOpen(false)}
        />
      )}

      {customInvoiceOpen && id && (
        <CustomInvoiceDialog
          client={client}
          contracts={contracts}
          clientDocumentId={id}
          onClose={() => setCustomInvoiceOpen(false)}
        />
      )}

      {editingClientInfo && id && (
        <ClientInfoEditDialog
          client={client}
          clientDocumentId={id}
          onClose={() => setEditingClientInfo(false)}
        />
      )}

      {editingClientData && id && (
        <ClientDataEditDialog
          client={client}
          clientDocumentId={id}
          onClose={() => setEditingClientData(false)}
        />
      )}
    </Box>
  );
}

// ---- Allocations table (shared by both modals) -----------------------------

function AllocationsTable({
  allocations,
  ariaLabel,
}: {
  allocations: Allocation[];
  ariaLabel: string;
}) {
  const total = allocations.reduce(
    (sum, a) => sum + (a.quantity ?? 0) * (a.value ?? 0),
    0
  );

  const rows: AllocationRow[] = allocations
    .map((a) => {
      const lineTotal = (a.quantity ?? 0) * (a.value ?? 0);
      return {
        isin: a.support?.ISIN ?? a.support?.code ?? "—",
        name: a.support?.name ?? "—",
        quantity: a.quantity ?? 0,
        repartition: total > 0 ? (lineTotal / total) * 100 : 0,
        value: a.value ?? 0,
        total: lineTotal,
        date: a.date ?? "",
      };
    })
    .sort((a, b) => b.total - a.total);

  if (rows.length === 0) {
    return <Text sx={{ color: "fg.muted" }}>No allocations.</Text>;
  }

  return (
    <Table.Container>
      <DataTable<AllocationRow>
        aria-label={ariaLabel}
        data={rows}
        columns={[
          { header: "ISIN", field: "isin", rowHeader: true },
          { header: "Name", field: "name" },
          {
            header: "Quantity",
            field: "quantity",
            renderCell: (r) => formatNumber(r.quantity),
          },
          {
            header: "Value",
            field: "value",
            renderCell: (r) => formatEuro(r.value),
          },
          {
            header: "Total",
            field: "total",
            renderCell: (r) => formatEuro(r.total),
          },
          {
            header: "Repartition",
            field: "repartition",
            renderCell: (r) => formatPercent(r.repartition),
          },
          {
            header: "Date",
            field: "date",
            renderCell: (r) => formatDate(r.date),
          },
        ]}
      />
    </Table.Container>
  );
}

// ---- Allocations modal -----------------------------------------------------

function AllocationsDialog({
  row,
  onClose,
}: {
  row: ContractRow;
  onClose: () => void;
}) {
  const latest: Allocation[] = (row._contract.allocations ?? []).filter(
    (a) => a.latest
  );
  const total = latest.reduce(
    (sum, a) => sum + (a.quantity ?? 0) * (a.value ?? 0),
    0
  );

  return (
    <Modal
      title={`${row.insurer} — ${row.product}`}
      onClose={onClose}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 2,
          mb: 3,
        }}
      >
        <Stat label="Contract" value={row.code || "—"} />
        <Stat label="Opened" value={formatDate(row.date)} />
        <Stat label="Portfolio" value={formatEuro(total)} emphasis />
      </Box>
      <AllocationsTable allocations={latest} ariaLabel="Current allocations" />
    </Modal>
  );
}

// ---- Invoice detail modal --------------------------------------------------

function InvoiceDetailDialog({
  row,
  onClose,
}: {
  row: InvoiceRow;
  onClose: () => void;
}) {
  const inv = row._invoice;
  const portfolio = (inv.lines ?? []).reduce((s, l) => s + (l.amount ?? 0), 0);

  return (
    <Modal
      title={`Invoice · ${formatDate(inv.date)}`}
      onClose={onClose}
    >
      {/* Invoice-level totals at the top — amounts only */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 2,
          mb: 4,
        }}
      >
        <Stat label="Portfolio" value={formatEuro(portfolio)} />
        <Stat label="Total HT" value={formatEuro(row.totalNoTax)} />
        <Stat label="Total TTC" value={formatEuro(row.totalTax)} />
        <Stat label="Total fees" value={formatEuro(row.fees)} />
        <Stat label="Net invoice" value={formatEuro(row.net)} emphasis />
      </Box>

      {!inv.lines || inv.lines.length === 0 ? (
        <Text sx={{ color: "fg.muted" }}>No lines on this invoice.</Text>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {inv.lines.map((line, i) => {
            const contract = line.contract;
            const insurer = contract?.product?.insurer?.name ?? "—";
            const product = contract?.product?.name ?? contract?.name ?? "—";
            const amount = Number(line.amount ?? 0);
            const rate = Number(line.rate ?? 0);
            const vat = Number(line.vat ?? 0);
            const days = Number(line.period ?? 0);
            const fee = line.fee == null ? null : Number(line.fee);
            const { prorataNoTax, prorataTax } = prorata({ amount, rate, vat, days });
            const startDate = inv.date ? subtractDaysIso(inv.date, days) : "—";

            const netLine = prorataTax - (fee ?? 0);

            return (
              <Box
                key={line.id ?? i}
                sx={{
                  borderWidth: 1,
                  borderStyle: "solid",
                  borderColor: "border.default",
                  borderRadius: 2,
                  p: 3,
                }}
              >
                <Heading as="h4" sx={{ fontSize: 2, mb: 3 }}>
                  {insurer} — {product}
                </Heading>

                {/* Period banner */}
                <Box
                  sx={{
                    mb: 3,
                    p: 2,
                    bg: "canvas.subtle",
                    borderRadius: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Box>
                    <Text
                      sx={{
                        fontSize: 0,
                        color: "fg.muted",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        display: "block",
                      }}
                    >
                      Period
                    </Text>
                    <Text sx={{ fontWeight: "bold" }}>
                      {startDate} → {formatDate(inv.date)}
                    </Text>
                  </Box>
                  <Label variant="secondary">{days} days</Label>
                </Box>

                {/* Pricing row — portfolio + rate + vat + fees */}
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 2,
                    mb: 2,
                  }}
                >
                  <Stat label="Portfolio" value={formatEuro(amount)} />
                  <Stat label="Rate" value={formatPercent(rate)} />
                  <Stat label="VAT" value={formatPercent(vat)} />
                  <Stat label="Fees" value={fee == null ? "—" : formatEuro(fee)} />
                </Box>

                {/* Amounts row — HT, TTC, Net emphasized */}
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 2,
                    mb: line.allocations && line.allocations.length > 0 ? 3 : 0,
                  }}
                >
                  <Stat label="Amount HT" value={formatEuro(prorataNoTax)} />
                  <Stat label="Amount TTC" value={formatEuro(prorataTax)} />
                  <Stat
                    label="Net (TTC − fees)"
                    value={formatEuro(netLine)}
                    emphasis
                  />
                </Box>

                {line.allocations && line.allocations.length > 0 && (
                  <Box>
                    <Text
                      sx={{
                        fontSize: 0,
                        color: "fg.muted",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        display: "block",
                        mb: 2,
                      }}
                    >
                      Allocations at invoice time
                    </Text>
                    <AllocationsTable
                      allocations={line.allocations}
                      ariaLabel={`Allocations for ${insurer} ${product}`}
                    />
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}
    </Modal>
  );
}

// ---- Auto invoice modal ----------------------------------------------------

interface AutoInvoiceLine {
  contractDocumentId: string;
  insurer: string;
  product: string;
  allocationIds: string[];
  amount: number;
  rate: number;
  vat: number;
  lastDate: string;
  days: number;
  prorataNoTax: number;
  prorataTax: number;
}

function AutoInvoiceDialog({
  client,
  clientDocumentId,
  onClose,
}: {
  client: Client;
  clientDocumentId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const today = todayIso();

  // Build preview rows — one per contract on the client.
  // Logic mirrors v1 generateInvoice(): latest allocations, prorata between
  // last invoice for this contract (or contract.date) and today.
  const lines: AutoInvoiceLine[] = useMemo(() => {
    const out: AutoInvoiceLine[] = [];
    for (const account of client.accounts ?? []) {
      for (const contract of account.contracts ?? []) {
        const latest = (contract.allocations ?? []).filter((a) => a.latest);
        const amount = latest.reduce(
          (s, a) => s + (a.quantity ?? 0) * (a.value ?? 0),
          0
        );
        const rate =
          contract.custom_rate ?? contract.product?.envelope?.base_rate ?? 0;
        const vat =
          contract.custom_vat ?? contract.product?.envelope?.base_vat ?? 0;

        // Most recent invoice date for this contract (falls back to contract.date)
        let lastDate = contract.date ?? today;
        for (const inv of client.invoices ?? []) {
          for (const line of inv.lines ?? []) {
            if (line.contract?.documentId === contract.documentId) {
              if (new Date(inv.date) > new Date(lastDate)) {
                lastDate = inv.date;
              }
            }
          }
        }

        const days = daysBetween(lastDate, today);
        const { prorataNoTax, prorataTax } = prorata({ amount, rate, vat, days });

        out.push({
          contractDocumentId: contract.documentId,
          insurer: account.insurer?.name ?? "—",
          product: contract.product?.name ?? contract.name ?? "—",
          allocationIds: latest.map((a) => a.documentId),
          amount,
          rate,
          vat,
          lastDate,
          days,
          prorataNoTax,
          prorataTax,
        });
      }
    }
    return out;
  }, [client, today]);

  const totalHT = lines.reduce((s, l) => s + l.prorataNoTax, 0);
  const totalTTC = lines.reduce((s, l) => s + l.prorataTax, 0);

  // Per-contract fee edits — keyed by contract documentId. Stored as string
  // so the user can type partials ("12" → "12.", etc.). Parsed only on submit.
  const [fees, setFees] = useState<Record<string, string>>({});
  const feeFor = (l: AutoInvoiceLine): number => {
    const s = fees[l.contractDocumentId];
    if (!s || s.trim() === "") return 0;
    const n = Number(s);
    return Number.isNaN(n) ? 0 : n;
  };
  const totalFees = lines.reduce((s, l) => s + feeFor(l), 0);
  const totalNet = totalTTC - totalFees;

  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createInvoice({
        date: today,
        client: clientDocumentId,
        lines: lines.map((l) => {
          const fee = feeFor(l);
          return {
            contract: l.contractDocumentId,
            allocations: l.allocationIds,
            amount: Number(l.amount.toFixed(2)),
            rate: l.rate,
            vat: l.vat,
            period: l.days,
            fee: fee > 0 ? Number(fee.toFixed(2)) : null,
          };
        }),
        total_tax: Number(totalTTC.toFixed(2)),
        total_no_tax: Number(totalHT.toFixed(2)),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["clients", "detail", clientDocumentId],
      });
      onClose();
    },
    onError: (err) => {
      if (err instanceof StrapiError) setError(err.message);
      else setError("Could not generate the invoice. Please try again.");
    },
  });

  // Cmd/Ctrl + Enter → generate. Escape handled by Modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !mutation.isPending) {
        e.preventDefault();
        e.stopPropagation();
        mutation.mutate();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [mutation]);

  const nothingToInvoice = lines.every((l) => l.days === 0 || l.amount === 0);

  return (
    <Modal title={`Generate auto invoice · ${formatDate(today)}`} onClose={onClose}>
      {error && (
        <Flash variant="danger" sx={{ mb: 3 }}>
          {error}
        </Flash>
      )}

      {nothingToInvoice && lines.length > 0 && (
        <Flash variant="warning" sx={{ mb: 3 }}>
          Every contract is either empty or was already invoiced today. Nothing
          to charge.
        </Flash>
      )}

      <Text sx={{ color: "fg.muted", mb: 3, display: "block", fontSize: 1 }}>
        Preview — one line per contract, based on the latest allocations and
        the days since the previous invoice for that contract.
      </Text>

      <Table.Container>
        <DataTable<AutoInvoiceLine>
          aria-label="Auto invoice preview"
          data={lines}
          columns={[
            {
              header: "Contract",
              field: "product",
              rowHeader: true,
              renderCell: (l) => (
                <Box>
                  <Text sx={{ display: "block" }}>{l.product}</Text>
                  <Text sx={{ color: "fg.muted", fontSize: 0 }}>{l.insurer}</Text>
                </Box>
              ),
            },
            {
              header: "Portfolio",
              field: "amount",
              renderCell: (l) => formatEuro(l.amount),
            },
            {
              header: "Rate",
              field: "rate",
              renderCell: (l) => formatPercent(l.rate),
            },
            {
              header: "VAT",
              field: "vat",
              renderCell: (l) => formatPercent(l.vat),
            },
            {
              header: "Since",
              field: "lastDate",
              renderCell: (l) => (
                <Box>
                  <Text sx={{ display: "block" }}>{formatDate(l.lastDate)}</Text>
                  <Text sx={{ color: "fg.muted", fontSize: 0 }}>
                    {l.days} days
                  </Text>
                </Box>
              ),
            },
            {
              header: "Amount HT",
              field: "prorataNoTax",
              renderCell: (l) => formatEuro(l.prorataNoTax),
            },
            {
              header: "Amount TTC",
              field: "prorataTax",
              renderCell: (l) => formatEuro(l.prorataTax),
            },
            {
              header: "Fees",
              field: "contractDocumentId",
              renderCell: (l) => (
                <TextInput
                  value={fees[l.contractDocumentId] ?? ""}
                  onChange={(e) =>
                    setFees((prev) => ({
                      ...prev,
                      [l.contractDocumentId]: e.target.value,
                    }))
                  }
                  placeholder="0.00"
                  inputMode="decimal"
                  sx={{ width: "110px" }}
                />
              ),
            },
            {
              header: "Net",
              field: "prorataTax",
              renderCell: (l) => (
                <Text sx={{ fontWeight: "bold" }}>
                  {formatEuro(l.prorataTax - feeFor(l))}
                </Text>
              ),
            },
          ]}
        />
      </Table.Container>

      {/* Totals */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 2,
          mt: 3,
        }}
      >
        <Stat label="Total HT" value={formatEuro(totalHT)} />
        <Stat label="Total TTC" value={formatEuro(totalTTC)} />
        <Stat label="Total fees" value={formatEuro(totalFees)} />
        <Stat label="Net" value={formatEuro(totalNet)} emphasis />
      </Box>

      {/* Actions */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 2,
          pt: 3,
          mt: 4,
          borderTopWidth: 1,
          borderTopStyle: "solid",
          borderTopColor: "border.default",
        }}
      >
        <Button onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={mutation.isPending || nothingToInvoice}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Generating…" : "Generate invoice"}
        </Button>
      </Box>
    </Modal>
  );
}

// ---- Custom invoice modal --------------------------------------------------

function CustomInvoiceDialog({
  client,
  contracts,
  clientDocumentId,
  onClose,
}: {
  client: Client;
  contracts: ContractRow[];
  clientDocumentId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayIso());
  const [amountHT, setAmountHT] = useState("");
  const [amountTTC, setAmountTTC] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  // For each contract compute its reference date = max(invoice.date on any
  // line pointing at this contract) or fall back to contract.date. Period is
  // then the gap between that date and the invoice date the user is typing.
  function referenceDateFor(contractDocumentId: string): string {
    const row = contracts.find((c) => c.documentId === contractDocumentId);
    let lastDate = row?._contract.date ?? date;
    for (const inv of client.invoices ?? []) {
      for (const line of inv.lines ?? []) {
        if (line.contract?.documentId === contractDocumentId) {
          if (new Date(inv.date) > new Date(lastDate)) {
            lastDate = inv.date;
          }
        }
      }
    }
    return lastDate;
  }
  /** Signed diff in days between the invoice date and the reference date.
   *  Negative = invoice date precedes the reference → contract can't be invoiced. */
  function signedPeriodFor(contractDocumentId: string): number {
    if (!date) return 0;
    const ref = new Date(referenceDateFor(contractDocumentId));
    const inv = new Date(date);
    return Math.floor((inv.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
  }
  function isContractDisabled(contractDocumentId: string): boolean {
    return signedPeriodFor(contractDocumentId) < 0;
  }
  function periodFor(contractDocumentId: string): number {
    return Math.max(0, signedPeriodFor(contractDocumentId));
  }

  // If the user moves the invoice date earlier than a selected contract's
  // reference date, auto-deselect that contract — otherwise we'd submit
  // lines with invalid (negative → clamped to 0) periods without the user
  // noticing.
  useEffect(() => {
    setSelected((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (next[id] && isContractDisabled(id)) {
          next[id] = false;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const mutation = useMutation({
    mutationFn: () => {
      const contractIds = Object.entries(selected)
        .filter(([, v]) => v)
        .map(([k]) => k);
      return createInvoice({
        date: date.trim(),
        client: clientDocumentId,
        // A custom invoice lets the user type the invoice totals directly;
        // per-line amount/rate/vat/fees are not prorated. We still persist
        // the period (days since the previous invoice on that contract, or
        // contract opening date if none) so the detail modal can show it.
        lines: contractIds.map((c) => ({
          contract: c,
          allocations: [],
          amount: 0,
          rate: 0,
          vat: 0,
          period: periodFor(c),
        })),
        total_no_tax: Number(Number(amountHT).toFixed(2)),
        total_tax: Number(Number(amountTTC).toFixed(2)),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["clients", "detail", clientDocumentId],
      });
      onClose();
    },
    onError: (err) => {
      if (err instanceof StrapiError) setError(err.message);
      else setError("Could not create the invoice. Please try again.");
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedDate = date.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      setError("Date must be in YYYY-MM-DD format.");
      return;
    }
    if (amountHT.trim() === "" || Number.isNaN(Number(amountHT))) {
      setError("Amount HT must be a number.");
      return;
    }
    if (amountTTC.trim() === "" || Number.isNaN(Number(amountTTC))) {
      setError("Amount TTC must be a number.");
      return;
    }
    const hasSelection = Object.values(selected).some(Boolean);
    if (!hasSelection) {
      setError("Select at least one contract.");
      return;
    }

    mutation.mutate();
  }

  // Cmd/Ctrl + Enter → submit ; Escape → close (capture phase for robustness)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !mutation.isPending) {
        e.preventDefault();
        e.stopPropagation();
        // Build + submit a synthetic FormEvent
        onSubmit({ preventDefault: () => {} } as FormEvent);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, amountHT, amountTTC, selected, mutation.isPending]);

  return (
    <Modal title="New custom invoice" onClose={onClose}>
      <Box as="form" onSubmit={onSubmit}>
        {error && (
          <Flash variant="danger" sx={{ mb: 3 }}>
            {error}
          </Flash>
        )}

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 3,
            mb: 4,
          }}
        >
          <FormControl required>
            <FormControl.Label>Invoice date</FormControl.Label>
            <TextInput
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder="YYYY-MM-DD"
              block
              size="large"
            />
          </FormControl>
          <FormControl required>
            <FormControl.Label>Amount HT</FormControl.Label>
            <TextInput
              value={amountHT}
              onChange={(e) => setAmountHT(e.target.value)}
              placeholder="0.00"
              block
              size="large"
              inputMode="decimal"
              trailingVisual="€"
            />
          </FormControl>
          <FormControl required>
            <FormControl.Label>Amount TTC</FormControl.Label>
            <TextInput
              value={amountTTC}
              onChange={(e) => setAmountTTC(e.target.value)}
              placeholder="0.00"
              block
              size="large"
              inputMode="decimal"
              trailingVisual="€"
            />
          </FormControl>
        </Box>

        <Text
          sx={{
            fontSize: 0,
            color: "fg.muted",
            textTransform: "uppercase",
            letterSpacing: 0.5,
            display: "block",
            mb: 2,
          }}
        >
          Contracts to attach
        </Text>

        <Box
          sx={{
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: "border.default",
            borderRadius: 2,
            maxHeight: "320px",
            overflowY: "auto",
            mb: 4,
          }}
        >
          {contracts.map((c, i) => {
            const id = c.documentId;
            const refDate = referenceDateFor(id);
            const days = periodFor(id);
            const disabled = isContractDisabled(id);
            return (
              <Box
                as="label"
                key={id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  p: 2,
                  cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.55 : 1,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopStyle: "solid",
                  borderTopColor: "border.muted",
                  "&:hover": {
                    bg: disabled ? undefined : "canvas.subtle",
                  },
                }}
              >
                <Checkbox
                  checked={!!selected[id]}
                  disabled={disabled}
                  onChange={(e) =>
                    setSelected((prev) => ({ ...prev, [id]: e.target.checked }))
                  }
                />
                <Box sx={{ flex: 1 }}>
                  <Text sx={{ display: "block" }}>
                    {c.insurer} — {c.product}
                  </Text>
                  <Text sx={{ fontSize: 0, color: "fg.muted" }}>
                    {c.code} · {formatEuro(c.amount)}
                  </Text>
                </Box>
                <Box sx={{ textAlign: "right" }}>
                  {disabled ? (
                    <Text sx={{ fontSize: 0, color: "danger.fg" }}>
                      Invoice date is before {formatDate(refDate)}
                    </Text>
                  ) : (
                    <>
                      <Text sx={{ fontSize: 0, color: "fg.muted", display: "block" }}>
                        Since {formatDate(refDate)}
                      </Text>
                      <Text sx={{ fontSize: 1, fontWeight: "bold" }}>
                        {days} days
                      </Text>
                    </>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>

        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 2,
            pt: 3,
            borderTopWidth: 1,
            borderTopStyle: "solid",
            borderTopColor: "border.default",
          }}
        >
          <Button type="button" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Creating…" : "Create invoice"}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}

// ---- Client info edit modal ------------------------------------------------

function ClientInfoEditDialog({
  client,
  clientDocumentId,
  onClose,
}: {
  client: Client;
  clientDocumentId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [firstname, setFirstname] = useState(client.firstname ?? "");
  const [lastname, setLastname] = useState(client.lastname ?? "");
  const [email, setEmail] = useState(client.email ?? "");
  const [phone, setPhone] = useState(client.phone ?? "");
  const [birthdate, setBirthdate] = useState(client.birthdate ?? "");
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const firstnameInputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: () =>
      updateClient(clientDocumentId, {
        firstname: firstname.trim(),
        lastname: lastname.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        birthdate: birthdate.trim() || null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["clients", "detail", clientDocumentId],
      });
      // Also bust the clients-list cache so the row updates there too
      await queryClient.invalidateQueries({ queryKey: ["clients", "list"] });
      onClose();
    },
    onError: (err) => {
      if (err instanceof StrapiError) setError(err.message);
      else setError("Could not save the client. Please try again.");
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!firstname.trim() || !lastname.trim()) {
      setError("First name and last name are required.");
      return;
    }
    if (birthdate.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(birthdate.trim())) {
      setError("Birth date must be in YYYY-MM-DD format.");
      return;
    }

    mutation.mutate();
  }

  // Cmd/Ctrl + Enter → submit. Escape → close. Capture phase.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        e.stopPropagation();
        formRef.current?.requestSubmit();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  useEffect(() => {
    firstnameInputRef.current?.focus();
  }, []);

  return (
    <Modal title="Edit client information" onClose={onClose}>
      <Box as="form" ref={formRef} onSubmit={onSubmit}>
        {error && (
          <Flash variant="danger" sx={{ mb: 3 }}>
            {error}
          </Flash>
        )}

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 3,
            mb: 3,
          }}
        >
          <FormControl required>
            <FormControl.Label>First name</FormControl.Label>
            <TextInput
              ref={firstnameInputRef}
              value={firstname}
              onChange={(e) => setFirstname(e.target.value)}
              block
              size="large"
            />
          </FormControl>
          <FormControl required>
            <FormControl.Label>Last name</FormControl.Label>
            <TextInput
              value={lastname}
              onChange={(e) => setLastname(e.target.value)}
              block
              size="large"
            />
          </FormControl>
        </Box>

        <FormControl sx={{ mb: 3 }}>
          <FormControl.Label>Email</FormControl.Label>
          <TextInput
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            block
            size="large"
          />
        </FormControl>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 3,
            mb: 4,
          }}
        >
          <FormControl>
            <FormControl.Label>Phone</FormControl.Label>
            <TextInput
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              block
              size="large"
            />
          </FormControl>
          <FormControl>
            <FormControl.Label>Birth date</FormControl.Label>
            <TextInput
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              placeholder="YYYY-MM-DD"
              block
              size="large"
            />
          </FormControl>
        </Box>

        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 2,
            pt: 3,
            borderTopWidth: 1,
            borderTopStyle: "solid",
            borderTopColor: "border.default",
          }}
        >
          <Button type="button" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}

// ---- Client data edit modal (risk + ESG profiles) --------------------------

function ClientDataEditDialog({
  client,
  clientDocumentId,
  onClose,
}: {
  client: Client;
  clientDocumentId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const riskProfilesQuery = useQuery({
    queryKey: ["risk-profiles"],
    queryFn: listRiskProfiles,
  });
  const esgProfilesQuery = useQuery({
    queryKey: ["isr-esg-profiles"],
    queryFn: listIsrEsgProfiles,
  });

  const [riskId, setRiskId] = useState<string>(
    client.risk_profile?.id ? String(client.risk_profile.id) : ""
  );
  const [esgId, setEsgId] = useState<string>(
    client.isr_esg_profile?.id ? String(client.isr_esg_profile.id) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const mutation = useMutation({
    mutationFn: () =>
      updateClient(clientDocumentId, {
        risk_profile: riskId ? { set: Number(riskId) } : null,
        isr_esg_profile: esgId ? { set: Number(esgId) } : null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["clients", "detail", clientDocumentId],
      });
      onClose();
    },
    onError: (err) => {
      if (err instanceof StrapiError) setError(err.message);
      else setError("Could not save the client. Please try again.");
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        e.stopPropagation();
        formRef.current?.requestSubmit();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const loading = riskProfilesQuery.isLoading || esgProfilesQuery.isLoading;

  return (
    <Modal title="Edit client data" onClose={onClose}>
      <Box as="form" ref={formRef} onSubmit={onSubmit}>
        {error && (
          <Flash variant="danger" sx={{ mb: 3 }}>
            {error}
          </Flash>
        )}

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <Spinner />
          </Box>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 3,
              mb: 4,
            }}
          >
            <FormControl>
              <FormControl.Label>Risk profile</FormControl.Label>
              <Select
                value={riskId}
                onChange={(e) => setRiskId(e.target.value)}
                block
              >
                <Select.Option value="">— None —</Select.Option>
                {riskProfilesQuery.data?.map((p) => (
                  <Select.Option key={p.id} value={String(p.id)}>
                    {p.name}
                  </Select.Option>
                ))}
              </Select>
            </FormControl>
            <FormControl>
              <FormControl.Label>ISR/ESG profile</FormControl.Label>
              <Select
                value={esgId}
                onChange={(e) => setEsgId(e.target.value)}
                block
              >
                <Select.Option value="">— None —</Select.Option>
                {esgProfilesQuery.data?.map((p) => (
                  <Select.Option key={p.id} value={String(p.id)}>
                    {p.name}
                  </Select.Option>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}

        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 2,
            pt: 3,
            borderTopWidth: 1,
            borderTopStyle: "solid",
            borderTopColor: "border.default",
          }}
        >
          <Button type="button" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={mutation.isPending || loading}
          >
            {mutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}

// ---- Contract edit modal ---------------------------------------------------

function ContractEditDialog({
  row,
  clientDocumentId,
  onClose,
}: {
  row: ContractRow;
  clientDocumentId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(row._contract.date ?? "");
  const [customRate, setCustomRate] = useState(
    row._contract.custom_rate == null ? "" : String(row._contract.custom_rate)
  );
  const [customVat, setCustomVat] = useState(
    row._contract.custom_vat == null ? "" : String(row._contract.custom_vat)
  );
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: () =>
      updateContract(row.documentId, {
        date: date.trim() || null,
        custom_rate: customRate.trim() === "" ? null : Number(customRate),
        custom_vat: customVat.trim() === "" ? null : Number(customVat),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["clients", "detail", clientDocumentId],
      });
      onClose();
    },
    onError: (err) => {
      if (err instanceof StrapiError) setError(err.message);
      else setError("Could not save the contract. Please try again.");
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Date: accept empty (nullable) or YYYY-MM-DD
    const trimmed = date.trim();
    if (trimmed && !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      setError("Date must be in YYYY-MM-DD format.");
      return;
    }

    // Numeric inputs must be valid numbers or empty
    for (const [label, v] of [
      ["Custom rate", customRate],
      ["Custom VAT", customVat],
    ] as const) {
      if (v.trim() === "") continue;
      if (Number.isNaN(Number(v))) {
        setError(`${label} must be a number.`);
        return;
      }
    }

    mutation.mutate();
  }

  // Keyboard shortcuts — belt-and-suspenders: listen at window level in
  // capture phase so nothing downstream can swallow them (Primer TextInput
  // sometimes stops Escape from propagating).
  //   - Cmd/Ctrl + Enter → submit
  //   - Escape          → close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        e.stopPropagation();
        formRef.current?.requestSubmit();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true); // capture
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  // Move focus away from the pencil button as soon as the modal opens.
  useEffect(() => {
    dateInputRef.current?.focus();
  }, []);

  return (
    <Modal
      title={`Edit contract · ${row.insurer} — ${row.product}`}
      onClose={onClose}
    >
      <Box as="form" ref={formRef} onSubmit={onSubmit}>
        {error && (
          <Flash variant="danger" sx={{ mb: 3 }}>
            {error}
          </Flash>
        )}

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 3,
            mb: 4,
          }}
        >
          <FormControl>
            <FormControl.Label>Contract date</FormControl.Label>
            <TextInput
              ref={dateInputRef}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder="YYYY-MM-DD"
              block
              size="large"
            />
            <FormControl.Caption>Opening date of the contract.</FormControl.Caption>
          </FormControl>

          <FormControl>
            <FormControl.Label>Custom rate (%)</FormControl.Label>
            <TextInput
              value={customRate}
              onChange={(e) => setCustomRate(e.target.value)}
              placeholder={`Default: ${row._contract.product?.envelope?.base_rate ?? "—"}`}
              block
              size="large"
              inputMode="decimal"
            />
            <FormControl.Caption>Leave empty to use the default rate.</FormControl.Caption>
          </FormControl>

          <FormControl>
            <FormControl.Label>Custom VAT (%)</FormControl.Label>
            <TextInput
              value={customVat}
              onChange={(e) => setCustomVat(e.target.value)}
              placeholder={`Default: ${row._contract.product?.envelope?.base_vat ?? "—"}`}
              block
              size="large"
              inputMode="decimal"
            />
            <FormControl.Caption>Leave empty to use the default VAT.</FormControl.Caption>
          </FormControl>
        </Box>

        <Box
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 2,
            pt: 3,
            borderTopWidth: 1,
            borderTopStyle: "solid",
            borderTopColor: "border.default",
          }}
        >
          <Button type="button" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}

// ---- small presentational helpers ------------------------------------------

function InfoCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "border.default",
        borderRadius: 2,
        p: 3,
        bg: "canvas.default",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 2,
        }}
      >
        <Heading as="h4" sx={{ fontSize: 2 }}>
          {title}
        </Heading>
        {action}
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>{children}</Box>
    </Box>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: 1 }}>
      <Text sx={{ color: "fg.muted" }}>{label}</Text>
      <Text>{value}</Text>
    </Box>
  );
}

function Stat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <Box
      sx={{
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: emphasis ? "accent.emphasis" : "border.default",
        borderRadius: 2,
        p: 2,
        bg: emphasis ? "accent.subtle" : "canvas.default",
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
      <Text
        sx={{
          display: "block",
          fontSize: 2,
          fontWeight: emphasis ? "bold" : 600,
          mt: 1,
        }}
      >
        {value}
      </Text>
    </Box>
  );
}
