// Thin Strapi REST client used by the React app.
//
// Auth: a JWT is passed on every request. The token is owned by AuthContext;
// this module is intentionally dumb — it does not read from localStorage or
// any global state. Callers bind it via `setAuthToken` / `clearAuthToken`.

const BASE_URL: string = import.meta.env.VITE_STRAPI_URL ?? "http://localhost:1337";

let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

export class StrapiError extends Error {
  public readonly status: number;
  public readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "StrapiError";
    this.status = status;
    this.body = body;
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

function buildUrl(path: string, query?: Query): string {
  const base = `${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
  if (!query) return base;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${base}${base.includes("?") ? "&" : "?"}${qs}` : base;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  query?: Query
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const res = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  const json = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    const message =
      (json as { error?: { message?: string } })?.error?.message ??
      `${method} ${path} failed: ${res.status} ${res.statusText}`;
    throw new StrapiError(message, res.status, json);
  }

  return json as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>("GET", path, undefined, query),
  post: <T>(path: string, body?: unknown, query?: Query) =>
    request<T>("POST", path, body, query),
  put: <T>(path: string, body?: unknown, query?: Query) =>
    request<T>("PUT", path, body, query),
  delete: <T>(path: string, query?: Query) => request<T>("DELETE", path, undefined, query),
};

export { BASE_URL };
