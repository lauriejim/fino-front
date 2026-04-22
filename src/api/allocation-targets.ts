import { api } from "./client";
import type {
  AllocationTarget,
  StrapiListResponse,
  StrapiSingleResponse,
} from "@/types/strapi";

export async function getLatestTarget(
  productId: number | string,
  riskProfileId: number | string
): Promise<AllocationTarget | null> {
  // NB: `targets` is a repeatable component, `support` is a relation
  // INSIDE that component. We use the dot-notation populate (which was
  // used successfully for the initial arbitrage flow) — a recursive
  // wildcard (populate[targets][populate][support]=*) blows up here
  // because Support has a m2m relation to Product, and Strapi then
  // tries to walk into Product's relations as well.
  const res = await api.get<StrapiListResponse<AllocationTarget>>(
    "/api/allocation-targets",
    {
      "filters[product][id][$eq]": productId,
      "filters[risk_profile][id][$eq]": riskProfileId,
      "filters[latest][$eq]": true,
      "populate[0]": "targets.support",
      "populate[1]": "product",
      "populate[2]": "risk_profile",
      "pagination[pageSize]": 1,
    }
  );
  return res.data[0] ?? null;
}

export interface CreateTargetInput {
  product: number | string;
  risk_profile: number | string;
  name?: string | null;
  description?: string | null;
  date?: string | null;
  latest: boolean;
  targets: Array<{
    repartition: number;
    support: number | string;
    note?: string | null;
  }>;
}

export async function createTarget(
  data: CreateTargetInput
): Promise<AllocationTarget> {
  const res = await api.post<StrapiSingleResponse<AllocationTarget>>(
    "/api/allocation-targets",
    { data }
  );
  return res.data;
}

export async function markTargetNotLatest(documentId: string): Promise<void> {
  await api.put(`/api/allocation-targets/${documentId}`, {
    data: { latest: false },
  });
}

/** Replaces the previous latest target (if any) with a new one. */
export async function replaceLatestTarget(
  previous: AllocationTarget | null,
  data: Omit<CreateTargetInput, "latest">
): Promise<AllocationTarget> {
  if (previous) {
    await markTargetNotLatest(previous.documentId);
  }
  return createTarget({ ...data, latest: true });
}
