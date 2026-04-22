import { useState, type FormEvent } from "react";
import { Link as RouterLink } from "react-router-dom";
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
import { forgotPassword } from "@/api/auth";
import { StrapiError } from "@/api/client";
import logoUrl from "@/assets/logo-dark.png";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await forgotPassword({ email: email.trim() });
      setSent(true);
    } catch (err) {
      // Note: Strapi intentionally returns 200 on unknown emails to avoid
      // account enumeration, so errors here are usually infra / config.
      if (err instanceof StrapiError) {
        setError(err.message);
      } else {
        setError("Could not send the reset email. Please try again.");
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
            Reset your password
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
          {sent ? (
            <>
              <Flash variant="success" sx={{ mb: 3 }}>
                If an account exists for <strong>{email}</strong>, we've sent
                password reset instructions.
              </Flash>
              <Text sx={{ fontSize: 1, color: "fg.muted", display: "block", mb: 3 }}>
                Check your inbox for the reset link. It contains a code that
                will let you set a new password.
              </Text>
            </>
          ) : (
            <>
              {error && (
                <Flash variant="danger" sx={{ mb: 3 }}>
                  {error}
                </Flash>
              )}
              <Text sx={{ fontSize: 1, color: "fg.muted", display: "block", mb: 3 }}>
                Enter the email address associated with your account and we'll
                send you a link to reset your password.
              </Text>
              <FormControl sx={{ mb: 3 }}>
                <FormControl.Label>Email address</FormControl.Label>
                <TextInput
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  required
                  block
                  size="large"
                  autoComplete="email"
                />
              </FormControl>
              <Button
                type="submit"
                variant="primary"
                size="large"
                block
                disabled={submitting}
              >
                {submitting ? "Sending…" : "Send reset link"}
              </Button>
            </>
          )}
        </Box>

        <Box sx={{ mt: 3, textAlign: "center" }}>
          <Link as={RouterLink} to="/login" sx={{ fontSize: 1 }}>
            ← Back to sign in
          </Link>
        </Box>
      </Box>
    </Box>
  );
}
