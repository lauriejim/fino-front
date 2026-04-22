import { api } from "./client";
import type {
  Client,
  StrapiListResponse,
  StrapiSingleResponse,
} from "@/types/strapi";

// Array-index populate with dot-notation paths — same shape v1 (`tui/`) uses.
// Each path expands the exact relation tree we need, and Strapi v5 merges
// the array entries into a single deep-populate tree server-side.
const DETAIL_POPULATE_PATHS: string[] = [
  "accounts.insurer",
  "accounts.contracts.product",
  "accounts.contracts.product.envelope",
  "accounts.contracts.product.insurer",
  "accounts.contracts.allocations",
  "accounts.contracts.allocations.support",
  "invoices",
  "invoices.lines",
  "invoices.lines.allocations",
  "invoices.lines.allocations.support",
  "invoices.lines.contract",
  "invoices.lines.contract.product",
  "invoices.lines.contract.product.insurer",
  "invoices.lines.contract.product.envelope",
  "risk_profile",
  "isr_esg_profile",
];

const DETAIL_QUERY: Record<string, string> = Object.fromEntries(
  DETAIL_POPULATE_PATHS.map((path, i) => [`populate[${i}]`, path])
);

export async function listClients(search?: string): Promise<Client[]> {
  const query: Record<string, string | number> = {
    "pagination[page]": 1,
    "pagination[pageSize]": 10000,
    sort: "lastname:asc",
  };
  if (search && search.trim()) {
    // Simple OR-filter on firstname / lastname / email
    const q = search.trim();
    query["filters[$or][0][firstname][$containsi]"] = q;
    query["filters[$or][1][lastname][$containsi]"] = q;
    query["filters[$or][2][email][$containsi]"] = q;
  }
  const res = await api.get<StrapiListResponse<Client>>("/api/clients", query);
  return res.data;
}

export async function getClient(documentId: string): Promise<Client> {
  const res = await api.get<StrapiSingleResponse<Client>>(
    `/api/clients/${documentId}`,
    DETAIL_QUERY
  );
  return res.data;
}

/**
 * Clients who (1) have a contract on the given product and (2) share the
 * given risk profile. Used by the arbitrage screen to list candidates for a
 * given (product × risk) allocation target.
 */
export async function listClientsForArbitrage(
  productId: number | string,
  riskProfileId: number | string
): Promise<Client[]> {
  const res = await api.get<StrapiListResponse<Client>>("/api/clients", {
    "filters[risk_profile][id][$eq]": riskProfileId,
    "filters[accounts][contracts][product][id][$eq]": productId,
    "populate[0]": "accounts.insurer",
    "populate[1]": "accounts.contracts.product",
    "populate[2]": "accounts.contracts.allocations.support",
    "populate[3]": "risk_profile",
    // Pull the arbitrage (1:1 with contract) + the allocation target it
    // was generated against, so the arbitrage list can flag contracts
    // whose arbitrage is out of sync with the current target.
    "populate[4]": "accounts.contracts.arbitrage",
    "populate[5]": "accounts.contracts.arbitrage.allocation_target",
    "pagination[pageSize]": 1000,
    sort: "lastname:asc",
  });
  return res.data;
}

export async function updateClient(
  documentId: string,
  data: Partial<Pick<Client, "firstname" | "lastname" | "email" | "phone" | "birthdate">> & {
    risk_profile?: { set: number | string } | null;
    isr_esg_profile?: { set: number | string } | null;
  }
): Promise<Client> {
  const res = await api.put<StrapiSingleResponse<Client>>(
    `/api/clients/${documentId}`,
    { data }
  );
  return res.data;
}
