import { api } from "./client";
import type { Product, StrapiListResponse, StrapiSingleResponse } from "@/types/strapi";

export async function listProducts(insurerId?: number | string | null): Promise<Product[]> {
  const query: Record<string, string | number> = {
    "pagination[pageSize]": 200,
    sort: "name:asc",
  };
  if (insurerId) {
    query["filters[insurer][id][$eq]"] = insurerId;
  }
  const res = await api.get<StrapiListResponse<Product>>("/api/products", query);
  return res.data;
}

export interface CreateProductInput {
  name: string;
  code: string;
  insurer: number | string;
  envelope?: number | string | null;
}

export async function createProduct(data: CreateProductInput): Promise<Product> {
  const res = await api.post<StrapiSingleResponse<Product>>("/api/products", { data });
  return res.data;
}
