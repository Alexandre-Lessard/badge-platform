import { useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-utils";
import { useLanguage } from "@/i18n/context";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

type AdminItem = {
  id: string;
  name: string;
  category: string;
  status: string;
  badgeCode: string | null;
  serialNumber: string | null;
  createdAt: string;
  ownerName: string;
  ownerEmail: string;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
};

const statusTabs = ["all", "stolen", "active"] as const;
type StatusTab = (typeof statusTabs)[number];

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  stolen: "bg-red-100 text-red-800",
  recovered: "bg-blue-100 text-blue-800",
  transferred: "bg-gray-100 text-gray-800",
};

export function AdminItemsPage() {
  const { t } = useLanguage();
  const [items, setItems] = useState<AdminItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<StatusTab>("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [recoverItemId, setRecoverItemId] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);

  const statusLabels = t.dashboard?.statuses ?? {};

  const fetchItems = useCallback(async (status: string, query: string, page: number) => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (query.trim()) params.set("q", query.trim());
    params.set("page", String(page));
    params.set("limit", "25");

    try {
      const data = await apiRequest<{ items: AdminItem[]; pagination: Pagination }>(
        `/admin/items?${params}`,
      );
      setItems(data.items);
      setPagination(data.pagination);
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchItems(tab, search, 1);
  }, [tab, search, fetchItems]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
  }

  async function confirmRecover() {
    if (!recoverItemId || recovering) return;
    setRecovering(true);
    try {
      await apiRequest(`/admin/items/${recoverItemId}/recover`, { method: "PATCH" });
      setItems((prev) =>
        prev.map((item) => (item.id === recoverItemId ? { ...item, status: "active" } : item)),
      );
      setRecoverItemId(null);
    } catch (err) {
      setError(getErrorMessage(err, t));
      setRecoverItemId(null);
    } finally {
      setRecovering(false);
    }
  }

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <section className="min-h-[80vh] bg-[var(--rcb-white)]">
      <title>{`Admin — ${t.admin?.nav.items ?? "Items"} | Badge`}</title>
      <div className="section-shell py-16">
        <h1 className="text-3xl font-bold text-[var(--rcb-text-strong)]">
          {t.admin?.nav.items ?? "Items"}
        </h1>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="mt-6 flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Badge#, serial, name..."
            className="h-10 flex-1 rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 text-sm text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
          />
          <Button size="sm" onClick={() => setSearch(searchInput)}>
            {t.buttons?.verifyItem ?? "Search"}
          </Button>
          {search && (
            <button
              type="button"
              onClick={() => { setSearchInput(""); setSearch(""); }}
              className="cursor-pointer px-3 text-sm text-[var(--rcb-text-muted)] hover:text-[var(--rcb-text-strong)]"
            >
              &times;
            </button>
          )}
        </form>

        {/* Status tabs */}
        <div className="mt-4 flex gap-2">
          {statusTabs.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setTab(s)}
              className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === s
                  ? "bg-[var(--rcb-primary)] text-white"
                  : "bg-[var(--rcb-surface)] text-[var(--rcb-text-muted)] hover:bg-[var(--rcb-border)]"
              }`}
            >
              {s === "all" ? (t.admin?.nav.items ?? "All") : (statusLabels[s] ?? s)}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-16 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--rcb-primary)] border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <div className="mt-10 rounded-xl border border-[var(--rcb-border)] bg-[var(--rcb-surface)] p-10 text-center">
            <p className="text-[var(--rcb-text-muted)]">No items found.</p>
          </div>
        ) : (
          <>
            <div className="mt-6 text-sm text-[var(--rcb-text-muted)]">
              {pagination.total} result{pagination.total !== 1 ? "s" : ""}
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--rcb-border)] text-xs uppercase text-[var(--rcb-text-muted)]">
                    <th className="px-3 py-2">Badge#</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Owner</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-[var(--rcb-border)] transition-colors hover:bg-[var(--rcb-surface)]"
                    >
                      <td className="px-3 py-3 font-mono text-xs">
                        {item.badgeCode ?? "—"}
                      </td>
                      <td className="px-3 py-3 font-medium text-[var(--rcb-text-strong)]">
                        {item.name}
                      </td>
                      <td className="px-3 py-3 text-[var(--rcb-text-muted)]">
                        {item.category}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[item.status] ?? "bg-gray-100 text-gray-800"}`}>
                          {statusLabels[item.status] ?? item.status}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-[var(--rcb-text-strong)]">{item.ownerName}</p>
                        <p className="text-xs text-[var(--rcb-text-muted)]">{item.ownerEmail}</p>
                      </td>
                      <td className="px-3 py-3 text-[var(--rcb-text-muted)]">
                        {new Date(item.createdAt).toLocaleDateString("en-CA")}
                      </td>
                      <td className="px-3 py-3">
                        {item.status === "stolen" && (
                          <button
                            type="button"
                            onClick={() => setRecoverItemId(item.id)}
                            className="cursor-pointer text-xs font-medium text-[var(--rcb-primary)] hover:underline"
                          >
                            {t.editItem?.recoverButton ?? "Recover"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchItems(tab, search, pagination.page - 1)}
                  className="cursor-pointer rounded-lg px-3 py-1.5 text-sm text-[var(--rcb-text-muted)] hover:bg-[var(--rcb-surface)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  &larr;
                </button>
                <span className="text-sm text-[var(--rcb-text-muted)]">
                  {pagination.page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={pagination.page >= totalPages}
                  onClick={() => fetchItems(tab, search, pagination.page + 1)}
                  className="cursor-pointer rounded-lg px-3 py-1.5 text-sm text-[var(--rcb-text-muted)] hover:bg-[var(--rcb-surface)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  &rarr;
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Recover confirmation modal */}
      <Modal
        open={!!recoverItemId}
        onClose={() => setRecoverItemId(null)}
        title={t.editItem?.recoverButton ?? "Mark as recovered"}
      >
        <p className="text-sm text-[var(--rcb-text-muted)]">
          {t.editItem?.recoverConfirm ?? "Confirm this item has been recovered?"}
        </p>
        <div className="mt-6 flex gap-3">
          <Button
            onClick={confirmRecover}
            disabled={recovering}
            size="sm"
          >
            {recovering
              ? (t.editItem?.recovering ?? "Processing…")
              : (t.editItem?.recoverConfirmButton ?? "Yes, mark as recovered")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRecoverItemId(null)}
          >
            {t.editItem?.recoverCancel ?? "Cancel"}
          </Button>
        </div>
      </Modal>
    </section>
  );
}
export default AdminItemsPage;
