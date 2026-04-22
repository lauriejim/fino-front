import { useState, type FormEvent } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
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
import { ArrowRightIcon } from "@primer/octicons-react";
import { useAuth } from "@/contexts/AuthContext";
import { register } from "@/api/auth";
import { StrapiError, setAuthToken } from "@/api/client";
import logoUrl from "@/assets/logo-light.png";

// Minimum-length validation — mirrors Strapi's default Users-Permissions config
// ("minimum password length" in the admin panel, default 6). Adjust if your
// Strapi config is stricter.
const MIN_PASSWORD = 6;

export function RegisterPage() {
  const navigate = useNavigate();
  const { status } = useAuth();

  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "authenticated") {
    navigate("/clients", { replace: true });
  }

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await register({
        username: username.trim(),
        email: email.trim(),
        password,
        firstname: firstname.trim() || undefined,
        lastname: lastname.trim() || undefined,
      });
      setAuthToken(res.jwt);
      window.localStorage.setItem("fino.auth.token", res.jwt);
      window.location.assign("/clients");
    } catch (err) {
      if (err instanceof StrapiError) {
        setError(err.message);
      } else {
        setError("Could not create your account. Please try again.");
      }
      setSubmitting(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
      }}
    >
      {/* Left pane — dark brand panel */}
      <Box
        sx={{
          display: ["none", "none", "flex"], // hide on narrow screens
          flex: "0 0 45%",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          px: 6,
          color: "#ffffff",
          bg: "#0d1117", // GitHub-like dark panel
          background:
            "linear-gradient(180deg, #0d1117 0%, #0d1117 60%, #221a3a 100%)",
        }}
      >
        <Box
          as="img"
          src={logoUrl}
          alt="Fino"
          sx={{ width: 96, height: 96, mb: 5 }}
        />
        <Heading
          as="h2"
          sx={{
            fontSize: 6,
            fontWeight: 600,
            lineHeight: 1.15,
            mb: 3,
            color: "#ffffff",
          }}
        >
          Create your Fino account
        </Heading>
        <Text
          sx={{
            fontSize: 2,
            lineHeight: 1.5,
            color: "#c9d1d9",
            maxWidth: "480px",
          }}
        >
          The workbench for wealth-management practices — client portfolios,
          contracts, billing and arbitrages in one place.
        </Text>
      </Box>

      {/* Right pane — form */}
      <Box
        sx={{
          flex: 1,
          bg: "canvas.default",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          px: [4, 5, 6],
          py: 5,
        }}
      >
        {/* Top-right: sign-in link */}
        <Box
          sx={{
            position: "absolute",
            top: 3,
            right: 4,
            fontSize: 1,
          }}
        >
          <Text sx={{ color: "fg.muted", mr: 2 }}>Already have an account?</Text>
          <Link as={RouterLink} to="/login" sx={{ fontWeight: "bold" }}>
            Sign in <ArrowRightIcon size={14} />
          </Link>
        </Box>

        <Box
          sx={{
            width: "100%",
            maxWidth: "420px",
            mx: "auto",
            mt: 5,
          }}
        >
          <Heading as="h1" sx={{ fontSize: 4, fontWeight: "bold", mb: 4 }}>
            Sign up for Fino
          </Heading>

          <Box as="form" onSubmit={onSubmit}>
            {error && (
              <Flash variant="danger" sx={{ mb: 3 }}>
                {error}
              </Flash>
            )}

            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, mb: 3 }}>
              <FormControl>
                <FormControl.Label>First name</FormControl.Label>
                <TextInput
                  value={firstname}
                  onChange={(e) => setFirstname(e.target.value)}
                  block
                  size="large"
                  autoComplete="given-name"
                />
              </FormControl>
              <FormControl>
                <FormControl.Label>Last name</FormControl.Label>
                <TextInput
                  value={lastname}
                  onChange={(e) => setLastname(e.target.value)}
                  block
                  size="large"
                  autoComplete="family-name"
                />
              </FormControl>
            </Box>

            <FormControl required sx={{ mb: 3 }}>
              <FormControl.Label>Email</FormControl.Label>
              <TextInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                block
                size="large"
                autoComplete="email"
              />
            </FormControl>

            <FormControl required sx={{ mb: 3 }}>
              <FormControl.Label>Password</FormControl.Label>
              <TextInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                block
                size="large"
                autoComplete="new-password"
              />
              <FormControl.Caption>
                Password should be at least {MIN_PASSWORD} characters. Use
                something strong.
              </FormControl.Caption>
            </FormControl>

            <FormControl required sx={{ mb: 4 }}>
              <FormControl.Label>Username</FormControl.Label>
              <TextInput
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                block
                size="large"
                autoComplete="username"
              />
              <FormControl.Caption>
                Username may only contain alphanumeric characters, underscores or
                single hyphens, and cannot begin or end with a hyphen.
              </FormControl.Caption>
            </FormControl>

            <Button
              type="submit"
              variant="primary"
              size="large"
              block
              disabled={submitting}
              trailingIcon={ArrowRightIcon}
            >
              {submitting ? "Creating account…" : "Create account"}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
