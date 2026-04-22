import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import {
  Box,
  Button,
  Flash,
  FormControl,
  Heading,
  IconButton,
  Label,
  Select,
  Spinner,
  Text,
  TextInput,
} from "@primer/react";
import { DataTable, Table } from "@primer/react/experimental";
import {
  PencilIcon,
  PlusIcon,
  TrashIcon,
  CopyIcon,
  CheckIcon,
  XIcon,
  ChevronRightIcon,
  SearchIcon,
} from "@primer/octicons-react";
import { listInsurers } from "@/api/insurers";
import { listProducts } from "@/api/products";
import { listRiskProfiles } from "@/api/profiles";
import {
  getLatestTarget,
  replaceLatestTarget,
  type CreateTargetInput,
} from "@/api/allocation-targets";
import { listClientsForArbitrage } from "@/api/clients";
import { createSupport, listSupports } from "@/api/supports";
import {
  createArbitrage,
  findArbitrageByContract,
  updateArbitrage,
} from "@/api/arbitrages";
import { StrapiError } from "@/api/client";
import { Modal } from "@/components/modal/Modal";
import {
  CLICKABLE_ROWS_SX,
  hasSelection,
  isInteractiveClick,
  rowIndexFromClick,
} from "@/lib/clickable-rows";
import { formatDate, formatEuro, formatPercent } from "@/lib/format";
import { computeDiff } from "@/lib/allocation-diff";
import type {
  Allocation,
  AllocationTarget,
  Arbitrage,
  Client,
  Contract,
  RiskProfile,
  Support,
} from "@/types/strapi";

// ---------------------------------------------------------------------------

