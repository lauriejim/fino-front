import { api } from "./client";
import type { AuthResponse, StrapiUser } from "@/types/strapi";

// Strapi Users & Permissions — local provider (email + password).
// See https://docs.strapi.io/dev-docs/plugins/users-permissions

export interface LoginInput {
  identifier: string; // username or email
  password: string;
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  return api.post<AuthResponse>("/api/auth/local", input);
}

export async function fetchMe(): Promise<StrapiUser> {
  // `/api/users/me` honors the Authorization header
  return api.get<StrapiUser>("/api/users/me");
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
  // Optional business-profile fields. Strapi ignores unknown fields unless the
  // User content-type has been extended to include them (firstname / lastname
  // will be added when we move WealthManager onto Strapi Users).
  firstname?: string;
  lastname?: string;
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  return api.post<AuthResponse>("/api/auth/local/register", input);
}

export interface ForgotPasswordInput {
  email: string;
}

export async function forgotPassword(input: ForgotPasswordInput): Promise<{ ok: true }> {
  return api.post<{ ok: true }>("/api/auth/forgot-password", input);
}

export interface ResetPasswordInput {
  code: string;
  password: string;
  passwordConfirmation: string;
}

export async function resetPassword(input: ResetPasswordInput): Promise<AuthResponse> {
  return api.post<AuthResponse>("/api/auth/reset-password", input);
}
