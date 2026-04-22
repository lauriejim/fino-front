import { useState, type FormEvent } from "react";
import { Link as RouterLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  FormControl,
  Heading,
  Link,
  TextInput,
  Flash,
  Text,
} from "@primer/react";
import { useAuth } from "@/contexts/AuthContext";
import { StrapiError } from "@/api/client";
import logoUrl from "@/assets/logo-dark.png";

export function LoginPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "authenticated") {
    const from = (location.state as { from?: { pathname: string } } | undefined)?.from?.pathname;
    return <Navigate to={from ?? "/clients"} replace />;
  }

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ identifier, password });
      navigate("/clients", { replace: true });
    } catch (err) {
      if (err instanceof StrapiError) {
        setError(err.message);
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bg: "canvas.subtle",
      }}
    >
      <Box sx={{ width: "340px" }}>
        <Box sx={{ textAlign: "center", mb: 3 }}>
          <Box
            as="img"
            src={logoUrl}
            alt="Fino"
            sx={{ width: 64, height: 64, mb: 3, mx: "auto", display: "block" }}
          />
          <Heading
            as="h1"
            sx={{
              fontSize: 4,
              fontWeight: 300,
              lineHeight: 1.25,
            }}
          >
            Sign in to Fino
          </Heading>
        </Box>

        <Box
          as="form"
          onSubmit={onSubmit}
          sx={{
            p: 4,
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: "border.default",
            borderRadius: 2,
            bg: "canvas.default",
          }}
        >
          {error && (
            <Flash variant="danger" sx={{ mb: 3 }}>
              {error}
            </Flash>
          )}

          <FormControl sx={{ mb: 3 }}>
            <FormControl.Label>Email address</FormControl.Label>
            <TextInput
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoFocus
              required
              block
              size="large"
            />
          </FormControl>

          {/* Password field — rendered outside FormControl so we can place the
              "Forgot password?" link on the same baseline as the label.
              FormControl's slot-matching strips non-slot children. */}
          <Box sx={{ mb: 3 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                mb: 1,
              }}
            >
              <Box
                as="label"
                htmlFor="login-password"
                sx={{ fontSize: 1, fontWeight: "bold" }}
              >
                Password
              </Box>
              <Link
                as={RouterLink}
                to="/forgot-password"
                sx={{ fontSize: 0, fontWeight: "normal" }}
              >
                Forgot password?
              </Link>
            </Box>
            <TextInput
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              block
              size="large"
            />
          </Box>

          <Button
            type="submit"
            variant="primary"
            size="large"
            block
            disabled={submitting}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </Box>

        {/* Register callout */}
        <Box
          sx={{
            mt: 3,
            p: 3,
            textAlign: "center",
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: "border.default",
            borderRadius: 2,
            bg: "canvas.default",
          }}
        >
          <Text sx={{ fontSize: 1 }}>
            New to Fino?{" "}
            <Link as={RouterLink} to="/register">
              Create an account
            </Link>
            .
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
