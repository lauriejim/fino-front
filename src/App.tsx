import { BaseStyles, ThemeProvider } from "@primer/react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { QueryProvider } from "@/contexts/QueryProvider";
import { ProtectedRoute } from "@/components/routing/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { ClientsListPage } from "@/pages/ClientsListPage";
import { ClientDetailPage } from "@/pages/ClientDetailPage";
import { SupportsListPage } from "@/pages/SupportsListPage";
import { ArbitragePage } from "@/pages/ArbitragePage";
import { ImportPage } from "@/pages/ImportPage";
import { PlaceholderPage } from "@/pages/PlaceholderPage";

export function App() {
  return (
    <ThemeProvider colorMode="day">
      <BaseStyles>
        <QueryProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />

                <Route
                  element={
                    <ProtectedRoute>
                      <AppShell />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/" element={<Navigate to="/clients" replace />} />
                  <Route path="/clients" element={<ClientsListPage />} />
                  <Route path="/clients/:id" element={<ClientDetailPage />} />
                  <Route path="/supports" element={<SupportsListPage />} />
                  <Route path="/arbitrage" element={<ArbitragePage />} />
                  <Route path="/import" element={<ImportPage />} />
                  <Route path="/about" element={<PlaceholderPage title="About" />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </QueryProvider>
      </BaseStyles>
    </ThemeProvider>
  );
}
