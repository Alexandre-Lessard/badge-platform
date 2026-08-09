import { useState, useEffect } from "react";
import { Link } from "react-router";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/i18n/context";
import { apiRequest, isNetworkError } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-utils";
import { getButtonClasses } from "@/lib/button-styles";
import { ServiceUnavailable } from "@/components/auth/ServiceUnavailable";
import { AccountNav } from "@/components/layout/AccountNav";
import { PromoCallout } from "@/components/ui/PromoCallout";
import { ItemImage } from "@/components/ui/ItemImage";
import { AssignBadgeCodeModal } from "@/components/AssignBadgeCodeModal";
import { ROUTES } from "@/routes/routes";

type Item = {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  estimatedValue: number | null;
  status: string;
  badgeCode: string | null;
  primaryPhotoUrl: string | null;
  archivedAt: string | null;
  archiveReason: string | null;
  archiveReasonCustom: string | null;
  createdAt: string;
};

export function DashboardPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [items, setItems] = useState<Item[]>([]);
  const [archivedItems, setArchivedItems] = useState<Item[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [backendDown, setBackendDown] = useState(false);
  const [assignTargetId, setAssignTargetId] = useState<string | null>(null);
  const [assignedFlashId, setAssignedFlashId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiRequest<{ items: Item[] }>("/items"),
      apiRequest<{ items: Item[] }>("/items?archived=true"),
    ])
      .then(([active, all]) => {
        setItems(active.items);
        setArchivedItems(all.items.filter((i) => i.archivedAt !== null));
      })
      .catch((err) => {
        if (isNetworkError(err)) {
          setBackendDown(true);
        } else {
          setLoadError(getErrorMessage(err, t));
        }
      })
      .finally(() => setLoading(false));
  }, [t]);

  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    stolen: "bg-red-100 text-red-800",
    recovered: "bg-blue-100 text-blue-800",
    transferred: "bg-gray-100 text-gray-800",
  };

  const dash = t.dashboard;
  const assignTarget = assignTargetId
    ? items.find((i) => i.id === assignTargetId) ?? null
    : null;

  function handleAssignSuccess(code: string) {
    if (!assignTargetId) return;
    setItems((prev) =>
      prev.map((i) => (i.id === assignTargetId ? { ...i, badgeCode: code } : i)),
    );
    setAssignedFlashId(assignTargetId);
    setTimeout(() => setAssignedFlashId(null), 2500);
  }

  if (backendDown) {
    return (
      <section className="min-h-[80vh] bg-[var(--rcb-white)]">
        <ServiceUnavailable />
      </section>
    );
  }

  return (
    <section className="min-h-[80vh] bg-[var(--rcb-white)]">
      <title>{`${dash?.heading ?? "Dashboard"} | Badge`}</title>
      <div className="section-shell py-16">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[var(--rcb-text-strong)]">
              {dash?.heading ?? "Dashboard"}
            </h1>
            <p className="mt-1 text-lg text-[var(--rcb-text-muted)]">
              {dash?.welcome?.replace("{{name}}", user?.firstName ?? "") ??
                `Welcome, ${user?.firstName}`}
            </p>
            {user?.clientNumber && (
              <p className="mt-1 text-sm text-[var(--rcb-text-muted)]">
                {dash?.clientNumber ?? "Client no."} : {user.clientNumber.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3")}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={ROUTES.registerItem}
              className={getButtonClasses("primary", "sm", "w-[225px] whitespace-nowrap text-center")}
            >
              + {dash?.addItem ?? "Register an item"}
            </Link>
            <Link
              to={ROUTES.shop}
              className={getButtonClasses("outline", "sm", "w-[225px] whitespace-nowrap text-center")}
            >
              {dash?.orderStickersGlobal ?? "Buy stickers"}
            </Link>
            <Link
              to={ROUTES.reportTheft}
              className={getButtonClasses("outline", "sm", "w-[225px] whitespace-nowrap text-center")}
            >
              {dash?.reportTheft ?? "Report a theft"}
            </Link>
          </div>
        </div>

        <AccountNav current="dashboard" className="mt-6" />

        {loadError && (
          <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
          </div>
        )}

        {loading ? (
          <div className="mt-16 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--rcb-primary)] border-t-transparent" />
          </div>
        ) : items.length === 0 && !loadError ? (
          <div className="mt-10 rounded-xl border border-[var(--rcb-border)] bg-[var(--rcb-surface)] p-10 text-center">
            <p className="text-lg text-[var(--rcb-text-muted)]">
              {dash?.noItems ?? "No items registered yet."}
            </p>
            <Link
              to={ROUTES.registerItem}
              className={`${getButtonClasses("primary", "lg")} mt-6`}
            >
              {dash?.addItem ?? "Register an item"}
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const canAssign = !item.badgeCode && item.status === "active";
            return (
              <Link
                key={item.id}
                to={ROUTES.itemDetail(item.id)}
                className="group flex flex-col overflow-hidden rounded-xl border border-[var(--rcb-border)] bg-[var(--rcb-bg)] transition-shadow hover:shadow-md"
              >
                {/* Photo */}
                <div className="relative aspect-square w-full bg-[var(--rcb-surface)]">
                  <ItemImage
                    src={item.primaryPhotoUrl}
                    alt={item.name}
                    blurBackdrop
                    className="h-full w-full"
                    fallbackClassName="flex h-full w-full items-center justify-center bg-[var(--rcb-surface)]"
                  />
                  <span
                    className={`absolute top-2 right-2 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[item.status] ?? "bg-gray-100 text-gray-800"}`}
                  >
                    {dash?.statuses?.[item.status] ?? item.status}
                  </span>
                </div>

                {/* Info */}
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="font-semibold text-[var(--rcb-text-strong)] group-hover:text-[var(--rcb-primary)]">
                    {item.name}
                  </h3>
                  <p className="mt-1 text-xs text-[var(--rcb-text-muted)]">
                    {item.brand}{item.model ? ` ${item.model}` : ""}
                  </p>

                  {item.badgeCode ? (
                    <p className="mt-2 font-mono text-xs tracking-wider text-[var(--rcb-primary)]">
                      {item.badgeCode}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-[var(--rcb-text-muted)]">
                      {dash?.noNumberHint ?? "No badge code assigned yet."}
                    </p>
                  )}

                  {item.estimatedValue && (
                    <p className="mt-1 text-xs text-[var(--rcb-text-muted)]">
                      {item.estimatedValue.toLocaleString()} $
                    </p>
                  )}

                  {/* Actions */}
                  {canAssign && (
                    <div className="mt-auto flex items-center gap-2 pt-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setAssignTargetId(item.id);
                        }}
                        className="w-full cursor-pointer rounded-lg bg-[var(--rcb-surface)] px-3 py-1.5 text-xs font-medium text-[var(--rcb-primary)] transition-colors hover:bg-[var(--rcb-border)]"
                      >
                        {assignedFlashId === item.id
                          ? (dash?.assignBadgeSuccess ?? "✓ Code assigned")
                          : (dash?.assignBadgeButton ?? "Assign an badge code")}
                      </button>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
          </div>
        )}

        {/* ── Promo callout ─────────────────────────────────── */}
        <div className="mt-8">
          <PromoCallout variant="dashboard" items={items} />
        </div>

        {/* ── Archived items section ──────────────────────────── */}
        {archivedItems.length > 0 && (
          <div className="mt-12">
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className="cursor-pointer text-sm font-medium text-[var(--rcb-text-muted)] transition-colors hover:text-[var(--rcb-primary)]"
            >
              {t.archive?.archivedItems ?? "Archived items"} ({archivedItems.length})
              {showArchived ? " ▲" : " ▼"}
            </button>
            {showArchived && (
              <div className="mt-4 space-y-3">
                {archivedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--rcb-border)] bg-[var(--rcb-surface)] p-4 opacity-60"
                  >
                    <div>
                      <h3 className="font-medium text-[var(--rcb-text-strong)]">
                        {item.name}
                      </h3>
                      <p className="mt-0.5 text-xs text-[var(--rcb-text-muted)]">
                        {t.archive?.archivedOn ?? "Archived on"}{" "}
                        {item.archivedAt ? new Date(item.archivedAt).toLocaleDateString() : "—"}
                        {" — "}
                        {t.archive?.reason ?? "Reason"}: {item.archiveReason === "other"
                          ? item.archiveReasonCustom
                          : t.archive?.reasons?.[item.archiveReason ?? ""] ?? item.archiveReason}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Assign-badge modal */}
      {assignTarget && (
        <AssignBadgeCodeModal
          open={true}
          onClose={() => setAssignTargetId(null)}
          itemId={assignTarget.id}
          itemName={assignTarget.name}
          onSuccess={handleAssignSuccess}
        />
      )}
    </section>
  );
}
export default DashboardPage;
