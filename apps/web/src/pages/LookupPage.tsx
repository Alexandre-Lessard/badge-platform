import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useLanguage } from "@/i18n/context";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/Button";
import { apiRequest, isNetworkError } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-utils";
import { ServiceUnavailable } from "@/components/auth/ServiceUnavailable";
import { ROUTES } from "@/routes/routes";

type LookupResult = {
  found: boolean;
  status?: string;
  category?: string;
  brand?: string | null;
  model?: string | null;
};

export function LookupPage() {
  const { t } = useLanguage();
  const { backendAvailable } = useAuth();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [backendDown, setBackendDown] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);

    try {
      const data = await apiRequest<LookupResult>(
        `/lookup?q=${encodeURIComponent(query.trim())}`,
      );
      setResult(data);
    } catch (err) {
      if (isNetworkError(err)) {
        setBackendDown(true);
        return;
      }
      setError(getErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  }

  if (backendDown || !backendAvailable) {
    return (
      <section className="min-h-[60vh] bg-[var(--rcb-white)]">
        <ServiceUnavailable />
      </section>
    );
  }

  return (
    <section className="flex min-h-[60vh] items-center justify-center bg-[var(--rcb-white)] px-4 py-16">
      
        <title>{t.pages.lookup.title}</title>
        <meta name="description" content={t.pages.lookup.description} />
      
      <div className="w-full max-w-lg text-center">
        <h1 className="text-3xl font-bold text-[var(--rcb-text-strong)]">
          {t.lookup?.heading ?? "Verify an item"}
        </h1>

        <form
          onSubmit={handleSubmit}
          className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
        >
          <div className="w-full sm:max-w-xs">
            <label htmlFor="lookup-query" className="sr-only">
              {t.lookup?.inputLabel ?? "Identifier to verify"}
            </label>
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--rcb-text-muted)]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                id="lookup-query"
                type="text"
                placeholder=""
                value={query}
                onChange={(e) => setQuery(e.target.value.toUpperCase())}
                className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] pl-10 pr-4 text-left text-lg tracking-wider text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
              />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="cursor-pointer disabled:opacity-50">
            {loading
              ? (t.lookup?.searching ?? "Searching...")
              : (t.lookup?.searchButton ?? "Verify")}
          </Button>
        </form>
        <p className="mt-3 text-sm text-[var(--rcb-text-muted)]">
          {t.lookup?.inputHint ?? "Badge code, serial number or other compatible identifier"}
        </p>

        {error && (
          <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {result && (
          <div
            className={`mt-6 rounded-xl border p-6 ${
              result.found && result.status === "stolen"
                ? "border-red-300 bg-red-50"
                : result.found
                  ? "border-green-300 bg-green-50"
                  : "border-[var(--rcb-border)] bg-[var(--rcb-surface)]"
            }`}
          >
            {result.found ? (
              <>
                <p className="text-lg font-semibold text-[var(--rcb-text-strong)]">
                  {result.status === "stolen"
                    ? (t.lookup?.stolenMessage ?? "This item has been reported stolen")
                    : (t.lookup?.foundMessage ?? "Item found in the registry")}
                </p>
                {result.category && (
                  <p className="mt-2 text-sm text-[var(--rcb-text-muted)]">
                    {result.category}
                    {result.brand ? ` — ${result.brand}` : ""}
                    {result.model ? ` ${result.model}` : ""}
                  </p>
                )}
              </>
            ) : (
              <p className="text-lg text-[var(--rcb-text-muted)]">
                {t.lookup?.notFoundMessage ??
                  "No item found with this number."}
              </p>
            )}
          </div>
        )}

        {/* Link to photo search placeholder */}
        <div className="mt-10 border-t border-[var(--rcb-border)] pt-8">
          <Link
            to={ROUTES.lookupPhoto ?? "/lookup/photo"}
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--rcb-primary)] transition-colors hover:underline"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
            {t.lookup?.photoSearchLink ?? "Photo search"}
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
export default LookupPage;
