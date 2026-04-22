import { useState, type FormEvent } from "react";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
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
import { resetPassword } from "@/api/auth";
import { setAuthToken, StrapiError } from "@/api/client";
import logoUrl from "@/assets/logo-dark.png";

const MIN_PASSWORD = 6;

// Consumes the `code` query param emitted by Strapi's forgot-password email
// template (e.g. `.../reset-password?code=xxxx`). If the user lands here
// without a code, we show an input so they can paste it manually — useful in
// the Electron context where the email link may open in the browser rather
// than deep-link into the app.
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [code, setCode] = useState(params.get("code") ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!code.trim()) {
      setError("The reset code is missing.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await resetPassword({
        code: code.trim(),
        password,
        passwordConfirmation: confirm,
      });
      setAuthToken(res.jwt);
      window.localStorage.setItem("fino.auth.token", res.jwt);
      window.location.assign("/clients");
    } catch (err) {
      if (err instanceof StrapiError) {
        setError(err.message);
      } else {
        setError("Could not reset your password. The link may have expired.");
      }
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
            Set a new password
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

          {!params.get("code") && (
            <FormControl sx={{ mb: 3 }}>
              <FormControl.Label>Reset code</FormControl.Label>
              <TextInput
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                block
                size="large"
              />
              <FormControl.Caption>
                Paste the code from the reset email.
              </FormControl.Caption>
            </FormControl>
          )}

          <FormControl sx={{ mb: 3 }}>
            <FormControl.Label>New password</FormControl.Label>
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              block
              size="large"
              autoComplete="new-password"
            />
          </FormControl>

          <FormControl sx={{ mb: 3 }}>
            <FormControl.Label>Confirm new password</FormControl.Label>
            <TextInput
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              block
              size="large"
              autoComplete="new-password"
            />
          </FormControl>

          <Button
            type="submit"
            variant="primary"
            size="large"
            block
            disabled={submitting}
          >
            {submitting ? "Updating password…" : "Update password"}
          </Button>
        </Box>

        <Box sx={{ mt: 3, textAlign: "center" }}>
          <Link
            as={RouterLink}
            to="/login"
            sx={{ fontSize: 1 }}
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              navigate("/login");
            }}
          >
            ← Back to sign in
          </Link>
        </Box>
      </Box>
    </Box>
  );
}