export function ArbitragePage() {
  const [insurerId, setInsurerId] = useState<string>("");
  const [productId, setProductId] = useState<string>("");
  const [riskProfileId, setRiskProfileId] = useState<string>("");
  const [editOpen, setEditOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<{
    client: Client;
    contract: Contract;
  } | null>(null);

  const insurersQuery = useQuery({
    queryKey: ["insurers"],
    queryFn: listInsurers,
  });
  const productsQuery = useQuery({
    queryKey: ["products", insurerId || "all"],
    queryFn: () => listProducts(insurerId || null),
  });
  const riskProfilesQuery = useQuery({
    queryKey: ["risk-profiles"],
    queryFn: listRiskProfiles,
  });

  const ready = Boolean(productId && riskProfileId);

  const targetQuery = useQuery({
    queryKey: ["allocation-target", productId, riskProfileId],
    queryFn: () => getLatestTarget(productId, riskProfileId),
    enabled: ready,
  });

  const clientsQuery = useQuery({
    queryKey: ["arbitrage-clients", productId, riskProfileId],
    queryFn: () => listClientsForArbitrage(productId, riskProfileId),
    enabled: ready,
  });

  // Reset cascading state when a step is changed/reset
  function pickInsurer(v: string) {
    setInsurerId(v);
    setProductId("");
    setRiskProfileId("");
  }
  function pickProduct(v: string) {
    setProductId(v);
    setRiskProfileId("");
  }
  function pickRiskProfile(v: string) {
    setRiskProfileId(v);
  }

  const insurer = useMemo(
    () => insurersQuery.data?.find((i) => String(i.id) === insurerId),
    [insurersQuery.data, insurerId]
  );
  const product = useMemo(
    () => productsQuery.data?.find((p) => String(p.id) === productId),
    [productsQuery.data, productId]
  );
  const riskProfile: RiskProfile | undefined = useMemo(
    () => riskProfilesQuery.data?.find((p) => String(p.id) === riskProfileId),
    [riskProfilesQuery.data, riskProfileId]
  );

  // Step: 1 = pick insurer, 2 = pick product, 3 = pick risk, 4 = ready
  const currentStep = !insurerId ? 1 : !productId ? 2 : !riskProfileId ? 3 : 4;

  return (
    <Box>
      <Heading as="h2" sx={{ fontSize: 4, mb: 1 }}>
        Arbitrage
      </Heading>
      <Text sx={{ color: "fg.muted", fontSize: 1, display: "block", mb: 4 }}>
        Pick an insurer, product and risk profile to view or edit its target
        allocation, and arbitrate the clients matching those criteria.
      </Text>

      {/* Breadcrumb of completed steps — click any chip to rewind */}
      {currentStep > 1 && (
        <Box
          sx={{
            display: "flex",
            gap: 2,
            alignItems: "center",
            flexWrap: "wrap",
            mb: 3,
          }}
        >
          <StepChip
            label="Insurer"
            value={insurer?.name ?? ""}
            onClear={() => pickInsurer("")}
          />
          {currentStep > 2 && (
            <>
              <ChevronRightIcon size={12} />
              <StepChip
                label="Product"
                value={product?.name ?? ""}
                onClear={() => pickProduct("")}
              />
            </>
          )}
          {currentStep > 3 && (
            <>
              <ChevronRightIcon size={12} />
              <StepChip
                label="Risk profile"
                value={riskProfile?.name ?? ""}
                onClear={() => pickRiskProfile("")}
              />
            </>
          )}
        </Box>
      )}

      {/* Current step card */}
      {currentStep === 1 && (
        <StepCard
          step={1}
          title="Choose an insurer"
          hint="The product list below will be filtered by the insurer you pick."
        >
          <Select
            value={insurerId}
            onChange={(e) => pickInsurer(e.target.value)}
            block
          >
            <Select.Option value="">— Choose an insurer —</Select.Option>
            {insurersQuery.data?.map((i) => (
              <Select.Option key={i.id} value={String(i.id)}>
                {i.name}
              </Select.Option>
            ))}
          </Select>
        </StepCard>
      )}

      {currentStep === 2 && (
        <StepCard
          step={2}
          title={`Choose a product from ${insurer?.name ?? ""}`}
          hint="Only products tied to the selected insurer are listed."
        >
          <Select
            value={productId}
            onChange={(e) => pickProduct(e.target.value)}
            block
            disabled={productsQuery.isLoading}
          >
            <Select.Option value="">— Choose a product —</Select.Option>
            {productsQuery.data?.map((p) => (
              <Select.Option key={p.id} value={String(p.id)}>
                {p.name}
              </Select.Option>
            ))}
          </Select>
          {productsQuery.data && productsQuery.data.length === 0 && (
            <Text sx={{ fontSize: 1, color: "fg.muted", mt: 2, display: "block" }}>
              No product under this insurer.
            </Text>
          )}
        </StepCard>
      )}

      {currentStep === 3 && (
        <StepCard
          step={3}
          title="Choose a risk profile"
          hint="The allocation target is defined per product × risk profile."
        >
          <Select
            value={riskProfileId}
            onChange={(e) => pickRiskProfile(e.target.value)}
            block
          >
            <Select.Option value="">— Choose a risk profile —</Select.Option>
            {riskProfilesQuery.data?.map((p) => (
              <Select.Option key={p.id} value={String(p.id)}>
                {p.name}
              </Select.Option>
            ))}
          </Select>
        </StepCard>
      )}

      {ready && (
        <>
          {/* Current target */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 2,
            }}
          >
            <Heading as="h3" sx={{ fontSize: 3 }}>
              Allocation target
            </Heading>
            <Button
              size="small"
              leadingVisual={targetQuery.data ? PencilIcon : PlusIcon}
              disabled={targetQuery.isLoading}
              onClick={() => setEditOpen(true)}
            >
              {targetQuery.data ? "Edit target" : "Create target"}
            </Button>
          </Box>

          <TargetCard query={targetQuery} />

          {/* Clients */}
          <Heading as="h3" sx={{ fontSize: 3, mt: 4, mb: 2 }}>
            Clients to arbitrate
          </Heading>
          <ClientsTable
            query={clientsQuery}
            productId={productId}
            currentTargetId={targetQuery.data?.id ?? null}
            onPick={(client, contract) =>
              setSelectedClient({ client, contract })
            }
          />
        </>
      )}

      {editOpen && product && riskProfile && (
        <TargetEditorDialog
          product={product}
          riskProfile={riskProfile}
          current={targetQuery.data ?? null}
          onClose={() => setEditOpen(false)}
        />
      )}

      {selectedClient && targetQuery.data && (
        <ClientDiffDialog
          client={selectedClient.client}
          contract={selectedClient.contract}
          target={targetQuery.data}
          onClose={() => setSelectedClient(null)}
        />
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------

function TargetCard({
  query,
}: {
  query: ReturnType<typeof useQuery<AllocationTarget | null>>;
}) {
  if (query.isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <Spinner size="small" />
      </Box>
    );
  }
  if (query.isError) {
    return (
      <Flash variant="danger">
        Failed to load the allocation target: {(query.error as Error).message}
      </Flash>
    );
  }
  const target = query.data;
  if (!target) {
    return (
      <Box sx={{ p: 3, bg: "canvas.subtle", borderRadius: 2 }}>
        <Text sx={{ color: "fg.muted", fontSize: 1 }}>
          No target defined yet for this combination.
        </Text>
      </Box>
    );
  }

  const rows = (target.targets ?? []).map((t, i) => ({
    id: t.id ?? i,
    isin: t.support?.ISIN ?? t.support?.code ?? "—",
    name: t.support?.name ?? "—",
    repartition: t.repartition ?? 0,
    note: t.note ?? "",
  }));

  return (
    <Table.Container>
      <DataTable
        aria-label="Target allocation"
        data={rows}
        columns={[
          {
            header: "ISIN",
            field: "isin",
            rowHeader: true,
            renderCell: (r) => (
              <Text sx={{ fontFamily: "mono" }}>{r.isin}</Text>
            ),
          },
          { header: "Name", field: "name" },
          {
            header: "Repartition",
            field: "repartition",
            renderCell: (r) => (
              <Text sx={{ fontWeight: "bold" }}>
                {formatPercent(r.repartition)}
              </Text>
            ),
          },
          {
            header: "Note",
            field: "note",
            renderCell: (r) =>
              r.note ? (
                r.note
              ) : (
                <Text sx={{ color: "fg.muted" }}>—</Text>
              ),
          },
        ]}
      />
    </Table.Container>
  );
}

// ---------------------------------------------------------------------------

interface ClientRow {
  documentId: string;
  name: string;
  contractLabel: string;
  amount: number;
  /** Contract has a stored arbitrage whose allocation_target differs
   *  from the current latest. Drives the strike-through sync icon. */
  arbOutOfSync: boolean;
  /** Kept for the row-click handler */
  _client: Client;
  _contract: Contract;
}

function ClientsTable({
  query,
  productId,
  onPick,
  currentTargetId,
}: {
  query: ReturnType<typeof useQuery<Client[]>>;
  productId: string;
  onPick: (client: Client, contract: Contract) => void;
  /** Id of the latest allocation target for the current (product, risk
   *  profile). Contracts whose stored arbitrage references a different
   *  allocation_target are flagged with a strike-through sync icon so
   *  the advisor can tell at a glance that the arbitrage is out of
   *  date. */
  currentTargetId: number | null;
}) {
  if (query.isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <Spinner />
      </Box>
    );
  }
  if (query.isError) {
    return (
      <Flash variant="danger">
        Failed to load clients: {(query.error as Error).message}
      </Flash>
    );
  }

  const rows: ClientRow[] = [];
  for (const client of query.data ?? []) {
    for (const account of client.accounts ?? []) {
      for (const contract of account.contracts ?? []) {
        if (String(contract.product?.id ?? "") !== productId) continue;
        const amount = (contract.allocations ?? [])
          .filter((a) => a.latest)
          .reduce((s, a) => s + (a.quantity ?? 0) * (a.value ?? 0), 0);
        const arb = contract.arbitrage;
        const arbOutOfSync = !!(
          arb &&
          currentTargetId != null &&
          arb.allocation_target?.id !== currentTargetId
        );
        rows.push({
          documentId: `${client.documentId}:${contract.documentId}`,
          name: `${client.lastname.toUpperCase()} ${client.firstname}`,
          contractLabel: `${account.insurer?.name ?? "—"} · ${
            contract.code ?? "—"
          }`,
          amount,
          arbOutOfSync,
          _client: client,
          _contract: contract,
        });
      }
    }
  }

  if (rows.length === 0) {
    return (
      <Box sx={{ p: 3, bg: "canvas.subtle", borderRadius: 2 }}>
        <Text sx={{ color: "fg.muted", fontSize: 1 }}>
          No client matches this product + risk profile combination.
        </Text>
      </Box>
    );
  }

  return (
    <Box
      sx={CLICKABLE_ROWS_SX}
      onClickCapture={(e: MouseEvent<HTMLElement>) => {
        if (hasSelection() || isInteractiveClick(e)) return;
        const idx = rowIndexFromClick(e);
        if (idx === null) return;
        const row = rows[idx];
        if (row) onPick(row._client, row._contract);
      }}
    >
      <Table.Container>
        <DataTable<ClientRow>
          aria-label="Clients to arbitrate"
          data={rows}
          columns={[
            { header: "Client", field: "name", rowHeader: true },
            { header: "Contract", field: "contractLabel" },
            {
              header: "Portfolio",
              field: "amount",
              renderCell: (r) => formatEuro(r.amount),
            },
            {
              header: "",
              field: "arbOutOfSync",
              align: "end",
              renderCell: (r) => (
                <Box
                  sx={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "flex-end",
                  }}
                >
                  {r.arbOutOfSync && <SyncStrikedIcon />}
                </Box>
              ),
            },
          ]}
        />
      </Table.Container>
    </Box>
  );
}

// ---------------------------------------------------------------------------

interface EditorRow {
  support: string; // support id as string
  repartition: string;
  note: string;
}

function TargetEditorDialog({
  product,
  riskProfile,
  current,
  onClose,
}: {
  product: { id: number; name: string };
  riskProfile: { id: number; name: string };
  current: AllocationTarget | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const supportsQuery = useQuery({
    queryKey: ["supports", "list"],
    queryFn: listSupports,
  });

  const initial: EditorRow[] = useMemo(() => {
    if (!current || !current.targets) return [{ support: "", repartition: "", note: "" }];
    return current.targets.map((t) => ({
      support: t.support?.id ? String(t.support.id) : "",
      repartition: String(t.repartition ?? ""),
      note: t.note ?? "",
    }));
  }, [current]);

  const [rows, setRows] = useState<EditorRow[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const totalPct = rows.reduce((s, r) => {
    const n = Number(r.repartition);
    return s + (Number.isNaN(n) ? 0 : n);
  }, 0);

  const mutation = useMutation({
    mutationFn: async () => {
      const data: Omit<CreateTargetInput, "latest"> = {
        product: product.id,
        risk_profile: riskProfile.id,
        date: todayIso(),
        targets: rows
          .filter((r) => r.support && r.repartition)
          .map((r) => ({
            support: Number(r.support),
            repartition: Number(r.repartition),
            note: r.note.trim() || null,
          })),
      };
      return replaceLatestTarget(current, data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["allocation-target", String(product.id), String(riskProfile.id)],
      });
      onClose();
    },
    onError: (err) => {
      if (err instanceof StrapiError) setError(err.message);
      else setError("Could not save the target. Please try again.");
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const filled = rows.filter((r) => r.support && r.repartition);
    if (filled.length === 0) {
      setError("Add at least one support.");
      return;
    }
    for (const r of filled) {
      if (Number.isNaN(Number(r.repartition))) {
        setError("Repartitions must be numbers.");
        return;
      }
    }
    if (Math.abs(totalPct - 100) > 0.01) {
      setError(`Repartitions must total 100 % (currently ${totalPct.toFixed(2)} %).`);
      return;
    }
    mutation.mutate();
  }

  // Shortcuts
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

  return (
    <Modal
      title={`${current ? "Edit" : "Create"} target · ${product.name} · ${riskProfile.name}`}
      onClose={onClose}
    >
      <Box as="form" ref={formRef} onSubmit={onSubmit}>
        {error && (
          <Flash variant="danger" sx={{ mb: 3 }}>
            {error}
          </Flash>
        )}

        {supportsQuery.isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <Spinner />
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mb: 3 }}>
            {rows.map((row, i) => (
              <Box
                key={i}
                sx={{
                  display: "grid",
                  gridTemplateColumns: "2fr 140px 1fr 40px",
                  gap: 2,
                  alignItems: "end",
                }}
              >
                <FormControl>
                  {i === 0 && <FormControl.Label>Support</FormControl.Label>}
                  <SupportPicker
                    value={row.support}
                    supports={supportsQuery.data ?? []}
                    disabledIds={
                      new Set(
                        rows
                          .filter((r, j) => j !== i && r.support)
                          .map((r) => r.support)
                      )
                    }
                    onPick={(id) =>
                      setRows((prev) => {
                        const next = [...prev];
                        next[i] = { ...next[i], support: String(id) };
                        return next;
                      })
                    }
                  />
                </FormControl>

                <FormControl>
                  {i === 0 && <FormControl.Label>Repartition (%)</FormControl.Label>}
                  <TextInput
                    value={row.repartition}
                    onChange={(e) =>
                      setRows((prev) => {
                        const next = [...prev];
                        next[i] = { ...next[i], repartition: e.target.value };
                        return next;
                      })
                    }
                    placeholder="0.00"
                    inputMode="decimal"
                    block
                  />
                </FormControl>

                <FormControl>
                  {i === 0 && <FormControl.Label>Note (optional)</FormControl.Label>}
                  <TextInput
                    value={row.note}
                    onChange={(e) =>
                      setRows((prev) => {
                        const next = [...prev];
                        next[i] = { ...next[i], note: e.target.value };
                        return next;
                      })
                    }
                    block
                  />
                </FormControl>

                <IconButton
                  icon={TrashIcon}
                  aria-label="Remove row"
                  size="small"
                  disabled={rows.length === 1}
                  onClick={() =>
                    setRows((prev) => prev.filter((_, j) => j !== i))
                  }
                />
              </Box>
            ))}

            <Box>
              <Button
                type="button"
                size="small"
                leadingVisual={PlusIcon}
                onClick={() =>
                  setRows((prev) => [
                    ...prev,
                    { support: "", repartition: "", note: "" },
                  ])
                }
              >
                Add support
              </Button>
            </Box>
          </Box>
        )}

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            pt: 3,
            borderTopWidth: 1,
            borderTopStyle: "solid",
            borderTopColor: "border.default",
          }}
        >
          <Text
            sx={{
              color: Math.abs(totalPct - 100) < 0.01 ? "success.fg" : "attention.fg",
              fontSize: 1,
              fontWeight: "bold",
            }}
          >
            Total: {formatPercent(totalPct)}{" "}
            {Math.abs(totalPct - 100) < 0.01 ? "✓" : "(target 100 %)"}
          </Text>
          <Box sx={{ display: "flex", gap: 2 }}>
            <Button type="button" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Saving…" : "Save target"}
            </Button>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

/**
 * Persisted-arbitrage view.
 *
 * The modal no longer recomputes the BUY/SELL diff every time the user
 * clicks a client. Instead it fetches the Arbitrage row linked 1:1 to
 * the contract:
 *   - if one exists → display its stored actions (plus the email draft
 *     button).
 *   - if none → show a centered "Generate arbitrage" button. On click,
 *     we run the same computeDiff() math we had before, persist it as
 *     an Arbitrage (with contract + allocation_target relations), and
 *     the query refetches so the user sees the result.
 *
 * Rationale: computing an arbitrage is a deliberate action, and the
 * result needs to be stable once the advisor shares it with the client.
 * Persisting it also lets us surface it elsewhere (contract detail page,
 * history) without re-running the math.
 */
function ClientDiffDialog({
  client,
  contract,
  target,
  onClose,
}: {
  client: Client;
  contract: Contract;
  target: AllocationTarget;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const latest: Allocation[] = (contract.allocations ?? []).filter((a) => a.latest);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  /**
   * When there's no arbitrage yet, the editor shows automatically with a
   * fresh seed. When an arbitrage exists, the user sees the display view
   * by default and can flip to the editor via the Update button. From
   * inside the editor, the user can choose to sync with the latest
   * allocation target (when the stored one is stale) — that's handled
   * via a row-replacement inside the editor, not a mode switch here.
   */
  const [editing, setEditing] = useState(false);

  const arbQuery = useQuery({
    queryKey: ["arbitrage-by-contract", contract.documentId],
    queryFn: () => findArbitrageByContract(contract.documentId),
    staleTime: 30_000,
  });

  // The editor builds the action list (BUY/SELL) from the user's
  // customised allocation, then calls one of these mutations with the
  // final actions. Keeping the mutations dumb (no diff math inside)
  // means the same persistence path works for "generate from target"
  // and "generate from manual tweaks" alike.
  const createMutation = useMutation({
    mutationFn: (
      actions: Array<{ action: "buy" | "sell"; amount: number; support: number }>
    ) =>
      createArbitrage({
        date: new Date().toISOString().slice(0, 10),
        contract: contract.id,
        allocation_target: target.id,
        arbitrages: actions,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["arbitrage-by-contract", contract.documentId],
      });
      // The clients list carries each contract's arbitrage + its
      // allocation_target, which drives the strike-through sync icon
      // in the ClientsTable. Saving means that icon must disappear for
      // this contract — refetch so the next render has fresh data.
      queryClient.invalidateQueries({ queryKey: ["arbitrage-clients"] });
      setEditing(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (
      actions: Array<{ action: "buy" | "sell"; amount: number; support: number }>
    ) => {
      const arb = arbQuery.data;
      if (!arb) throw new Error("No arbitrage to update.");
      return updateArbitrage(arb.documentId, {
        date: new Date().toISOString().slice(0, 10),
        allocation_target: target.id,
        arbitrages: actions,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["arbitrage-by-contract", contract.documentId],
      });
      queryClient.invalidateQueries({ queryKey: ["arbitrage-clients"] });
      setEditing(false);
    },
  });

  /** Reshape the stored arbitrage into the row shape the table and email
   *  template expect. Keeps SELL-then-BUY order (matches the email). */
  const rows = useMemo(() => {
    const arb = arbQuery.data;
    if (!arb?.arbitrages) return [];
    return arb.arbitrages
      .map((a) => ({
        action: (a.action === "sell" ? "SELL" : "BUY") as "SELL" | "BUY",
        isin: a.support?.ISIN ?? a.support?.code ?? "—",
        name: a.support?.name ?? "—",
        amount: a.amount,
      }))
      .sort((x, y) => {
        // SELL first (matches "Nous vendons / Nous achetons" template).
        if (x.action !== y.action) return x.action === "SELL" ? -1 : 1;
        return x.name.localeCompare(y.name);
      });
  }, [arbQuery.data]);

  const buyTotal = rows
    .filter((r) => r.action === "BUY")
    .reduce((s, r) => s + r.amount, 0);
  const sellTotal = rows
    .filter((r) => r.action === "SELL")
    .reduce((s, r) => s + r.amount, 0);

  async function copyEmail() {
    const productName =
      target.product?.name ?? contract.product?.name ?? "";
    const profileName = target.risk_profile?.name ?? "";

    const sellItems = rows
      .filter((r) => r.action === "SELL")
      .map((r) => `<li>${r.name} (${r.isin}) pour ${formatEuro(r.amount)}</li>`)
      .join("");

    const buyItems = rows
      .filter((r) => r.action === "BUY")
      .map((r) => `<li>${r.name} (${r.isin}) pour ${formatEuro(r.amount)}</li>`)
      .join("");

    const html = `
<p>Bonjour ${client.firstname},</p>

<p>Comme évoqué lors de nos récents échanges, je vous adresse une proposition d'arbitrage concernant votre contrat ${productName} afin de l'optimiser et de le sécuriser.<br>
Charles a préparé une explication détaillée de cette nouvelle allocation. </p>

<p><b>Détail de l'opération proposée :</b></p>

<p><b>Nous vendons :</b></p>

<ul>
${sellItems}
</ul>

<p><b>Nous achetons :</b></p>

<ul>
${buyItems}
</ul>

<p><b>Pourquoi cet arbitrage ? (Le mot du gérant) :</b></p>

<p>Explication macro-économique de Charles - ex: Sécuriser des gains, profiter d'une décote, réallouer la poche cash, etc.]</p>

<p><b>Adéquation à votre profil & Risques :</b></p>

<p>Cette nouvelle stratégie est parfaitement en adéquation avec votre profil d'investisseur (${profileName}), votre horizon de placement et votre capacité à subir des pertes. [Optionnel si pertinent : Elle respecte également vos critères ESG / préférences en matière de durabilité.]
<br><i>Nous vous rappelons que les supports en unités de compte (UC) présentent un risque de perte en capital, leur valeur fluctuant à la hausse comme à la baisse en fonction de l'évolution des marchés financiers.</i></p>

<p><b>Frais et fiscalité :</b></p>
<p>Cet arbitrage est réalisé au sein de l'enveloppe de votre assurance-vie, il n'a donc aucun impact fiscal immédiat. Je vous confirme également que cette opération n'engendrera aucun frais supplémentaire ([ou préciser si frais assureur : ex. 0,5% de frais d'arbitrage prélevés par l'assureur]).</p>

<p><b>Documentation réglementaire :</b></p>
<p>Pour que vous puissiez prendre votre décision de manière éclairée, vous trouverez en pièce jointe les Documents d'Informations Clés (DIC) des nouveaux supports proposés. Je vous invite à en prendre connaissance.</p>

<p><b>Pour valider cette opération :</b></p>
<p>Il s'agit d'une demande de signature électronique. Dès réception de votre validation via le lien sécurisé envoyé par [Nom du prestataire : ex. Universign / Assureur], nous procéderons à l'exécution de l'ordre.</p>

<p>Je reste à votre entière disposition si vous souhaitez ajuster les montants ou poser des questions avant de signer.</p>

<p>Vous souhaitant une excellente journée,</p>`;

    setCopyError(null);

    // Strategy 1 — modern Async Clipboard API with HTML + plain-text fallbacks
    try {
      const htmlBlob = new Blob([html], { type: "text/html" });
      const textBlob = new Blob([html.replace(/<[^>]+>/g, "")], {
        type: "text/plain",
      });
      await navigator.clipboard.write([
        new ClipboardItem({ "text/html": htmlBlob, "text/plain": textBlob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      return;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[fino] Clipboard API write failed, falling back to DOM copy", err);
    }

    // Strategy 2 — execCommand("copy") on a temporary rich-text selection.
    // This reliably produces an HTML-rich clipboard payload even on older
    // Electron builds where ClipboardItem is not exposed.
    try {
      const container = document.createElement("div");
      container.innerHTML = html;
      container.setAttribute(
        "style",
        "position:fixed;left:-9999px;top:-9999px;white-space:pre-wrap;"
      );
      document.body.appendChild(container);

      const range = document.createRange();
      range.selectNodeContents(container);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      const ok = document.execCommand("copy");

      selection?.removeAllRanges();
      document.body.removeChild(container);

      if (!ok) throw new Error("execCommand returned false");

      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      return;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[fino] Fallback copy failed", err);
      setCopyError(
        "Could not copy to clipboard automatically. Check the console for details."
      );
    }
  }

  const arbitrage = arbQuery.data;

  return (
    <Modal
      title={`Arbitrage · ${client.firstname} ${client.lastname}`}
      onClose={onClose}
    >
      {arbQuery.isLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
          <Spinner />
        </Box>
      )}

      {arbQuery.isError && (
        <Flash variant="danger">
          Failed to load arbitrage: {(arbQuery.error as Error).message}
        </Flash>
      )}

      {/* Fresh editor — no arbitrage yet, default entry point. */}
      {arbQuery.isSuccess && !arbitrage && (
        <ArbitrageEditor
          mutation={createMutation}
          contract={contract}
          target={target}
          latest={latest}
          onCancel={onClose}
          saveLabel="Save arbitrage"
        />
      )}

      {/* Update mode — user clicked "Update" on an existing arbitrage. The
          editor seeds from the stored actions so the advisor can tweak.
          The "sync latest target" button is inside the editor, not here. */}
      {arbQuery.isSuccess && arbitrage && editing && (
        <ArbitrageEditor
          mutation={updateMutation}
          contract={contract}
          target={target}
          latest={latest}
          onCancel={() => setEditing(false)}
          saveLabel="Save arbitrage"
          initialRows={buildRowsFromArbitrage(
            arbitrage,
            latest,
            target,
            sumPortfolio(latest)
          )}
          onSyncLatestTarget={
            arbitrage.allocation_target &&
            arbitrage.allocation_target.id !== target.id
              ? async () => {
                  // Hit the network for the freshest latest target —
                  // the cached `target` prop can lag behind if the
                  // advisor edited it in another session/tab. Without
                  // this refetch, new target lines (added after the
                  // cache was populated) wouldn't land in the editor.
                  const productId = target.product?.id;
                  const riskProfileId = target.risk_profile?.id;
                  let freshest: AllocationTarget | null = null;
                  if (productId != null && riskProfileId != null) {
                    freshest = await getLatestTarget(productId, riskProfileId);
                    // Keep the app-level cache in sync so the display-
                    // mode banner reflects reality after save.
                    if (freshest) {
                      queryClient.setQueryData(
                        [
                          "allocation-target",
                          String(productId),
                          String(riskProfileId),
                        ],
                        freshest
                      );
                    }
                  }
                  return buildResetToTargetRows(
                    arbitrage,
                    latest,
                    freshest ?? target,
                    sumPortfolio(latest)
                  );
                }
              : undefined
          }
        />
      )}

      {/* Display mode — stats + table + Update / Copy / Close. */}
      {arbQuery.isSuccess && arbitrage && !editing && (
        <>
          {/* Stale-target warning: the arbitrage stores the allocation
              target it was generated against. If the risk profile's
              latest target has moved on since (i.e. the id passed via
              props is different), surface it so the advisor knows the
              stored actions may not reflect the current recommendation. */}
          {arbitrage.allocation_target &&
            arbitrage.allocation_target.id !== target.id && (
              <Flash variant="warning" sx={{ mb: 3 }}>
                This arbitrage was generated against an older allocation
                target. The risk profile's target has been updated since —
                the stored actions may no longer match the current
                recommendation.
              </Flash>
            )}

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 2,
              mb: 3,
            }}
          >
            <Stat label="Contract" value={contract.code ?? "—"} />
            <Stat
              label="Generated on"
              value={arbitrage.date ? formatDate(arbitrage.date) : "—"}
            />
            <Stat label="To buy" value={formatEuro(buyTotal)} tone="success" />
            <Stat label="To sell" value={formatEuro(sellTotal)} tone="danger" />
          </Box>

          {rows.length === 0 ? (
            <Box
              sx={{
                p: 4,
                bg: "canvas.subtle",
                borderRadius: 2,
                textAlign: "center",
              }}
            >
              <Text sx={{ color: "fg.muted" }}>
                This arbitrage has no actions — current allocation already
                matches the target.
              </Text>
            </Box>
          ) : (
            <Table.Container>
              <DataTable
                aria-label="Arbitrage plan"
                data={rows}
                columns={[
                  {
                    header: "Action",
                    field: "action",
                    renderCell: (r) => (
                      <Label variant={actionVariant(r.action)}>{r.action}</Label>
                    ),
                  },
                  {
                    header: "ISIN",
                    field: "isin",
                    renderCell: (r) => (
                      <Text sx={{ fontFamily: "mono" }}>{r.isin}</Text>
                    ),
                  },
                  { header: "Name", field: "name" },
                  {
                    header: "Amount",
                    field: "amount",
                    renderCell: (r) => (
                      <Text
                        sx={{
                          fontWeight: "bold",
                          color: r.action === "BUY" ? "success.fg" : "danger.fg",
                        }}
                      >
                        {formatEuro(r.amount)}
                      </Text>
                    ),
                  },
                ]}
              />
            </Table.Container>
          )}

          {copyError && (
            <Flash variant="danger" sx={{ mt: 3 }}>
              {copyError}
            </Flash>
          )}

          {/* Display-mode footer. The editor draws its own Cancel/Save. */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 2,
              pt: 3,
              mt: 3,
              borderTopWidth: 1,
              borderTopStyle: "solid",
              borderTopColor: "border.default",
            }}
          >
            {/* Left-aligned: edit actions on the arbitrage itself. The
                "sync latest target" affordance now lives inside the
                editor — it's only relevant once you're customising. */}
            <Box sx={{ display: "flex", gap: 2 }}>
              <Button
                leadingVisual={PencilIcon}
                onClick={() => setEditing(true)}
              >
                Update
              </Button>
            </Box>

            {/* Right-aligned: copy email + close. */}
            <Box sx={{ display: "flex", gap: 2 }}>
              {rows.length > 0 && (
                <Button
                  leadingVisual={copied ? CheckIcon : CopyIcon}
                  onClick={copyEmail}
                  variant={copied ? "primary" : "default"}
                >
                  {copied ? "Copied!" : "Copy email draft"}
                </Button>
              )}
              <Button onClick={onClose}>Close</Button>
            </Box>
          </Box>
        </>
      )}
    </Modal>
  );
}

// ---- Arbitrage editor ------------------------------------------------------

/**
 * Live allocation editor. Builds a unified list of rows from:
 *   - the contract's current allocations (columns 2–3: read-only)
 *   - the risk-profile's allocation target (seeds the editable `newPercent`)
 *   - any row manually added by the advisor via the support picker
 *
 * The advisor can edit either the percentage OR the euro amount per row —
 * both fields are kept in sync through the underlying `newPercent`. Rows
 * can be removed (sets their "new" side to 0, implying a full sell if the
 * row was in the current portfolio) or re-added via a support picker.
 *
 * The portfolio value is held constant at the sum of current allocations
 * — we're rebalancing, not adding capital. The Save button is disabled
 * until the new percentages add up to exactly 100 % (±0.01).
 */
type EditorAction = { action: "buy" | "sell"; amount: number; support: number };

interface EditorRow {
  key: string; // stable react key
  support: Support;
  currentAmount: number;
  targetPercent: number;
  newPercent: number;
  /** True only for rows added manually via the support picker — these
   *  are the only ones the user can remove. Rows that come from the
   *  client's current allocations or from the risk-profile target are
   *  structural: we don't let the user drop them by accident. */
  manuallyAdded: boolean;
}

function ArbitrageEditor({
  mutation,
  contract: _contract,
  target,
  latest,
  onCancel,
  saveLabel = "Save arbitrage",
  initialRows,
  onSyncLatestTarget,
}: {
  mutation: UseMutationResult<Arbitrage, Error, EditorAction[], unknown>;
  contract: Contract;
  target: AllocationTarget;
  latest: Allocation[];
  onCancel: () => void;
  /** Button label in the footer — differs between fresh create and
   *  update on an existing arbitrage. */
  saveLabel?: string;
  /** Override the default (current+target) seeding, e.g. when editing
   *  an existing arbitrage we seed from its stored actions instead. */
  initialRows?: EditorRow[];
  /** When provided, a warning + "Sync latest target" button shows up at
   *  the top of the editor. Clicking it awaits this function and
   *  replaces the editor's rows with what it resolves to. Async so the
   *  parent can hit the network first to guarantee it's reading the
   *  freshest target (the cached `target` prop can lag behind if the
   *  advisor edited it in another tab or another session). Undefined
   *  means the arbitrage is already on the latest target (or this is
   *  a fresh-create flow). */
  onSyncLatestTarget?: () => Promise<EditorRow[]> | EditorRow[];
}) {
  // The reference portfolio value stays constant for the editor's
  // lifetime — editing percentages redistributes the same capital.
  const totalPortfolio = useMemo(
    () => latest.reduce((s, a) => s + (a.quantity ?? 0) * (a.value ?? 0), 0),
    [latest]
  );

  const [rows, setRows] = useState<EditorRow[]>(
    () => initialRows ?? buildInitialRows(latest, target, totalPortfolio)
  );

  // Draft strings for the two editable fields. While the user is typing
  // in one field, the other derives from the row's newPercent. When
  // either field parses successfully, we clear the OTHER field's draft
  // so it snaps back to the derived value.
  const [percentDrafts, setPercentDrafts] = useState<Record<string, string>>({});
  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});
  // Once the user has clicked Sync, the banner + button disappear for
  // the remainder of the edit session. The arbitrage's stored
  // `allocation_target.id` only updates on Save, so the parent still
  // considers the arbitrage stale until then — this local flag lets
  // us hide the nudge once the user has acknowledged it.
  const [hasSynced, setHasSynced] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const supportsQuery = useQuery({
    queryKey: ["supports", "list"],
    queryFn: listSupports,
  });

  function updateRow(key: string, patch: Partial<EditorRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function onPercentChange(key: string, draft: string) {
    setPercentDrafts((prev) => ({ ...prev, [key]: draft }));
    const n = parseFloat(draft.replace(",", "."));
    if (!Number.isNaN(n)) {
      updateRow(key, { newPercent: n });
      setAmountDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function onAmountChange(key: string, draft: string) {
    setAmountDrafts((prev) => ({ ...prev, [key]: draft }));
    const n = parseFloat(draft.replace(",", "."));
    if (!Number.isNaN(n) && totalPortfolio > 0) {
      updateRow(key, { newPercent: (n / totalPortfolio) * 100 });
      setPercentDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
    setPercentDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setAmountDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function addSupport(id: number | string) {
    const support = (supportsQuery.data ?? []).find(
      (s) => String(s.id) === String(id)
    );
    if (!support) return;
    // If the support is already in the editor, don't duplicate it —
    // just focus the row instead (cheap: re-render).
    if (rows.some((r) => r.support.id === support.id)) return;
    setRows((prev) => [
      ...prev,
      {
        key: `add-${support.id}-${Date.now()}`,
        support,
        currentAmount: 0,
        targetPercent: 0,
        newPercent: 0,
        manuallyAdded: true,
      },
    ]);
  }

  /**
   * Re-run the initial calculation from the CURRENTLY-cached target
   * (no network call — same reference point as when the editor first
   * opened). Manually-added rows from the current session are preserved
   * but their newPercent is reset to 0 — the advisor can re-enter a
   * value, or keep them at 0 which effectively means "drop on save".
   */
  function resetToTarget() {
    const structural = buildInitialRows(latest, target, totalPortfolio);
    const structuralKeys = new Set(structural.map((r) => r.key));
    // Carry over anything the user added manually (either via + Add
    // support this session OR reconstructed from an existing arbitrage's
    // manual lines) that isn't part of the target seed.
    const customLines = rows
      .filter((r) => r.manuallyAdded && !structuralKeys.has(r.key))
      .map((r) => ({ ...r, newPercent: 0 }));
    setRows([...structural, ...customLines]);
    setPercentDrafts({});
    setAmountDrafts({});
  }

  // Derived "is this editor in a non-trivial state vs. a fresh target
  // seed?". True whenever the current rows differ from what
  // `buildInitialRows(latest, target, ...)` would produce — covers both
  // session edits AND arbitrages loaded with existing stored diffs.
  // Comparison is by support key and newPercent (small epsilon for
  // floating-point tolerance).
  const isDirty = useMemo(() => {
    const fresh = buildInitialRows(latest, target, totalPortfolio);
    if (fresh.length !== rows.length) return true;
    const freshByKey = new Map(fresh.map((r) => [r.key, r]));
    for (const r of rows) {
      const f = freshByKey.get(r.key);
      if (!f) return true;
      if (Math.abs((r.newPercent ?? 0) - (f.newPercent ?? 0)) > 0.001) return true;
    }
    return false;
  }, [rows, latest, target, totalPortfolio]);

  // ---- Derived totals ---------------------------------------------------

  const sumPercent = rows.reduce((s, r) => s + r.newPercent, 0);
  const sumNewAmount = rows.reduce(
    (s, r) => s + (totalPortfolio * r.newPercent) / 100,
    0
  );
  const balanced = Math.abs(sumPercent - 100) < 0.01 || totalPortfolio === 0;

  // ---- Save handler -----------------------------------------------------

  function handleSave() {
    if (!balanced) return;
    const actions: EditorAction[] = [];
    for (const r of rows) {
      const newAmount = (totalPortfolio * r.newPercent) / 100;
      const diff = newAmount - r.currentAmount;
      if (Math.abs(diff) < 0.01) continue; // HOLD, nothing to persist
      actions.push({
        action: diff > 0 ? "buy" : "sell",
        amount: Math.abs(diff),
        support: r.support.id,
      });
    }
    mutation.mutate(actions);
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Stale-target banner — only shows when the parent flagged the
          arbitrage as desynced from the latest risk-profile target.
          Clicking the button replaces the editor's rows with the
          freshly-seeded version (current + latest target; manual lines
          carried at 0 %). The mutation still targets the same arbitrage
          documentId — the allocation_target relation is updated on save. */}
      {onSyncLatestTarget && !hasSynced && (
        <Flash variant="warning">
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 3,
            }}
          >
            <Text sx={{ fontSize: 1 }}>
              This arbitrage is based on an older allocation target.
            </Text>
            <Button
              variant="primary"
              onClick={async () => {
                const newRows = await onSyncLatestTarget();
                setRows(newRows);
                setPercentDrafts({});
                setAmountDrafts({});
                setHasSynced(true);
              }}
            >
              Sync latest target
            </Button>
          </Box>
        </Flash>
      )}

      {/* Balance summary */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 2,
        }}
      >
        <Stat label="Portfolio" value={formatEuro(totalPortfolio)} />
        <Stat
          label="Allocated"
          value={`${formatPercent(sumPercent)}`}
          tone={balanced ? "success" : "danger"}
        />
        <Stat
          label={balanced ? "Balance" : "Residual"}
          value={
            balanced
              ? "OK"
              : formatEuro(totalPortfolio - sumNewAmount)
          }
          tone={balanced ? "success" : "danger"}
        />
      </Box>

      {/* Rows table */}
      <Box
        sx={{
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: "border.default",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr
              style={{
                background: "#f6f8fa",
                borderBottom: "1px solid #d0d7de",
              }}
            >
              <Th>Support</Th>
              <Th align="right">Current</Th>
              <Th align="right">Target</Th>
              <Th>Action</Th>
              <Th align="right">New %</Th>
              <Th align="right">New €</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 24, textAlign: "center" }}>
                  <Text sx={{ color: "fg.muted" }}>
                    No allocations yet. Add a support below.
                  </Text>
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const newAmount =
                  (totalPortfolio * r.newPercent) / 100;
                const diff = newAmount - r.currentAmount;
                const action: "BUY" | "SELL" | "HOLD" =
                  diff > 0.01 ? "BUY" : diff < -0.01 ? "SELL" : "HOLD";
                const currentPercent =
                  totalPortfolio > 0
                    ? (r.currentAmount / totalPortfolio) * 100
                    : 0;

                const percentValue =
                  percentDrafts[r.key] ??
                  (Number.isFinite(r.newPercent)
                    ? roundTo(r.newPercent, 2).toString()
                    : "0");
                const amountValue =
                  amountDrafts[r.key] ?? roundTo(newAmount, 2).toString();

                return (
                  <tr
                    key={r.key}
                    style={{ borderBottom: "1px solid #eaecef" }}
                  >
                    <td style={{ padding: "8px 12px" }}>
                      <Box>
                        <Text sx={{ fontWeight: "bold" }}>
                          {r.support.name}
                        </Text>
                        {r.support.ISIN && (
                          <Text
                            sx={{
                              display: "block",
                              fontFamily: "mono",
                              fontSize: 0,
                              color: "fg.muted",
                            }}
                          >
                            {r.support.ISIN}
                          </Text>
                        )}
                      </Box>
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        textAlign: "right",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <Text>{formatEuro(r.currentAmount)}</Text>
                      <Text
                        sx={{
                          display: "block",
                          fontSize: 0,
                          color: "fg.muted",
                        }}
                      >
                        {formatPercent(currentPercent)}
                      </Text>
                    </td>
                    <td
                      style={{
                        padding: "8px 12px",
                        textAlign: "right",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <Text>
                        {formatEuro(
                          (totalPortfolio * r.targetPercent) / 100
                        )}
                      </Text>
                      <Text
                        sx={{
                          display: "block",
                          fontSize: 0,
                          color: "fg.muted",
                        }}
                      >
                        {formatPercent(r.targetPercent)}
                      </Text>
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      {action === "HOLD" ? (
                        <Label variant="secondary">HOLD</Label>
                      ) : (
                        <Box
                          sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 1,
                          }}
                        >
                          <Label variant={actionVariant(action)}>
                            {action}
                          </Label>
                          <Text
                            sx={{
                              fontSize: 0,
                              color:
                                action === "BUY"
                                  ? "success.fg"
                                  : "danger.fg",
                              fontWeight: "bold",
                            }}
                          >
                            {formatEuro(Math.abs(diff))}
                          </Text>
                        </Box>
                      )}
                    </td>
                    <td
                      style={{ padding: "8px 12px", textAlign: "right" }}
                    >
                      <TextInput
                        value={percentValue}
                        onChange={(e) =>
                          onPercentChange(r.key, e.target.value)
                        }
                        sx={{ width: "90px", textAlign: "right" }}
                        inputMode="decimal"
                      />
                    </td>
                    <td
                      style={{ padding: "8px 12px", textAlign: "right" }}
                    >
                      <TextInput
                        value={amountValue}
                        onChange={(e) =>
                          onAmountChange(r.key, e.target.value)
                        }
                        sx={{ width: "120px", textAlign: "right" }}
                        inputMode="decimal"
                      />
                    </td>
                    <td
                      style={{ padding: "8px 12px", textAlign: "right" }}
                    >
                      {r.manuallyAdded && (
                        <IconButton
                          icon={TrashIcon}
                          aria-label={`Remove ${r.support.name}`}
                          variant="invisible"
                          size="small"
                          onClick={() => removeRow(r.key)}
                        />
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Box>

      <Box sx={{ display: "flex", gap: 2 }}>
        <Button
          leadingVisual={PlusIcon}
          onClick={() => setPickerOpen(true)}
        >
          Add support
        </Button>
        {isDirty && (
          <Button onClick={resetToTarget}>Reset</Button>
        )}
      </Box>

      {mutation.isError && (
        <Flash variant="danger">
          {(mutation.error as Error)?.message ?? "Save failed."}
        </Flash>
      )}

      {/* Editor footer */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 2,
          pt: 3,
          mt: 1,
          borderTopWidth: 1,
          borderTopStyle: "solid",
          borderTopColor: "border.default",
        }}
      >
        <Button onClick={onCancel} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!balanced || mutation.isPending}
        >
          {mutation.isPending ? "Saving…" : saveLabel}
        </Button>
      </Box>

      {pickerOpen && (
        <SupportPickerDialog
          supports={supportsQuery.data ?? []}
          disabledIds={
            new Set(
              rows
                .map((r) => (r.support?.id != null ? String(r.support.id) : null))
                .filter((x): x is string => x !== null)
            )
          }
          onClose={() => setPickerOpen(false)}
          onPick={(id) => {
            setPickerOpen(false);
            addSupport(id);
          }}
        />
      )}
    </Box>
  );
}

// ---- Editor helpers --------------------------------------------------------

/** Build the initial row list: union of the client's current allocations
 *  and the target items, keyed by support documentId so supports that
 *  appear in both get a single row. Rows in the target seed the
 *  editable `newPercent`; rows only in current start at 0% (implied
 *  "sell-all").
 *
 *  Ordered SELL → BUY → HOLD (matches the email template and the natural
 *  cash-flow order). Sort is done ONCE at initialization — we don't
 *  re-sort as the user edits because that would make rows jump around
 *  mid-keystroke.
 */
/** Unique key for a support, tolerating partial populates. We key by
 *  numeric id first (always present when a relation is populated),
 *  then documentId as a fallback. Using a consistent strategy across
 *  all row sources prevents dedup from silently creating duplicates
 *  when one source returns both fields and another returns only one. */
function supportKey(s: { id?: number; documentId?: string } | null | undefined): string | null {
  if (!s) return null;
  if (s.id != null) return `id-${s.id}`;
  if (s.documentId) return `doc-${s.documentId}`;
  return null;
}

function buildInitialRows(
  latest: Allocation[],
  target: AllocationTarget,
  totalPortfolio: number
): EditorRow[] {
  const byKey = new Map<string, EditorRow>();

  for (const a of latest) {
    const s = a.support;
    const k = supportKey(s);
    if (!k || !s) continue;
    const amount = (a.quantity ?? 0) * (a.value ?? 0);
    byKey.set(k, {
      key: k,
      support: s,
      currentAmount: amount,
      targetPercent: 0,
      newPercent: 0,
      manuallyAdded: false,
    });
  }

  for (const t of target.targets ?? []) {
    const s = t.support;
    const k = supportKey(s);
    if (!k || !s) continue;
    const existing = byKey.get(k);
    if (existing) {
      existing.targetPercent = t.repartition ?? 0;
      existing.newPercent = t.repartition ?? 0;
    } else {
      byKey.set(k, {
        key: k,
        support: s,
        currentAmount: 0,
        targetPercent: t.repartition ?? 0,
        newPercent: t.repartition ?? 0,
        manuallyAdded: false,
      });
    }
  }

  const rows = Array.from(byKey.values());

  // Classify by the initial would-be action: SELL (0) / BUY (1) / HOLD (2).
  // Alphabetical tiebreak within each group.
  const rank = (r: EditorRow): number => {
    const newAmount = (totalPortfolio * r.newPercent) / 100;
    const diff = newAmount - r.currentAmount;
    if (diff < -0.01) return 0; // SELL
    if (diff > 0.01) return 1; // BUY
    return 2; // HOLD
  };
  rows.sort((a, b) => {
    const d = rank(a) - rank(b);
    return d !== 0 ? d : (a.support.name ?? "").localeCompare(b.support.name ?? "");
  });

  return rows;
}

function roundTo(n: number, digits: number): number {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

/** Sum of (quantity × value) across the client's latest allocations.
 *  Mirrors what `ArbitrageEditor` uses internally — exposed so the
 *  parent dialog can seed initialRows against the same portfolio
 *  value. */
function sumPortfolio(latest: Allocation[]): number {
  return latest.reduce((s, a) => s + (a.quantity ?? 0) * (a.value ?? 0), 0);
}

/** Seed the editor from an existing arbitrage — reconstructs the
 *  allocation the advisor had previously saved so they can tweak it.
 *
 *  Strategy:
 *    1. Build the structural (current + target) rows. Default every row
 *       to HOLD (newPercent = currentPercent).
 *    2. Apply each stored action as a signed delta on currentAmount to
 *       derive the row's reconstructed newPercent.
 *    3. For actions that reference a support not present in either
 *       current or target, add a manuallyAdded row.
 *
 *  This reconstruction is exact as long as "no action stored" means
 *  "HOLD at current" — which matches how the save step works.
 */
function buildRowsFromArbitrage(
  arbitrage: Arbitrage,
  latest: Allocation[],
  target: AllocationTarget,
  totalPortfolio: number
): EditorRow[] {
  const rows = buildInitialRows(latest, target, totalPortfolio);
  const byKey = new Map<string, EditorRow>();
  for (const r of rows) byKey.set(r.key, r);

  // Step 1 — default every row to HOLD (overwriting the target-seed
  // that buildInitialRows left behind).
  for (const r of byKey.values()) {
    r.newPercent =
      totalPortfolio > 0 ? (r.currentAmount / totalPortfolio) * 100 : 0;
  }

  // Step 2 — apply stored action deltas to structural rows, and gather
  // actions on supports that aren't in the structure for step 3.
  const leftoverActions: Arbitrage["arbitrages"] = [];
  for (const a of arbitrage.arbitrages ?? []) {
    const s = a.support;
    const k = supportKey(s);
    if (!k || !s) continue;
    const r = byKey.get(k);
    if (!r) {
      leftoverActions.push(a);
      continue;
    }
    const signedDiff = a.action === "buy" ? a.amount : -a.amount;
    const newAmount = r.currentAmount + signedDiff;
    r.newPercent =
      totalPortfolio > 0 ? (newAmount / totalPortfolio) * 100 : 0;
  }

  // Step 3 — manually-added rows at save time.
  for (const a of leftoverActions) {
    const s = a.support;
    const k = supportKey(s);
    if (!k || !s) continue;
    const newAmount = a.action === "buy" ? a.amount : 0;
    byKey.set(k, {
      key: k,
      support: s,
      currentAmount: 0,
      targetPercent: 0,
      newPercent:
        totalPortfolio > 0 ? (newAmount / totalPortfolio) * 100 : 0,
      manuallyAdded: true,
    });
  }

  return Array.from(byKey.values());
}

/** "Sync latest target" seed. Literally the same logic as the initial
 *  (fresh-create) calculation, plus: any support that was manually
 *  added to the old arbitrage gets re-appended at 0 % — unless that
 *  same support is now part of the latest target (in which case the
 *  initial calculation already covers it and we don't want to
 *  duplicate). */
function buildResetToTargetRows(
  arbitrage: Arbitrage,
  latest: Allocation[],
  target: AllocationTarget,
  totalPortfolio: number
): EditorRow[] {
  // Start from the exact same row set the fresh-arbitrage flow uses.
  const rows = buildInitialRows(latest, target, totalPortfolio);

  // "Covered" = already present after the initial calculation, whether
  // by documentId or by numeric id (tolerates partial populates).
  const covered = new Set<string>();
  for (const r of rows) {
    const k = supportKey(r.support);
    if (k) covered.add(k);
  }

  // Append the manually-added lines from the previous arbitrage at 0 %.
  for (const a of arbitrage.arbitrages ?? []) {
    const s = a.support;
    const k = supportKey(s);
    if (!k || !s) continue;
    if (covered.has(k)) continue;
    rows.push({
      key: k,
      support: s,
      currentAmount: 0,
      targetPercent: 0,
      newPercent: 0,
      manuallyAdded: true,
    });
    covered.add(k); // Guard against duplicate actions on the same support
  }

  return rows;
}

function Th({
  children,
  align,
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      style={{
        textAlign: align ?? "left",
        padding: "10px 12px",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        color: "#57606a",
        fontWeight: 600,
      }}
    >
      {children}
    </th>
  );
}

/** Small inline "sync icon with a diagonal slash" — signals that a
 *  contract's stored arbitrage references an older allocation target
 *  than the one currently active on the risk profile. Kept as a local
 *  SVG (not an octicons import) because octicons doesn't ship a "sync
 *  barred" variant. */
function SyncStrikedIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      role="img"
      style={{ color: "#8c959f", display: "inline-block", flexShrink: 0 }}
    >
      <title>Arbitrage out of sync with current allocation target</title>
      {/* Octicons SyncIcon path */}
      <path d="M1.705 8.005a.75.75 0 0 1 .834.656 5.5 5.5 0 0 0 9.592 2.97l-1.204-1.204a.25.25 0 0 1 .177-.427h3.646a.25.25 0 0 1 .25.25v3.646a.25.25 0 0 1-.427.177l-1.38-1.38A7.002 7.002 0 0 1 1.05 8.84a.75.75 0 0 1 .656-.834ZM8 2.5a5.487 5.487 0 0 0-4.131 1.869l1.204 1.204A.25.25 0 0 1 4.896 6H1.25A.25.25 0 0 1 1 5.75V2.104a.25.25 0 0 1 .427-.177l1.38 1.38A7.002 7.002 0 0 1 14.95 7.16a.75.75 0 0 1-1.49.178A5.5 5.5 0 0 0 8 2.5Z" />
      {/* Diagonal strike */}
      <line
        x1="2"
        y1="2"
        x2="14"
        y2="14"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
      />
    </svg>
  );
}

function actionVariant(action: string): "success" | "danger" | "secondary" {
  if (action === "BUY") return "success";
  if (action === "SELL") return "danger";
  return "secondary";
}

// ---------------------------------------------------------------------------

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "danger";
}) {
  const color =
    tone === "success" ? "success.fg" : tone === "danger" ? "danger.fg" : "fg.default";
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
      <Text sx={{ display: "block", fontSize: 2, fontWeight: 600, mt: 1, color }}>
        {value}
      </Text>
    </Box>
  );
}


