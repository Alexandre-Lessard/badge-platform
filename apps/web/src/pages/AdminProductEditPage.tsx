import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
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
  featuresFr: string[] | null;
  featuresEn: string[] | null;
  priceCents: number;
  stripePriceId: string | null;
  imageUrls: string[];
  isActive: boolean;
  customMechanic: string | null;
  requiresItem: boolean;
  sortOrder: number;
};

type FormData = {
  slug: string;
  nameFr: string;
  nameEn: string;
  descriptionFr: string;
  descriptionEn: string;
  featuresFr: string;
  featuresEn: string;
  priceCents: number;
  stripePriceId: string;
  imageUrls: string;
  isActive: boolean;
  sortOrder: number;
};

const emptyForm: FormData = {
  slug: "",
  nameFr: "",
  nameEn: "",
  descriptionFr: "",
  descriptionEn: "",
  featuresFr: "",
  featuresEn: "",
  priceCents: 0,
  stripePriceId: "",
  imageUrls: "",
  isActive: true,
  sortOrder: 0,
};

export function AdminProductEditPage() {
  const { id } = useParams<{ id: string }>();
  const { t, locale } = useLanguage();
  const navigate = useNavigate();
  const isNew = id === "new";

  const [form, setForm] = useState<FormData>(emptyForm);
  const [customMechanic, setCustomMechanic] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const p = t.admin?.products;

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    apiRequest<{ product: Product }>(`/admin/products/${id}`)
      .then((data) => {
        if (cancelled) return;
        const prod = data.product;
        setForm({
          slug: prod.slug,
          nameFr: prod.nameFr,
          nameEn: prod.nameEn,
          descriptionFr: prod.descriptionFr ?? "",
          descriptionEn: prod.descriptionEn ?? "",
          featuresFr: prod.featuresFr?.join("\n") ?? "",
          featuresEn: prod.featuresEn?.join("\n") ?? "",
          priceCents: prod.priceCents,
          stripePriceId: prod.stripePriceId ?? "",
          imageUrls: prod.imageUrls.join("\n"),
          isActive: prod.isActive,
          sortOrder: prod.sortOrder,
        });
        setCustomMechanic(prod.customMechanic);
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
  }, [id, isNew, t]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setForm((prev) => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked,
      }));
    } else if (type === "number") {
      setForm((prev) => ({ ...prev, [name]: Number(value) || 0 }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    // Build payload, splitting features into arrays
    const payload: Record<string, unknown> = {
      nameFr: form.nameFr,
      nameEn: form.nameEn,
      descriptionFr: form.descriptionFr || null,
      descriptionEn: form.descriptionEn || null,
      featuresFr: form.featuresFr
        ? form.featuresFr.split("\n").filter((l) => l.trim())
        : null,
      featuresEn: form.featuresEn
        ? form.featuresEn.split("\n").filter((l) => l.trim())
        : null,
      priceCents: form.priceCents,
      stripePriceId: form.stripePriceId || null,
      imageUrls: form.imageUrls
        ? form.imageUrls
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
        : [],
      isActive: form.isActive,
      sortOrder: form.sortOrder,
    };

    if (isNew) {
      payload.slug = form.slug;
    }

    try {
      if (isNew) {
        await apiRequest<{ product: Product }>(
          "/admin/products",
          { method: "POST", body: payload },
        );
      } else {
        await apiRequest(`/admin/products/${id}`, {
          method: "PATCH",
          body: payload,
        });
      }
      navigate(ROUTES.adminProducts);
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setSaving(false);
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

  if (!isNew && error && !form.nameFr) {
    return (
      <section className="min-h-[80vh] bg-[var(--rcb-white)]">
        <div className="section-shell py-16">
          <p className="text-red-600">
            {error || (p?.notFound ?? "Product not found.")}
          </p>
          <Link
            to={ROUTES.adminProducts}
            className="mt-4 inline-block text-sm font-medium text-[var(--rcb-primary)] hover:underline"
          >
            &larr; {p?.back ?? "Back to products"}
          </Link>
        </div>
      </section>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-[var(--rcb-border)] bg-[var(--rcb-bg)] px-4 py-2.5 text-sm text-[var(--rcb-text-body)] focus:border-[var(--rcb-primary)] focus:outline-none";
  const labelClass =
    "block text-sm font-medium text-[var(--rcb-text-strong)] mb-1.5";

  return (
    <section className="min-h-[80vh] bg-[var(--rcb-white)]">
      <title>{`Admin — ${t.admin?.nav.products ?? "Products"} | Badge`}</title>
      <div className="section-shell py-16">
        <Link
          to={ROUTES.adminProducts}
          className="text-sm font-medium text-[var(--rcb-primary)] hover:underline"
        >
          &larr; {p?.back ?? "Back to products"}
        </Link>

        <h1 className="mt-6 text-2xl font-bold text-[var(--rcb-text-strong)]">
          {isNew
            ? (p?.createTitle ?? "New product")
            : (p?.editTitle ?? "Edit product")}
        </h1>

        {/* Custom mechanic badge */}
        {customMechanic && (
          <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0 rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-800">
                {p?.customMechanic ?? "Custom mechanic"}
              </span>
              <p className="text-sm text-purple-900">
                {p?.customMechanicBadge ??
                  "Custom mechanic active — This product has custom behavior managed by code."}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {/* Slug */}
          <div>
            <label htmlFor="slug" className={labelClass}>
              {p?.slug ?? "Slug"}
            </label>
            <input
              id="slug"
              name="slug"
              type="text"
              required
              value={form.slug}
              onChange={handleChange}
              disabled={!isNew}
              className={`${inputClass} ${!isNew ? "cursor-not-allowed opacity-60" : ""}`}
              placeholder="my-product-slug"
            />
            <p className="mt-1 text-xs text-[var(--rcb-text-muted)]">
              {locale === "en"
                ? "Unique identifier used in URLs and code. Lowercase, no spaces (use dashes). Cannot be changed after creation."
                : "Identifiant unique utilisé dans les URLs et le code. Minuscules, sans espaces (utiliser des tirets). Ne peut pas être modifié après la création."}
            </p>
          </div>

          {/* Names */}
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="nameFr" className={labelClass}>
                {p?.nameFr ?? "Name (FR)"}
              </label>
              <input
                id="nameFr"
                name="nameFr"
                type="text"
                required
                value={form.nameFr}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="nameEn" className={labelClass}>
                {p?.nameEn ?? "Name (EN)"}
              </label>
              <input
                id="nameEn"
                name="nameEn"
                type="text"
                required
                value={form.nameEn}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
          </div>

          {/* Descriptions */}
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="descriptionFr" className={labelClass}>
                {p?.descriptionFr ?? "Description (FR)"}
              </label>
              <textarea
                id="descriptionFr"
                name="descriptionFr"
                rows={3}
                value={form.descriptionFr}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="descriptionEn" className={labelClass}>
                {p?.descriptionEn ?? "Description (EN)"}
              </label>
              <textarea
                id="descriptionEn"
                name="descriptionEn"
                rows={3}
                value={form.descriptionEn}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
          </div>

          {/* Features */}
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="featuresFr" className={labelClass}>
                {p?.featuresFr ?? "Features (FR)"}
              </label>
              <textarea
                id="featuresFr"
                name="featuresFr"
                rows={4}
                value={form.featuresFr}
                onChange={handleChange}
                className={inputClass}
                placeholder={p?.featuresHint ?? "One feature per line"}
              />
              <p className="mt-1 text-xs text-[var(--rcb-text-muted)]">
                {p?.featuresHint ?? "One feature per line"}
              </p>
            </div>
            <div>
              <label htmlFor="featuresEn" className={labelClass}>
                {p?.featuresEn ?? "Features (EN)"}
              </label>
              <textarea
                id="featuresEn"
                name="featuresEn"
                rows={4}
                value={form.featuresEn}
                onChange={handleChange}
                className={inputClass}
                placeholder={p?.featuresHint ?? "One feature per line"}
              />
              <p className="mt-1 text-xs text-[var(--rcb-text-muted)]">
                {p?.featuresHint ?? "One feature per line"}
              </p>
            </div>
          </div>

          {/* Price */}
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="priceCents" className={labelClass}>
                {p?.priceCents ?? "Price (cents)"}
              </label>
              <input
                id="priceCents"
                name="priceCents"
                type="number"
                min={0}
                value={form.priceCents}
                onChange={handleChange}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-[var(--rcb-text-muted)]">
                {p?.priceDollars ?? "Displayed price"}:{" "}
                {(form.priceCents / 100).toFixed(2)} $
              </p>
            </div>
            <div>
              <label htmlFor="stripePriceId" className={labelClass}>
                {p?.stripePriceId ?? "Stripe Price ID"}
              </label>
              <input
                id="stripePriceId"
                name="stripePriceId"
                type="text"
                value={form.stripePriceId}
                onChange={handleChange}
                className={inputClass}
                placeholder="price_..."
              />
            </div>
          </div>

          {/* Image URLs (multi-line) */}
          <div>
            <label htmlFor="imageUrls" className={labelClass}>
              {p?.imageUrls ?? "Image URLs"}
            </label>
            <textarea
              id="imageUrls"
              name="imageUrls"
              rows={4}
              value={form.imageUrls}
              onChange={handleChange}
              className={inputClass}
              placeholder="/assets/product-stickers.webp"
            />
            <p className="mt-1 text-xs text-[var(--rcb-text-muted)]">
              {p?.imageUrlsHint ?? "One URL per line. First image = main display."}
            </p>
          </div>

          {/* Sort order + isActive */}
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="sortOrder" className={labelClass}>
                {p?.sortOrder ?? "Order"}
              </label>
              <input
                id="sortOrder"
                name="sortOrder"
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div className="flex items-center gap-3 pt-7">
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({ ...prev, isActive: !prev.isActive }))
                }
                className="relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors"
                style={{
                  backgroundColor: form.isActive
                    ? "var(--rcb-primary)"
                    : "#d1d5db",
                }}
                aria-label={p?.isActive ?? "Active"}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    form.isActive ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span className="text-sm font-medium text-[var(--rcb-text-strong)]">
                {form.isActive
                  ? (p?.active ?? "Active")
                  : (p?.inactive ?? "Inactive")}
              </span>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-4 pt-4">
            <Button type="submit" disabled={saving}>
              {saving
                ? isNew
                  ? (p?.creating ?? "Creating...")
                  : (p?.saving ?? "Saving...")
                : isNew
                  ? (p?.create ?? "Create")
                  : (p?.save ?? "Save")}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
export default AdminProductEditPage;
