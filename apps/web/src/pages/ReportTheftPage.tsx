import { useState, useEffect, type FormEvent } from "react";
import { useLanguage } from "@/i18n/context";
import { apiRequest, isNetworkError } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-utils";
import { Button } from "@/components/ui/Button";
import { ServiceUnavailable } from "@/components/auth/ServiceUnavailable";

type Item = {
  id: string;
  name: string;
  rnbpNumber: string | null;
  status: string;
  archivedAt: string | null;
};

export function ReportTheftPage() {
  const { t } = useLanguage();
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [policeReportNumber, setPoliceReportNumber] = useState("");
  const [theftDate, setTheftDate] = useState("");
  const [theftLocation, setTheftLocation] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [backendDown, setBackendDown] = useState(false);

  useEffect(() => {
    apiRequest<{ items: Item[] }>("/items")
      .then((data) => {
        setItems(data.items.filter((i) => i.status === "active" && !i.archivedAt));
      })
      .catch((err) => {
        if (isNetworkError(err)) { setBackendDown(true); return; }
        setLoadError(getErrorMessage(err, t));
      })
      .finally(() => setLoadingItems(false));
  }, [t]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedItemId) return;
    setLoading(true);
    setError("");

    try {
      await apiRequest("/reports", {
        method: "POST",
        body: {
          itemId: selectedItemId,
          policeReportNumber: policeReportNumber || undefined,
          theftDate: theftDate ? new Date(theftDate).toISOString() : undefined,
          theftLocation: theftLocation || undefined,
          description: description || undefined,
        },
      });
      setSuccess(true);
    } catch (err) {
      if (isNetworkError(err)) { setBackendDown(true); return; }
      setError(getErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <section className="section-shell py-16">
        <div className="mx-auto max-w-lg text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg className="h-8 w-8 text-red-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="mt-6 text-2xl font-bold text-[var(--rcb-text-strong)]">
            {t.report?.successHeading ?? "Theft reported"}
          </h2>
          <p className="mt-3 text-[var(--rcb-text-muted)]">
            {t.report?.successDescription ?? "Your report has been recorded. The item's status has been updated in the registry."}
          </p>
        </div>
      </section>
    );
  }

  if (backendDown) {
    return (
      <section className="min-h-[70vh] bg-[var(--rcb-white)]">
        <ServiceUnavailable />
      </section>
    );
  }

  return (
    <section className="section-shell py-16">
      <title>{`${t.report?.heading ?? "Report a theft"} | RNBP`}</title>
      <h1 className="text-3xl font-bold text-[var(--rcb-text-strong)]">
        {t.report?.heading ?? "Report a theft"}
      </h1>
      <p className="mt-2 text-lg text-[var(--rcb-text-muted)]">
        {t.report?.description ?? "Report a stolen item to update its status in the registry."}
      </p>

      {loadError && (
        <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {loadingItems ? (
        <div className="mt-16 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--rcb-primary)] border-t-transparent" />
        </div>
      ) : items.length === 0 && !loadError ? (
        <div className="mt-10 rounded-xl border border-[var(--rcb-border)] bg-[var(--rcb-surface)] p-8 text-center">
          <p className="text-[var(--rcb-text-muted)]">
            {t.report?.noActiveItems ?? "No active items to report. Register an item first."}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 max-w-xl space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div>
            <label htmlFor="report-item" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
              {t.report?.itemLabel ?? "Item concerned"} *
            </label>
            <select
              id="report-item"
              required
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
            >
              <option value="">{t.report?.itemPlaceholder ?? "Select an item"}</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.rnbpNumber ? ` (${item.rnbpNumber})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="report-police" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
              {t.report?.policeReportLabel ?? "Police report number"}
            </label>
            <input
              id="report-police"
              type="text"
              value={policeReportNumber}
              onChange={(e) => setPoliceReportNumber(e.target.value)}
              className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="report-date" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
                {t.report?.theftDateLabel ?? "Theft date"}
              </label>
              <input
                id="report-date"
                type="date"
                value={theftDate}
                onChange={(e) => setTheftDate(e.target.value)}
                className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="report-location" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
                {t.report?.theftLocationLabel ?? "Theft location"}
              </label>
              <input
                id="report-location"
                type="text"
                value={theftLocation}
                onChange={(e) => setTheftLocation(e.target.value)}
                className="h-12 w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="report-description" className="mb-1 block text-sm font-medium text-[var(--rcb-text-strong)]">
              {t.report?.descriptionLabel ?? "Description of circumstances"}
            </label>
            <textarea
              id="report-description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 py-3 text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
            />
          </div>

          <Button
            type="submit"
            disabled={!selectedItemId || loading}
            className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (t.report?.submitting ?? "Submitting...") : (t.report?.submitButton ?? "Report theft")}
          </Button>
        </form>
      )}
    </section>
  );
}
export default ReportTheftPage;
