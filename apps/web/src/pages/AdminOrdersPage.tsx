import { useState, useEffect } from "react";
import { Link } from "react-router";
import { apiRequest } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-utils";
import { useLanguage } from "@/i18n/context";
import { ROUTES } from "@/routes/routes";

type Order = {
  id: string;
  email: string;
  status: string;
  totalAmountCents: number;
  itemCount: number;
  createdAt: string;
};

const statusTabs = ["paid", "shipped", "all"] as const;
type StatusTab = (typeof statusTabs)[number];

const statusLabels: Record<StatusTab, string> = {
  paid: "Paid",
  shipped: "Shipped",
  all: "All",
};

const statusColors: Record<string, string> = {
  paid: "bg-yellow-100 text-yellow-800",
  shipped: "bg-green-100 text-green-800",
  pending: "bg-gray-100 text-gray-800",
};

export function AdminOrdersPage() {
  const { t } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<StatusTab>("paid");

  useEffect(() => {
    let cancelled = false;
    const url = tab === "all" ? "/admin/orders" : `/admin/orders?status=${tab}`;
    apiRequest<{ orders: Order[] }>(url)
      .then((data) => { if (!cancelled) setOrders(data.orders); })
      .catch((err) => { if (!cancelled) setError(getErrorMessage(err, t)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tab, t]);

  return (
    <section className="min-h-[80vh] bg-[var(--rcb-white)]">
      <title>{`Admin — ${t.admin?.nav.orders ?? "Orders"} | Badge`}</title>
      <div className="section-shell py-16">
        <h1 className="text-3xl font-bold text-[var(--rcb-text-strong)]">
          Orders
        </h1>

        <div className="mt-6 flex gap-2">
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
              {statusLabels[s]}
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
        ) : orders.length === 0 ? (
          <div className="mt-10 rounded-xl border border-[var(--rcb-border)] bg-[var(--rcb-surface)] p-10 text-center">
            <p className="text-[var(--rcb-text-muted)]">No orders.</p>
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {orders.map((order) => (
              <Link
                key={order.id}
                to={ROUTES.adminOrderDetail(order.id)}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--rcb-border)] bg-[var(--rcb-bg)] p-5 transition-colors hover:bg-[var(--rcb-surface)]"
              >
                <div className="flex-1">
                  <p className="font-medium text-[var(--rcb-text-strong)]">
                    {order.email}
                  </p>
                  <p className="mt-1 text-sm text-[var(--rcb-text-muted)]">
                    {new Date(order.createdAt).toLocaleDateString("en-CA")} — {order.itemCount} {order.itemCount > 1 ? "items" : "item"} — {(order.totalAmountCents / 100).toFixed(2)} $
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${statusColors[order.status] ?? "bg-gray-100 text-gray-800"}`}
                >
                  {order.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
export default AdminOrdersPage;
