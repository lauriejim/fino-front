import { api } from "./client";
import type { Invoice, StrapiSingleResponse } from "@/types/strapi";

export interface InvoiceLineInput {
  contract: string; // documentId
  allocations: string[]; // documentIds
  amount: number;
  rate: number;
  vat: number;
  period: number;
  fee?: number | null;
}

export interface CreateInvoiceInput {
  date: string; // YYYY-MM-DD
  client: string; // documentId
  lines: InvoiceLineInput[];
  total_tax: number;
  total_no_tax: number;
}

export async function createInvoice(data: CreateInvoiceInput): Promise<Invoice> {
  const res = await api.post<StrapiSingleResponse<Invoice>>(
    "/api/invoices",
    { data }
  );
  return res.data;
}
