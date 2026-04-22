import { api } from "./client";
import type { Contract, StrapiSingleResponse } from "@/types/strapi";

export interface UpdateContractInput {
  date?: string | null;
  custom_rate?: number | null;
  custom_vat?: number | null;
}

export async function updateContract(
  documentId: string,
  data: UpdateContractInput
): Promise<Contract> {
  const res = await api.put<StrapiSingleResponse<Contract>>(
    `/api/contracts/${documentId}`,
    { data }
  );
  return res.data;
}