// ---- Support picker (inline button → modal search + create) ---------------

function SupportPicker({
  value,
  supports,
  onPick,
  disabledIds,
}: {
  value: string;
  supports: Support[];
  onPick: (id: number | string) => void;
  /** Support ids (as strings) that should appear greyed out and
   *  un-pickable. Used by the target editor to prevent adding the same
   *  support twice across rows. */
  disabledIds?: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const selected = supports.find((s) => String(s.id) === value);

  return (
    <>
      <Button
        type="button"
        block
        onClick={() => setOpen(true)}
        sx={{ textAlign: "left", justifyContent: "flex-start" }}
      >
        {selected ? (
          <Box sx={{ display: "flex", gap: 2, alignItems: "baseline", width: "100%" }}>
            {selected.ISIN && (
              <Text sx={{ fontFamily: "mono", fontSize: 0 }}>{selected.ISIN}</Text>
            )}
            <Text sx={{ fontWeight: 400 }}>{selected.name}</Text>
          </Box>
        ) : (
          <Text sx={{ color: "fg.muted" }}>Choose a support…</Text>
        )}
      </Button>
      {open && (
        <SupportPickerDialog
          supports={supports}
          disabledIds={disabledIds}
          onClose={() => setOpen(false)}
          onPick={(id) => {
            setOpen(false);
            onPick(id);
          }}
        />
      )}
    </>
  );
}

function SupportPickerDialog({
  supports,
  onClose,
  onPick,
  disabledIds,
}: {
  supports: Support[];
  onClose: () => void;
  onPick: (id: number | string) => void;
  /** When a support's id is in this set, it renders greyed-out and its
   *  button is disabled. Used to prevent adding the same support twice
   *  in a list (e.g. two target rows for AIR LIQUIDE). */
  disabledIds?: Set<string>;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return supports;
    return supports.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.ISIN ?? "").toLowerCase().includes(q) ||
        (s.code ?? "").toLowerCase().includes(q)
    );
  }, [supports, search]);

  return (
    <Modal title="Choose a support" onClose={onClose}>
      <TextInput
        leadingVisual={SearchIcon}
        placeholder="Search by name, ISIN or code…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        block
        size="large"
        autoFocus
      />

      <Box
        sx={{
          mt: 3,
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: "border.default",
          borderRadius: 2,
          maxHeight: "420px",
          overflowY: "auto",
        }}
      >
        {filtered.length === 0 ? (
          <Box sx={{ p: 3 }}>
            <Text sx={{ color: "fg.muted", fontSize: 1 }}>
              {search.trim()
                ? `No support matches "${search}".`
                : "No support yet."}
            </Text>
          </Box>
        ) : (
          filtered.map((s, i) => {
            const disabled = disabledIds?.has(String(s.id)) ?? false;
            return (
              <Box
                key={s.id}
                as="button"
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (disabled) return;
                  onPick(s.id);
                }}
                sx={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  p: 2,
                  border: "none",
                  bg: "transparent",
                  cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.5 : 1,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopStyle: "solid",
                  borderTopColor: "border.muted",
                  "&:hover": {
                    bg: disabled ? "transparent" : "canvas.subtle",
                  },
                  "&:focus-visible": {
                    outline: "2px solid",
                    outlineColor: "accent.emphasis",
                    outlineOffset: "-2px",
                  },
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    gap: 2,
                    alignItems: "baseline",
                    justifyContent: "space-between",
                  }}
                >
                  <Box sx={{ display: "flex", gap: 2, alignItems: "baseline" }}>
                    {s.ISIN && (
                      <Text
                        sx={{ fontFamily: "mono", fontSize: 0, color: "fg.muted" }}
                      >
                        {s.ISIN}
                      </Text>
                    )}
                    <Text sx={{ fontWeight: 600 }}>{s.name}</Text>
                  </Box>
                  {disabled && (
                    <Text sx={{ fontSize: 0, color: "fg.muted" }}>
                      already used
                    </Text>
                  )}
                </Box>
              </Box>
            );
          })
        )}
      </Box>

      <Box
        sx={{
          mt: 3,
          pt: 3,
          borderTopWidth: 1,
          borderTopStyle: "solid",
          borderTopColor: "border.default",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text sx={{ fontSize: 1, color: "fg.muted" }}>
          Can't find the support you need?
        </Text>
        <Button
          size="small"
          leadingVisual={PlusIcon}
          onClick={() => setCreateOpen(true)}
        >
          Create a new support
        </Button>
      </Box>

      {createOpen && (
        <SupportCreateDialog
          initialIsin={search.trim()}
          onClose={() => setCreateOpen(false)}
          onCreated={async (s) => {
            await queryClient.invalidateQueries({ queryKey: ["supports"] });
            setCreateOpen(false);
            onPick(s.id);
          }}
        />
      )}
    </Modal>
  );
}

