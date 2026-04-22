// Mirrors strapi-app/src/api/import/services/types.ts — keep in sync.

export type MatchStatus = "matched" | "will-create";

export interface PreviewMatch {
  status: MatchStatus;
  existingId?: number;
}

export interface PreviewAllocation {
  isin: string;
  name: string;
  quantity: number;
  value: number;
  support: PreviewMatch;
}

export interface PreviewContract {
  contract_code: string;
  product_code: string;
  product_name: string;
  name: string;
  status: MatchStatus;
  existingId?: number;
  allocations: PreviewAllocation[];
}

export interface PreviewAccount {
  firstname: string;
  lastname: string;
  client: PreviewMatch;
  account: PreviewMatch;
  contracts: PreviewContract[];
}

export interface PreviewResult {
  insurer: { name: string; status: MatchStatus; existingId?: number };
  products: Array<{
    code: string;
    name: string;
    status: MatchStatus;
    existingId?: number;
  }>;
  accounts: PreviewAccount[];
  summary: {
    clientsMatched: number;
    clientsToCreate: number;
    accountsMatched: number;
    accountsToCreate: number;
    contractsMatched: number;
    contractsToCreate: number;
    supportsMatched: number;
    supportsToCreate: number;
    allocationsToCreate: number;
    allocationsToDemote: number;
  };
  warnings: string[];
}

export interface ImportSummary {
  clients: { matched: number; created: number };
  accounts: { matched: number; created: number };
  contracts: { matched: number; created: number };
  supports: { matched: number; created: number };
  allocations: { created: number; demoted: number };
  insurerName: string;
  insurerCreated: boolean;
  errors: string[];
}
