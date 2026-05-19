import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { apiRequest } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-utils";
import { useLanguage } from "@/i18n/context";
import { Button } from "@/components/ui/Button";
import { ROUTES } from "@/routes/routes";
import {
  PRODUCT_SLUGS,
  CODES_PER_SHEET,
  normalizeRnbpCode,
} from "@rnbp/shared";

type StickerCode = {
  code: string;
  claimedAt: string | null;
};

type OrderItem = {
  id: string;
  quantity: number;
  unitPriceCents: number;
  rnbpNumber: string | null;
  itemId: string | null;
  itemName: string | null;
  itemCategory: string | null;
  itemBrand: string | null;
  itemModel: string | null;
  productSlug: string | null;
  productNameFr: string | null;
  productNameEn: string | null;
  customMechanic: string | null;
  codes: StickerCode[];
};

type OrderDetail = {
  id: string;
  email: string;
  status: string;
  totalAmountCents: number;
  createdAt: string;
  items: OrderItem[];
};

const isStickerSheet = (item: OrderItem) =>
  item.productSlug === PRODUCT_SLUGS.STICKER_SHEET;
const hasLegacyItem = (item: OrderItem) => item.itemId !== null;

export function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Sheet-prep state per order line: arrays of {first, last} (one entry per sheet)
  const [sheetInputs, setSheetInputs] = useState<
    Record<string, { firstCode: string; lastCode: string }[]>
  >({});
  const [prepRunning, setPrepRunning] = useState<Record<string, boolean>>({});
  const [prepErrors, setPrepErrors] = useState<Record<string, string>>({});
  const [resetRunning, setResetRunning] = useState<Record<string, boolean>>({});

  const [shipping, setShipping] = useState(false);
  const [shipError, setShipError] = useState("");

  useEffect(() => {
    apiRequest<{ order: OrderDetail }>(`/admin/orders/${id}`)
      .then((data) => {
        setOrder(data.order);
        // Initialize sheet inputs (N empty rows per sticker-sheet line with no codes yet)
        const init: Record<string, { firstCode: string; lastCode: string }[]> = {};
        for (const line of data.order.items) {
          if (isStickerSheet(line) && line.codes.length === 0) {
            init[line.id] = Array.from({ length: line.quantity }, () => ({
              firstCode: "",
              lastCode: "",
            }));
          }
        }
        setSheetInputs(init);
      })
      .catch((err) => setError(getErrorMessage(err, t)))
      .finally(() => setLoading(false));
  }, [id, t]);

  function updateSheetInput(
    orderItemId: string,
    sheetIndex: number,
    field: "firstCode" | "lastCode",
    value: string,
  ) {
    setSheetInputs((prev) => {
      const sheets = prev[orderItemId]?.slice() ?? [];
      sheets[sheetIndex] = { ...sheets[sheetIndex], [field]: value };
      return { ...prev, [orderItemId]: sheets };
    });
  }

  async function handleRegisterCodes(orderItemId: string) {
    const sheets = sheetInputs[orderItemId] ?? [];
    const ranges = sheets.map((s) => ({
      firstCode: normalizeRnbpCode(s.firstCode),
      lastCode: normalizeRnbpCode(s.lastCode),
    }));
    setPrepRunning((p) => ({ ...p, [orderItemId]: true }));
    setPrepErrors((p) => ({ ...p, [orderItemId]: "" }));
    try {
      const { codes } = await apiRequest<{ codes: string[] }>(
        `/admin/orders/${id}/items/${orderItemId}/codes`,
        { method: "POST", body: { ranges } },
      );
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((line) =>
                line.id === orderItemId
                  ? {
                      ...line,
                      codes: codes
                        .map((code) => ({ code, claimedAt: null }))
                        .sort((a, b) => a.code.localeCompare(b.code)),
                    }
                  : line,
              ),
            }
          : prev,
      );
      setSheetInputs((prev) => {
        const next = { ...prev };
        delete next[orderItemId];
        return next;
      });
    } catch (err) {
      setPrepErrors((p) => ({ ...p, [orderItemId]: getErrorMessage(err, t) }));
    } finally {
      setPrepRunning((p) => ({ ...p, [orderItemId]: false }));
    }
  }

  async function handleResetCodes(orderItemId: string) {
    if (
      !confirm(
        "Effacer les codes enregistrés pour cette ligne et recommencer ? Cette action est irréversible.",
      )
    )
      return;
    setResetRunning((v) => ({ ...v, [orderItemId]: true }));
    setPrepErrors((p) => ({ ...p, [orderItemId]: "" }));
    try {
      await apiRequest(`/admin/orders/${id}/items/${orderItemId}/codes`, {
        method: "DELETE",
      });
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((line) =>
                line.id === orderItemId ? { ...line, codes: [] } : line,
              ),
            }
          : prev,
      );
      setSheetInputs((prev) => ({
        ...prev,
        [orderItemId]: Array.from(
          { length: order?.items.find((l) => l.id === orderItemId)?.quantity ?? 1 },
          () => ({ firstCode: "", lastCode: "" }),
        ),
      }));
    } catch (err) {
      setPrepErrors((p) => ({ ...p, [orderItemId]: getErrorMessage(err, t) }));
    } finally {
      setResetRunning((v) => ({ ...v, [orderItemId]: false }));
    }
  }

  async function handleShip() {
    setShipping(true);
    setShipError("");
    try {
      await apiRequest(`/admin/orders/${id}/ship`, { method: "PATCH" });
      setOrder((prev) => (prev ? { ...prev, status: "shipped" } : prev));
    } catch (err) {
      setShipError(getErrorMessage(err, t));
    } finally {
      setShipping(false);
    }
  }

  if (loading) {
    return (
      <section className="min-h-[80vh] bg-[var(--rcb-white)]">
        <div className="section-shell flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--rcb-primary)] border-t-transparent" />
        </div>
      </section>
    );
  }

  if (error || !order) {
    return (
      <section className="min-h-[80vh] bg-[var(--rcb-white)]">
        <div className="section-shell py-16">
          <p className="text-red-600">{error || "Order not found"}</p>
          <Link
            to={ROUTES.adminOrders}
            className="mt-4 inline-block text-sm font-medium text-[var(--rcb-primary)] hover:underline"
          >
            &larr; Back to orders
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-[80vh] bg-[var(--rcb-white)]">
      <title>{`Admin — ${t.admin?.nav.orders ?? "Orders"} | RNBP`}</title>
      <div className="section-shell py-16">
        <Link
          to={ROUTES.adminOrders}
          className="text-sm font-medium text-[var(--rcb-primary)] hover:underline"
        >
          &larr; Back to orders
        </Link>

        <div className="mt-6">
          <h1 className="text-2xl font-bold text-[var(--rcb-text-strong)]">Order</h1>
          <div className="mt-2 space-y-1 text-sm text-[var(--rcb-text-muted)]">
            <p>Customer: {order.email}</p>
            <p>Date: {new Date(order.createdAt).toLocaleDateString("en-CA")}</p>
            <p>Total: {(order.totalAmountCents / 100).toFixed(2)} $</p>
            <p>
              Status: <span className="font-medium">{order.status}</span>
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <h2 className="text-lg font-bold text-[var(--rcb-text-strong)]">Items</h2>
          {order.items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-[var(--rcb-border)] bg-[var(--rcb-bg)] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-[var(--rcb-text-strong)]">
                    {hasLegacyItem(item)
                      ? item.itemName ?? "Unknown item"
                      : item.productNameEn ?? item.productSlug ?? "Product"}
                  </p>
                  {hasLegacyItem(item) && (
                    <p className="mt-1 text-sm text-[var(--rcb-text-muted)]">
                      {[item.itemCategory, item.itemBrand, item.itemModel]
                        .filter(Boolean)
                        .join(" — ")}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-[var(--rcb-text-muted)]">
                    Quantity: {item.quantity}
                    {item.unitPriceCents != null && (
                      <> — {(item.unitPriceCents / 100).toFixed(2)} $</>
                    )}
                  </p>
                </div>

                {!isStickerSheet(item) && !hasLegacyItem(item) && (
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                    Standard product
                  </span>
                )}
              </div>

              {/* Shipment preparation (sticker-sheet) */}
              {isStickerSheet(item) && (
                <div className="mt-5 border-t border-[var(--rcb-border)] pt-4">
                  <h3 className="text-sm font-semibold text-[var(--rcb-text-strong)]">
                    Shipment preparation
                  </h3>

                  {item.codes.length > 0 ? (
                    <div className="mt-3">
                      <p className="text-xs text-[var(--rcb-text-muted)]">
                        {item.codes.length} code(s) registered
                        {" — "}
                        {item.codes.filter((c) => c.claimedAt).length} claimed by customer
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-1 font-mono text-xs sm:grid-cols-3 md:grid-cols-5">
                        {item.codes.map((c) => (
                          <span
                            key={c.code}
                            className={`rounded px-2 py-0.5 ${
                              c.claimedAt
                                ? "bg-green-50 text-green-800"
                                : "bg-[var(--rcb-surface)] text-[var(--rcb-text-body)]"
                            }`}
                          >
                            {c.code}
                          </span>
                        ))}
                      </div>
                      {item.codes.every((c) => !c.claimedAt) && (
                        <button
                          type="button"
                          onClick={() => handleResetCodes(item.id)}
                          disabled={resetRunning[item.id]}
                          className="mt-3 cursor-pointer text-xs text-[var(--rcb-text-muted)] underline-offset-2 hover:text-[var(--rcb-primary)] hover:underline disabled:cursor-default disabled:opacity-60"
                        >
                          {resetRunning[item.id]
                            ? "..."
                            : "Effacer et recommencer"}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      <p className="text-xs text-[var(--rcb-text-muted)]">
                        Enter the first and last RNBP code printed on each sheet (each
                        sheet has {CODES_PER_SHEET} sequential codes).
                      </p>
                      {(sheetInputs[item.id] ?? []).map((sheet, sheetIdx) => (
                        <div key={sheetIdx} className="flex flex-wrap items-center gap-2">
                          <span className="w-16 text-xs font-medium text-[var(--rcb-text-muted)]">
                            Sheet {sheetIdx + 1}
                          </span>
                          <input
                            type="text"
                            placeholder="First (RNBP-…)"
                            value={sheet.firstCode}
                            onChange={(e) =>
                              updateSheetInput(item.id, sheetIdx, "firstCode", e.target.value)
                            }
                            className="h-9 w-44 rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-3 text-sm uppercase text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
                          />
                          <input
                            type="text"
                            placeholder="Last (RNBP-…)"
                            value={sheet.lastCode}
                            onChange={(e) =>
                              updateSheetInput(item.id, sheetIdx, "lastCode", e.target.value)
                            }
                            className="h-9 w-44 rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-3 text-sm uppercase text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none"
                          />
                        </div>
                      ))}
                      <Button
                        size="sm"
                        onClick={() => handleRegisterCodes(item.id)}
                        disabled={prepRunning[item.id]}
                      >
                        {prepRunning[item.id] ? "..." : `Register ${item.quantity * CODES_PER_SHEET} codes`}
                      </Button>
                    </div>
                  )}

                  {prepErrors[item.id] && (
                    <p className="mt-2 text-sm text-red-600">{prepErrors[item.id]}</p>
                  )}
                </div>
              )}

            </div>
          ))}
        </div>

        {order.status === "paid" && (
          <div className="mt-8">
            {shipError && <p className="mb-3 text-sm text-red-600">{shipError}</p>}
            <Button onClick={handleShip} disabled={shipping}>
              {shipping ? "Shipping..." : "Mark as shipped"}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
export default AdminOrderDetailPage;
