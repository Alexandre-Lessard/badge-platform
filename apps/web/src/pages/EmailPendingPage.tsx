import { useState } from "react";
import { Navigate } from "react-router";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/i18n/context";
import { apiRequest } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { ROUTES } from "@/routes/routes";

export function EmailPendingPage() {
  const { user, logout, refreshUser } = useAuth();
  const { t, locale } = useLanguage();
  const ep = t.emailPending!;

  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [checkStatus, setCheckStatus] = useState<"idle" | "checking" | "not_verified">("idle");

  if (!user) {
    return <Navigate to={ROUTES.login} replace />;
  }

  if (user.emailVerified) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  async function handleResend() {
    setResendStatus("sending");
    try {
      await apiRequest("/auth/resend-verification", { method: "POST" });
      setResendStatus("sent");
    } catch {
      setResendStatus("error");
    }
  }

  async function handleCheckVerified() {
    setCheckStatus("checking");
    await refreshUser();
    // If refreshUser updated emailVerified to true, the Navigate above will trigger.
    // If we're still here, it means email is not verified yet.
    setCheckStatus("not_verified");
  }

  return (
    <section className="min-h-[80vh] bg-[var(--rcb-white)]">
      <title>{`${locale === "fr" ? "Vérification du courriel" : "Email verification"} | Badge`}</title>
      <div className="section-shell flex flex-col items-center justify-center py-16">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
          <svg className="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-[var(--rcb-text-strong)] mb-2">
          {ep.heading}
        </h1>

        <p className="text-[var(--rcb-text)] text-center max-w-md mb-2">
          {ep.description}
        </p>

        <p className="text-[var(--rcb-text-strong)] font-medium mb-8">
          {user.email}
        </p>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button
            variant="primary"
            onClick={handleCheckVerified}
            disabled={checkStatus === "checking"}
          >
            {checkStatus === "checking" ? "..." : ep.checkAgain}
          </Button>

          {checkStatus === "not_verified" && (
            <p className="text-sm text-amber-600 text-center">
              {ep.notVerifiedYet}
            </p>
          )}

          <Button
            variant="outline"
            onClick={handleResend}
            disabled={resendStatus === "sending" || resendStatus === "sent"}
          >
            {resendStatus === "sent" ? ep.resendSuccess : ep.resendButton}
          </Button>

          <button
            onClick={() => logout()}
            className="text-sm text-[var(--rcb-text)] underline hover:text-[var(--rcb-text-strong)] mt-2"
          >
            {ep.logoutButton}
          </button>
        </div>
      </div>
    </section>
  );
}
export default EmailPendingPage;
