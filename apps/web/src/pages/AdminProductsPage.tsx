import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { apiRequest } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-utils";
import { useLanguage } from "@/i18n/context";
import { Button } from "@/components/ui/Button";
import { ROUTES } from "@/routes/routes";

type Product = {
  id: string;
  slug: string;
  nameFr: string;
  nameEn: string;
  descriptionFr: string | null;
  descriptionEn: string | null;
  priceCents: number;
  imageUrls: string[];
  isActive: boolean;
  customMechanic: string | null;
  requiresItem: boolean;
  sortOrder: number;
};

export function AdminProductsPage() {
  const { t, locale } = useLanguage();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toggling, setToggling] = useState<Record<string, boolean>>({});

  const p = t.admin?.products;

  useEffect(() => {
    let cancelled = false;
    apiRequest<{ products: Product[] }>("/admin/products")
      .then((data) => {
        if (!cancelled) setProducts(data.products);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, t));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function toggleActive(product: Product) {
    setToggling((prev) => ({ ...prev, [product.id]: true }));
    try {
      await apiRequest(`/admin/products/${product.id}`, {
        method: "PATCH",
        body: { isActive: !product.isActive },
      });
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, isActive: !p.isActive } : p,
        ),
      );
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setToggling((prev) => ({ ...prev, [product.id]: false }));
    }
  }

  function formatPrice(cents: number) {
    return (cents / 100).toFixed(2) + " $";
  }

  return (
    <section className="min-h-[80vh] bg-[var(--rcb-white)]">
      <title>{`Admin — ${p?.title ?? "Products"} | Badge`}</title>
      <div className="section-shell py-16">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-[var(--rcb-text-strong)]">
            {p?.title ?? "Products"}
          </h1>
          <Button
            size="sm"
            onClick={() => navigate(ROUTES.adminProductEdit("new"))}
          >
            {p?.addProduct ?? "Add product"}
          </Button>
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
        ) : products.length === 0 ? (
          <div className="mt-10 rounded-xl border border-[var(--rcb-border)] bg-[var(--rcb-surface)] p-10 text-center">
            <p className="text-[var(--rcb-text-muted)]">
              {p?.noProducts ?? "No products."}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="mt-8 hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--rcb-border)] text-xs font-medium uppercase tracking-wider text-[var(--rcb-text-muted)]">
                    <th className="pb-3 pr-4" />
                    <th className="pb-3 pr-4">
                      {locale === "fr" ? "Nom" : "Name"}
                    </th>
                    <th className="pb-3 pr-4">{p?.slug ?? "Slug"}</th>
                    <th className="pb-3 pr-4">{p?.price ?? "Price"}</th>
                    <th className="pb-3 pr-4">{p?.sortOrder ?? "Order"}</th>
                    <th className="pb-3 pr-4">
                      {p?.isActive ?? "Active"}
                    </th>
                    <th className="pb-3" />
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr
                      key={product.id}
                      className={`border-b border-[var(--rcb-border)] transition-colors hover:bg-[var(--rcb-surface)] ${
                        !product.isActive ? "opacity-50" : ""
                      }`}
                    >
                      <td className="py-3 pr-4">
                        {product.imageUrls.length > 0 ? (
                          <img
                            src={product.imageUrls[0]}
                            alt={product.nameFr}
                            className="h-12 w-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--rcb-surface)] text-[var(--rcb-text-muted)]">
                            <svg
                              className="h-5 w-5"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                            >
                              <rect
                                x="3"
                                y="3"
                                width="18"
                                height="18"
                                rx="2"
                              />
                              <circle cx="8.5" cy="8.5" r="1.5" />
                              <path d="M21 15l-5-5L5 21" />
                            </svg>
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <Link
                          to={ROUTES.adminProductEdit(product.id)}
                          className="font-medium text-[var(--rcb-text-strong)] hover:text-[var(--rcb-primary)]"
                        >
                          {locale === "fr"
                            ? product.nameFr
                            : product.nameEn}
                        </Link>
                        {product.customMechanic && (
                          <span className="ml-2 inline-block rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
                            {p?.customMechanic ?? "Custom mechanic"}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-[var(--rcb-text-muted)]">
                        {product.slug}
                      </td>
                      <td className="py-3 pr-4 text-[var(--rcb-text-body)]">
                        {formatPrice(product.priceCents)}
                      </td>
                      <td className="py-3 pr-4 text-[var(--rcb-text-muted)]">
                        {product.sortOrder}
                      </td>
                      <td className="py-3 pr-4">
                        <button
                          type="button"
                          onClick={() => toggleActive(product)}
                          disabled={toggling[product.id]}
                          className="relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                          style={{
                            backgroundColor: product.isActive
                              ? "var(--rcb-primary)"
                              : "#d1d5db",
                          }}
                          aria-label={
                            product.isActive
                              ? (p?.active ?? "Active")
                              : (p?.inactive ?? "Inactive")
                          }
                        >
                          <span
                            className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                              product.isActive
                                ? "translate-x-6"
                                : "translate-x-1"
                            }`}
                          />
                        </button>
                      </td>
                      <td className="py-3 text-right">
                        <Link
                          to={ROUTES.adminProductEdit(product.id)}
                          className="text-sm font-medium text-[var(--rcb-primary)] hover:underline"
                        >
                          {p?.editTitle ?? "Edit"}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="mt-8 space-y-3 lg:hidden">
              {products.map((product) => (
                <div
                  key={product.id}
                  className={`rounded-xl border border-[var(--rcb-border)] bg-[var(--rcb-bg)] p-5 ${
                    !product.isActive ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {product.imageUrls.length > 0 ? (
                      <img
                        src={product.imageUrls[0]}
                        alt={product.nameFr}
                        className="h-12 w-12 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--rcb-surface)] text-[var(--rcb-text-muted)]">
                        <svg
                          className="h-5 w-5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1">
                      <Link
                        to={ROUTES.adminProductEdit(product.id)}
                        className="font-medium text-[var(--rcb-text-strong)] hover:text-[var(--rcb-primary)]"
                      >
                        {locale === "fr" ? product.nameFr : product.nameEn}
                      </Link>
                      {product.customMechanic && (
                        <span className="ml-2 inline-block rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
                          {p?.customMechanic ?? "Custom mechanic"}
                        </span>
                      )}
                      <p className="mt-1 font-mono text-xs text-[var(--rcb-text-muted)]">
                        {product.slug}
                      </p>
                      <div className="mt-2 flex items-center gap-4 text-sm text-[var(--rcb-text-muted)]">
                        <span>{formatPrice(product.priceCents)}</span>
                        <span>
                          {p?.sortOrder ?? "Order"}: {product.sortOrder}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleActive(product)}
                      disabled={toggling[product.id]}
                      className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                      style={{
                        backgroundColor: product.isActive
                          ? "var(--rcb-primary)"
                          : "#d1d5db",
                      }}
                      aria-label={
                        product.isActive
                          ? (p?.active ?? "Active")
                          : (p?.inactive ?? "Inactive")
                      }
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                          product.isActive
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
export default AdminProductsPage;