function SupportCreateDialog({
  initialIsin,
  onClose,
  onCreated,
}: {
  initialIsin?: string;
  onClose: () => void;
  onCreated: (support: Support) => void;
}) {
  const [name, setName] = useState("");
  const [isin, setIsin] = useState(initialIsin ?? "");
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: () => {
      // Code mirrors the ISIN — we always keep them in sync at creation.
      const normalizedIsin = isin.trim();
      return createSupport({
        name: name.trim(),
        ISIN: normalizedIsin,
        code: normalizedIsin,
      });
    },
    onSuccess: (s) => onCreated(s),
    onError: (err) => {
      if (err instanceof StrapiError) setError(err.message);
      else setError("Could not create the support. Please try again.");
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!isin.trim()) {
      setError("ISIN is required.");
      return;
    }
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

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  return (
    <Modal title="New support" onClose={onClose}>
      <Box as="form" ref={formRef} onSubmit={onSubmit}>
        {error && (
          <Flash variant="danger" sx={{ mb: 3 }}>
            {error}
          </Flash>
        )}

        <FormControl required sx={{ mb: 3 }}>
          <FormControl.Label>Name</FormControl.Label>
          <TextInput
            ref={nameInputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            block
            size="large"
          />
        </FormControl>

        <FormControl required sx={{ mb: 4 }}>
          <FormControl.Label>ISIN</FormControl.Label>
          <TextInput
            value={isin}
            onChange={(e) => setIsin(e.target.value)}
            block
            size="large"
            sx={{ fontFamily: "mono" }}
          />
        </FormControl>

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
            {mutation.isPending ? "Creating…" : "Create support"}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}

function StepCard({
  step,
  title,
  hint,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
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
      <Text
        sx={{
          fontSize: 0,
          color: "fg.muted",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          display: "block",
          mb: 1,
        }}
      >
        Step {step} of 3
      </Text>
      <Heading as="h3" sx={{ fontSize: 3, mb: hint ? 1 : 3 }}>
        {title}
      </Heading>
      {hint && (
        <Text sx={{ color: "fg.muted", fontSize: 1, display: "block", mb: 3 }}>
          {hint}
        </Text>
      )}
      {children}
    </Box>
  );
}

function StepChip({
  label,
  value,
  onClear,
}: {
  label: string;
  value: string;
  onClear: () => void;
}) {
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "border.default",
        borderRadius: 2,
        bg: "canvas.subtle",
        pl: 2,
        pr: 1,
        py: 1,
        fontSize: 1,
      }}
    >
      <Text sx={{ color: "fg.muted" }}>{label}:</Text>
      <Text sx={{ fontWeight: "bold" }}>{value}</Text>
      <IconButton
        icon={XIcon}
        aria-label={`Change ${label}`}
        size="small"
        variant="invisible"
        onClick={onClear}
      />
    </Box>
  );
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
