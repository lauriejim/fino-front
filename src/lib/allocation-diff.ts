import type { Allocation, AllocationTargetItem } from "@/types/strapi";

export interface DiffRow {
  supportDocumentId: string;
  isin: string;
  name: string;
  currentAmount: number;
  currentPercent: number;
  targetPercent: number;
  targetAmount: number;
  diffAmount: number;
  action: "BUY" | "SELL" | "HOLD";
  note?: string | null;
}

export interface DiffResult {
  totalContractValue: number;
  details: DiffRow[];
  summary: {
    buyTotal: number;
    sellTotal: number;
    holdCount: number;
  };
}

/**
 * Compare a client's current (latest) allocations against the allocation
 * target and produce a per-support plan with BUY / SELL / HOLD actions.
 *
 * Mirrors the logic of v1's `helpers/allocation.js`:
 *   - Total contract value = Σ (quantity × value) on latest allocations
 *   - targetAmount = totalContractValue × (repartition / 100)
 *   - diffAmount = targetAmount − currentAmount
 *   - Action = BUY if diff > +0.01, SELL if diff < −0.01, HOLD otherwise
 */
export function computeDiff(
  currentAllocations: Allocation[],
  targetItems: AllocationTargetItem[]
): DiffResult {
  const totalContractValue = currentAllocations.reduce(
    (s, a) => s + (a.quantity ?? 0) * (a.value ?? 0),
    0
  );

  const currentMap = new Map<string, Allocation>();
  for (const a of currentAllocations) {
    const id = a.support?.documentId;
    if (id) currentMap.set(id, a);
  }

  const targetMap = new Map<string, AllocationTargetItem>();
  for (const t of targetItems) {
    const id = t.support?.documentId;
    if (id) targetMap.set(id, t);
  }

  const allIds = new Set<string>([...currentMap.keys(), ...targetMap.keys()]);

  const details: DiffRow[] = [];
  for (const id of allIds) {
    const cur = currentMap.get(id);
    const tgt = targetMap.get(id);
    const support = cur?.support ?? tgt?.support;

    const currentAmount = cur ? (cur.quantity ?? 0) * (cur.value ?? 0) : 0;
    const targetPercent = tgt?.repartition ?? 0;
    const targetAmount = (totalContractValue * targetPercent) / 100;
    const diffAmount = targetAmount - currentAmount;

    let action: "BUY" | "SELL" | "HOLD" = "HOLD";
    if (diffAmount > 0.01) action = "BUY";
    else if (diffAmount < -0.01) action = "SELL";

    details.push({
      supportDocumentId: id,
      isin: support?.ISIN ?? support?.code ?? "—",
      name: support?.name ?? "—",
      currentAmount,
      currentPercent:
        totalContractValue > 0 ? (currentAmount / totalContractValue) * 100 : 0,
      targetPercent,
      targetAmount,
      diffAmount,
      action,
      note: tgt?.note ?? null,
    });
  }

  // SELL first, then BUY, then HOLD — matches the email template's
  // "Nous vendons / Nous achetons" ordering, and follows the natural
  // cash-flow order of the operation (you sell to fund the buys).
  // Alphabetical by name within each group.
  const order: Record<string, number> = { SELL: 0, BUY: 1, HOLD: 2 };
  details.sort((a, b) => {
    const d = (order[a.action] ?? 3) - (order[b.action] ?? 3);
    return d !== 0 ? d : a.name.localeCompare(b.name);
  });

  const buyTotal = details.reduce(
    (s, d) => s + (d.action === "BUY" ? d.diffAmount : 0),
    0
  );
  const sellTotal = details.reduce(
    (s, d) => s + (d.action === "SELL" ? Math.abs(d.diffAmount) : 0),
    0
  );
  const holdCount = details.filter((d) => d.action === "HOLD").length;

  return {
    totalContractValue,
    details,
    summary: { buyTotal, sellTotal, holdCount },
  };
}
