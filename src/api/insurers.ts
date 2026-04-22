import { api } from "./client";
import type { Insurer, StrapiListResponse } from "@/types/strapi";

export async function listInsurers(): Promise<Insurer[]> {
  const res = await api.get<StrapiListResponse<Insurer>>("/api/insurers", {
    "pagination[pageSize]": 100,
    sort: "name:asc",
  });
  return res.data;
}
