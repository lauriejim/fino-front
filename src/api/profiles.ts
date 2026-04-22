import { api } from "./client";
import type {
  IsrEsgProfile,
  RiskProfile,
  StrapiListResponse,
} from "@/types/strapi";

export async function listRiskProfiles(): Promise<RiskProfile[]> {
  const res = await api.get<StrapiListResponse<RiskProfile>>("/api/risk-profiles", {
    "pagination[pageSize]": 100,
    sort: "name:asc",
  });
  return res.data;
}

export async function listIsrEsgProfiles(): Promise<IsrEsgProfile[]> {
  const res = await api.get<StrapiListResponse<IsrEsgProfile>>(
    "/api/isr-esg-profiles",
    {
      "pagination[pageSize]": 100,
      sort: "name:asc",
    }
  );
  return res.data;
}
