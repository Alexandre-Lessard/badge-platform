import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/i18n/context";
import { apiRequest, isNetworkError, type ApiError } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-utils";
import { PASSWORD_RESET_REQUIRED } from "@badge/shared";
import { Button } from "@/components/ui/Button";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { ServiceUnavailable } from "@/components/auth/ServiceUnavailable";
import { ROUTES } from "@/routes/routes";

export function LoginPage() {
  const { login, backendAvailable } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect") || ROUTES.dashboard;
  const { t } = useLanguage();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [backendDown, setBackendDown] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setResetSent(false);
    setLoading(true);

    try {
      await login(email, password);
      navigate(redirect, { replace: true });
    } catch (err) {
      if (isNetworkError(err)) {
        setBackendDown(true);
        return;
      }

      // Accounts predating the Cloudflare migration hold an argon2 hash the
      // Worker cannot verify. Login refuses them outright; send the reset link
      // straight away so the person is one click from being back in.
      if ((err as ApiError)?.code === PASSWORD_RESET_REQUIRED) {
        try {
          await apiRequest("/auth/forgot-password", {
            method: "POST",
            body: { email: email.trim().toLowerCase() },
          });
          setResetSent(true);
        } catch {
          // Sending failed — fall back to the plain message, which already
          // tells them to reset. The forgot-password page still works.
          setError(getErrorMessage(err, t));
        }
        return;
      }

      setError(getErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  }

  if (backendDown || !backendAvailable) {
    return (
      <section className="min-h-[70vh] bg-[var(--rcb-white)]">
        <ServiceUnavailable />
      </section>
    );
  }

  return (
    <section className="flex min-h-[70vh] items-center justify-center bg-[var(--rcb-white)] px-4 py-16">
      
        <title>{t.pages.login.title}</title>
        <meta name="description" content={t.pages.login.description} />
      
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-[var(--rcb-text-strong)]">
          {t.auth?.loginHeading ?? "Log in"}
        </h1>
        <p className="mt-2 text-[var(--rcb-text-muted)]">
          {t.auth?.loginDescription ??
            "Log in to your Badge account"}
        </p>

        <div className="mt-8">
          <OAuthButtons redirect={redirect} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {resetSent && (
            <div className="rounded-lg bg-[var(--rcb-primary)]/8 px-4 py-3 text-sm text-[var(--rcb-text-strong)]">
              <p className="font-semibold">
                {t.auth?.resetRequiredHeading ?? "Your password needs to be updated"}
              </p>
              <p className="mt-1 leading-relaxed text-[var(--rcb-text-body)]">
                {t.auth?.resetRequiredBody ??
                  "For security reasons, this account needs a new password. We just sent you a link to set one."}
              </p>
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]"
            >
              {t.auth?.emailLabel ?? "Email"}
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]"
            >
              {t.auth?.passwordLabel ?? "Password"}
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer disabled:opacity-50"
          >
            {loading
              ? (t.auth?.loggingIn ?? "Logging in...")
              : (t.auth?.loginButton ?? "Log in")}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--rcb-text-muted)]">
          {t.auth?.noAccount ?? "No account yet?"}{" "}
          <Link
            to={ROUTES.register}
            className="font-medium text-[var(--rcb-primary)] hover:underline"
          >
            {t.auth?.registerLink ?? "Create an account"}
          </Link>
        </p>
      </div>
    </section>
  );
}
export default LoginPage;
