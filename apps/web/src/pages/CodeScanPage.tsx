import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { useLanguage } from "@/i18n/context";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, isNetworkError } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-utils";
import { Button } from "@/components/ui/Button";
import { getButtonClasses } from "@/lib/button-styles";
import { ServiceUnavailable } from "@/components/auth/ServiceUnavailable";
import { AssignRnbpModal } from "@/components/AssignRnbpModal";
import { normalizeRnbpCode } from "@rnbp/shared";
import { ROUTES } from "@/routes/routes";

type ScanResponse = {
  format: "valid" | "invalid";
  exists?: boolean;
  voided?: boolean;
  ownedByMe?: boolean;
  assignableByMe?: boolean;
  item?: {
    found: true;
    status: "active" | "stolen" | "recovered" | "transferred";
    category: string;
    brand: string | null;
    model: string | null;
    isYours: boolean;
    itemId?: string;
  };
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  stolen: "bg-red-100 text-red-800",
  recovered: "bg-blue-100 text-blue-800",
  transferred: "bg-gray-100 text-gray-800",
};

export function CodeScanPage() {
  const { code: rawCode } = useParams<{ code: string }>();
  const code = normalizeRnbpCode(rawCode ?? "");
  const { t } = useLanguage();
  const { user } = useAuth();
  const [data, setData] = useState<ScanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [backendDown, setBackendDown] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  useEffect(() => {
    // Empty code from useParams is impossible given the route shape (`/c/:code`
    // can't match without a value), but if we somehow get an empty string the
    // backend returns `format: "invalid"` for free — keep the effect simple.
    apiRequest<ScanResponse>(`/sticker-codes/${encodeURIComponent(code)}/scan`)
      .then(setData)
      .catch((err) => {
        if (isNetworkError(err)) setBackendDown(true);
        else setError(getErrorMessage(err, t));
      })
      .finally(() => setLoading(false));
  }, [code, t]);

  function handleAssignSuccess(claimedCode: string, itemId: string) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            ownedByMe: true,
            assignableByMe: false,
            item: {
              found: true,
              status: "active",
              category: "—",
              brand: null,
              model: null,
              isYours: true,
              itemId,
            },
          }
        : prev,
    );
    // After a successful claim, the in-place item card is the easiest UX:
    // we route the user to their item edit page so they can complete details.
    void claimedCode;
  }

  if (backendDown) {
    return (
      <section className="min-h-[60vh] bg-[var(--rcb-white)]">
        <ServiceUnavailable />
      </section>
    );
  }

  const scan = t.scan;
  const dash = t.dashboard;

  const wrapper =
    "flex min-h-[70vh] items-start justify-center bg-[var(--rcb-white)] px-4 py-12 sm:items-center";
  const card =
    "w-full max-w-md rounded-2xl border border-[var(--rcb-border)] bg-[var(--rcb-bg)] p-6 shadow-sm sm:p-8";

  if (loading) {
    return (
      <section className={wrapper}>
        <div className="flex h-32 w-full max-w-md items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--rcb-primary)] border-t-transparent" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className={wrapper}>
        <div className={card}>
          <p className="text-sm text-red-700">{error}</p>
          <Link
            to={ROUTES.home}
            className={`${getButtonClasses("outline", "sm")} mt-4 inline-block`}
          >
            {t.errors?.backHome ?? "Back to home"}
          </Link>
        </div>
      </section>
    );
  }

  if (!data || data.format === "invalid") {
    return (
      <section className={wrapper}>
        <div className={card}>
          <h1 className="text-xl font-bold text-[var(--rcb-text-strong)]">
            {scan?.invalidCode ?? "Invalid code."}
          </h1>
          <p className="mt-2 font-mono text-xs text-[var(--rcb-text-muted)]">{rawCode}</p>
          <Link
            to={ROUTES.home}
            className={`${getButtonClasses("outline", "sm")} mt-6 inline-block`}
          >
            {t.errors?.backHome ?? "Back to home"}
          </Link>
        </div>
      </section>
    );
  }

  // ── Voided ────────────────────────────────────────────
  if (data.voided) {
    return (
      <section className={wrapper}>
        <div className={card}>
          <h1 className="text-xl font-bold text-[var(--rcb-text-strong)]">
            {scan?.voided ?? "This code is no longer valid. Contact support."}
          </h1>
          <p className="mt-2 font-mono text-xs text-[var(--rcb-text-muted)]">{code}</p>
          <Link
            to={ROUTES.contact}
            className={`${getButtonClasses("outline", "sm")} mt-6 inline-block`}
          >
            {scan?.contactLink ?? "Contact the NRPP"}
          </Link>
        </div>
      </section>
    );
  }

  // ── Code does not exist in our database ───────────────
  if (!data.exists) {
    return (
      <section className={wrapper}>
        <div className={card}>
          <h1 className="text-xl font-bold text-[var(--rcb-text-strong)]">
            {scan?.notDistributed ?? "This code has not been distributed yet."}
          </h1>
          <p className="mt-2 font-mono text-xs text-[var(--rcb-text-muted)]">{code}</p>
          <Link
            to={ROUTES.lookup}
            className={`${getButtonClasses("outline", "sm")} mt-6 inline-block`}
          >
            {scan?.tryAnother ?? "Look up another"}
          </Link>
        </div>
      </section>
    );
  }

  // ── Code exists and is assigned to an item ────────────
  if (data.item) {
    const { item } = data;

    if (item.isYours && item.itemId) {
      return (
        <section className={wrapper}>
          <div className={card}>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--rcb-primary)]">
              {scan?.yourItem ?? "Your item"}
            </p>
            <h1 className="mt-1 text-xl font-bold text-[var(--rcb-text-strong)]">
              {[item.brand, item.model].filter(Boolean).join(" ") || item.category}
            </h1>
            <p className="mt-1 text-sm text-[var(--rcb-text-muted)]">{item.category}</p>
            <div className="mt-3">
              <span
                className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${statusColors[item.status] ?? "bg-gray-100 text-gray-800"}`}
              >
                {dash?.statuses?.[item.status] ?? item.status}
              </span>
            </div>
            <p className="mt-3 font-mono text-xs text-[var(--rcb-text-muted)]">{code}</p>
            <div className="mt-6 flex flex-col gap-2">
              <Link
                to={ROUTES.itemDetail(item.itemId)}
                className={getButtonClasses("primary", "sm", "w-full text-center")}
              >
                {scan?.viewItem ?? "View item"}
              </Link>
              {item.status === "stolen" && (
                <Link
                  to={ROUTES.itemDetail(item.itemId)}
                  className={getButtonClasses("outline", "sm", "w-full text-center")}
                >
                  {scan?.markRecovered ?? "Mark as recovered"}
                </Link>
              )}
            </div>
          </div>
        </section>
      );
    }

    // Public view (anyone else who scans)
    return (
      <section className={wrapper}>
        <div className={card}>
          {item.status === "stolen" && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {scan?.stolenBanner ??
                "This item has been reported stolen. Contact the NRPP if you've recovered it."}
            </div>
          )}
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--rcb-text-muted)]">
            {scan?.publicViewTitle ?? "Item registered with the NRPP"}
          </p>
          <h1 className="mt-1 text-xl font-bold text-[var(--rcb-text-strong)]">
            {[item.brand, item.model].filter(Boolean).join(" ") || item.category}
          </h1>
          <p className="mt-1 text-sm text-[var(--rcb-text-muted)]">{item.category}</p>
          <div className="mt-3">
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${statusColors[item.status] ?? "bg-gray-100 text-gray-800"}`}
            >
              {dash?.statuses?.[item.status] ?? item.status}
            </span>
          </div>
          <p className="mt-3 font-mono text-xs text-[var(--rcb-text-muted)]">{code}</p>
          {item.status === "stolen" && (
            <Link
              to={ROUTES.contact}
              className={`${getButtonClasses("primary", "sm", "mt-6 w-full text-center")}`}
            >
              {scan?.contactLink ?? "Contact the NRPP"}
            </Link>
          )}
        </div>
      </section>
    );
  }

  // ── Code exists but not assigned to any item yet ──────
  if (data.assignableByMe) {
    return (
      <section className={wrapper}>
        <div className={card}>
          <h1 className="text-xl font-bold text-[var(--rcb-text-strong)]">
            {scan?.codeIsYours ?? "This code belongs to you!"}
          </h1>
          <p className="mt-2 text-sm text-[var(--rcb-text-muted)]">
            {scan?.assignPrompt ?? "Would you like to assign it to one of your items?"}
          </p>
          <p className="mt-2 font-mono text-xs text-[var(--rcb-text-muted)]">{code}</p>
          <Button
            size="sm"
            className="mt-6 w-full"
            onClick={() => setAssignOpen(true)}
          >
            {scan?.assignButton ?? "Assign"}
          </Button>
        </div>
        <AssignRnbpModal
          mode="pick-item"
          code={code}
          open={assignOpen}
          onClose={() => setAssignOpen(false)}
          onSuccess={handleAssignSuccess}
        />
      </section>
    );
  }

  // Code exists, not assigned, not owned by the scanner
  return (
    <section className={wrapper}>
      <div className={card}>
        <h1 className="text-xl font-bold text-[var(--rcb-text-strong)]">
          {scan?.notAssignedYet ??
            "This code has been distributed but not yet linked to an item."}
        </h1>
        <p className="mt-2 font-mono text-xs text-[var(--rcb-text-muted)]">{code}</p>
        {!user ? (
          <Link
            to={ROUTES.login}
            className={`${getButtonClasses("primary", "sm", "mt-6 w-full text-center")}`}
          >
            {scan?.loginToReclaim ?? "If this code is yours, log in to claim it."}
          </Link>
        ) : (
          <p className="mt-4 text-sm text-[var(--rcb-text-muted)]">
            {scan?.notYours ?? "This code does not belong to you."}
          </p>
        )}
      </div>
    </section>
  );
}
export default CodeScanPage;
