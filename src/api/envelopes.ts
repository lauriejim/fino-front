import { api } from "./client";
import type { Envelope, StrapiListResponse } from "@/types/strapi";

export async function listEnvelopes(): Promise<Envelope[]> {
  const res = await api.get<StrapiListResponse<Envelope>>("/api/envelopes", {
    "pagination[pageSize]": 100,
    sort: "name:asc",
  });
  return res.data;
}
