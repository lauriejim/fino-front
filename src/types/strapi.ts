// Types for the Strapi entities used by fino.
// These mirror the content-types defined in ../../strapi-app/src/api/** .
//
// v2 scope reductions vs. v1: dropped WealthManager, Bank, Operation,
// and the arbitrage.executed boolean. Auth now relies on Strapi's
// built-in Users & Permissions plugin.

// --- Strapi envelope ---------------------------------------------------------

export interface StrapiEntity {
  id: number;
  documentId: string;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
}

export interface StrapiListResponse<T> {
  data: T[];
  meta?: {
    pagination?: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

export interface StrapiSingleResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

// --- Domain entities ---------------------------------------------------------

export interface Insurer extends StrapiEntity {
  name: string;
  products?: Product[];
  accounts?: Account[];
}

export interface Envelope extends StrapiEntity {
  name?: string;
  base_rate?: number | null;
  base_vat?: number | null;
  products?: Product[];
}

export interface Support extends StrapiEntity {
  name: string;
  ISIN?: string | null;
  code?: string | null;
  products?: Product[];
  allocations?: Allocation[];
}

export interface Product extends StrapiEntity {
  name: string;
  code: string;
  insurer?: Insurer;
  envelope?: Envelope;
  supports?: Support[];
  contracts?: Contract[];
  allocation_targets?: AllocationTarget[];
}

export interface Account extends StrapiEntity {
  name?: string | null;
  code?: string | null;
  client?: Client;
  insurer?: Insurer;
  contracts?: Contract[];
}

export interface RiskProfile extends StrapiEntity {
  name: string;
}

export interface IsrEsgProfile extends StrapiEntity {
  name: string;
}

export interface Allocation extends StrapiEntity {
  contract?: Contract;
  support?: Support;
  quantity: number;
  value: number;
  date?: string;
  latest: boolean;
}

export interface Contract extends StrapiEntity {
  name: string;
  code?: string | null;
  date?: string;
  custom_rate?: number | null;
  custom_vat?: number | null;
  account?: Account;
  product?: Product;
  allocations?: Allocation[];
  risk_profile?: RiskProfile;
  isr_esg_profile?: IsrEsgProfile;
  /** Inverse side of the Arbitrage 1:1. */
  arbitrage?: Arbitrage | null;
}

export interface AllocationTargetItem {
  id?: number;
  repartition: number; // percent, 0..100
  support?: Support;
  note?: string | null;
}

export interface AllocationTarget extends StrapiEntity {
  name?: string | null;
  description?: string | null;
  date?: string;
  latest: boolean;
  product?: Product;
  risk_profile?: RiskProfile;
  targets: AllocationTargetItem[];
  arbitrages?: Arbitrage[];
}

export interface ArbitrageAction {
  id?: number;
  amount: number;
  action: "buy" | "sell";
  support?: Support;
}

export interface Arbitrage extends StrapiEntity {
  date?: string;
  allocation_target?: AllocationTarget;
  arbitrages: ArbitrageAction[];
  /** 1:1 with the contract on which the arbitrage is executed. */
  contract?: Contract;
}

export interface InvoiceLine {
  id?: number;
  contract?: Contract;
  allocations?: Allocation[];
  amount: number;
  rate: number;
  vat: number;
  period: number; // days
  fee?: number | null;
}

export interface Invoice extends StrapiEntity {
  date: string;
  client?: Client;
  lines: InvoiceLine[];
  total_tax: number;
  total_no_tax: number;
}

export interface Client extends StrapiEntity {
  firstname: string;
  lastname: string;
  genre?: "men" | "women" | null;
  birthdate?: string | null;
  email?: string | null;
  phone?: string | null;
  accounts?: Account[];
  invoices?: Invoice[];
  risk_profile?: RiskProfile;
  isr_esg_profile?: IsrEsgProfile;
}

// --- Strapi Users & Permissions ---------------------------------------------

export interface StrapiUser {
  id: number;
  username: string;
  email: string;
  provider?: string;
  confirmed?: boolean;
  blocked?: boolean;
  createdAt?: string;
  updatedAt?: string;
  // Business profile fields can be added here as Strapi Users schema is
  // extended (firstname, lastname, company, siret, orias, cif — the v1
  // WealthManager fields that will move onto Strapi Users).
  firstname?: string;
  lastname?: string;
}

export interface AuthResponse {
  jwt: string;
  user: StrapiUser;
}
