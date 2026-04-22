import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { setAuthToken, StrapiError } from "@/api/client";
import { fetchMe, login as loginApi, type LoginInput } from "@/api/auth";
import type { StrapiUser } from "@/types/strapi";

// -----------------------------------------------------------------------------
// AuthContext — single source of truth for { token, user }
//
// The JWT is persisted in localStorage so that reloading / reopening the
// Electron window keeps the user logged in. On app boot we validate the
// stored token against /api/users/me; a 401/403 clears it and forces a
// fresh login.
//
// We do NOT encrypt the token at rest. Electron's sandbox + contextIsolation
// protect it from third-party renderer code; for further hardening we can
// move storage to `safeStorage` in the main process later.
// -----------------------------------------------------------------------------

const STORAGE_KEY = "fino.auth.token";

export type AuthStatus = "loading" | "anonymous" | "authenticated";

export interface AuthContextValue {
  status: AuthStatus;
  user: StrapiUser | null;
  token: string | null;
  login: (input: LoginInput) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<StrapiUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  // Boot: read stored token, validate against /me
  useEffect(() => {
    const stored = readStoredToken();
    if (!stored) {
      setStatus("anonymous");
      return;
    }
    setAuthToken(stored);

    let cancelled = false;
    (async () => {
      try {
        const me = await fetchMe();
        if (cancelled) return;
        setToken(stored);
        setUser(me);
        setStatus("authenticated");
      } catch (err) {
        if (cancelled) return;
        if (err instanceof StrapiError && (err.status === 401 || err.status === 403)) {
          writeStoredToken(null);
          setAuthToken(null);
        }
        setStatus("anonymous");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const res = await loginApi(input);
    writeStoredToken(res.jwt);
    setAuthToken(res.jwt);
    setToken(res.jwt);
    setUser(res.user);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(() => {
    writeStoredToken(null);
    setAuthToken(null);
    setToken(null);
    setUser(null);
    setStatus("anonymous");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, token, login, logout }),
    [status, user, token, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

// --- helpers ----------------------------------------------------------------

function readStoredToken(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredToken(token: string | null): void {
  try {
    if (token === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, token);
  } catch {
    /* ignore — e.g. private mode */
  }
}
