import { api } from "./client";
import type {
  StrapiListResponse,
  StrapiSingleResponse,
  Support,
} from "@/types/strapi";

export async function listSupports(): Promise<Support[]> {
  const res = await api.get<StrapiListResponse<Support>>("/api/supports", {
    "pagination[page]": 1,
    "pagination[pageSize]": 10000,
    sort: "name:asc",
  });
  return res.data;
}

export interface CreateSupportInput {
  name: string;
  ISIN?: string | null;
  code?: string | null;
}

export async function createSupport(data: CreateSupportInput): Promise<Support> {
  const res = await api.post<StrapiSingleResponse<Support>>("/api/supports", {
    data,
  });
  return res.data;
}
