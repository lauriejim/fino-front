import { api } from "./client";
import type {
  Arbitrage,
  StrapiListResponse,
  StrapiSingleResponse,
} from "@/types/strapi";

/**
 * Fetch the arbitrage linked (1:1) to a given contract, if any exists.
 *
 * The relation is one-to-one on the contract side, so we return the first
 * match or null. Populates the arbitrage's action components together
 * with their support reference (needed to render the plan) plus the
 * contract and allocation target metadata (useful for display headers).
 */
export async function findArbitrageByContract(
  contractDocumentId: string
): Promise<Arbitrage | null> {
  const res = await api.get<StrapiListResponse<Arbitrage>>("/api/arbitrages", {
    "filters[contract][documentId][$eq]": contractDocumentId,
    "populate[0]": "arbitrages.support",
    "populate[1]": "contract",
    "populate[2]": "allocation_target",
    "pagination[pageSize]": 1,
  });
  return res.data[0] ?? null;
}

export interface CreateArbitrageInput {
  date: string; // ISO yyyy-MM-dd
  contract: number | string;
  allocation_target: number | string;
  arbitrages: Array<{
    action: "buy" | "sell";
    amount: number;
    support: number | string;
  }>;
}

export async function createArbitrage(
  input: CreateArbitrageInput
): Promise<Arbitrage> {
  const res = await api.post<StrapiSingleResponse<Arbitrage>>(
    "/api/arbitrages",
    { data: input }
  );
  return res.data;
}

export async function updateArbitrage(
  documentId: string,
  input: Partial<CreateArbitrageInput>
): Promise<Arbitrage> {
  const res = await api.put<StrapiSingleResponse<Arbitrage>>(
    `/api/arbitrages/${documentId}`,
    { data: input }
  );
  return res.data;
}
