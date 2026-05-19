import { useState, useEffect } from "react";
import { Link } from "react-router";
import { useLanguage } from "@/i18n/context";
import { useAuth } from "@/lib/auth-context";
import { useCart, cartKey } from "@/lib/cart-context";
import { apiRequest } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/error-utils";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ProductGallery } from "@/components/ui/ProductGallery";
import { ROUTES } from "@/routes/routes";

// ── Types ────────────────────────────────────────────────────────────

type Product = {
  id: string;
  slug: string;
  nameFr: string;
  nameEn: string;
  descriptionFr: string;
  descriptionEn: string;
  featuresFr: string[];
  featuresEn: string[];
  priceCents: number;
  stripePriceId: string;
  imageUrls: string[];
  isActive: boolean;
  requiresItem: boolean;
  customMechanic: string | null;
  sortOrder: number;
};

type UserItem = {
  id: string;
  name: string;
  status: string;
  archivedAt: string | null;
};

// ── Helpers ──────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg className="mt-0.5 h-5 w-5 shrink-0 text-[var(--rcb-primary)]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

function formatPrice(cents: number, locale: string, freeLabel: string): string {
  if (cents === 0) return freeLabel;
  const dollars = cents / 100;
  return dollars.toLocaleString(locale === "fr" ? "fr-CA" : "en-CA", {
    style: "currency",
    currency: "CAD",
  });
}

// ── Component ────────────────────────────────────────────────────────

export function BoutiquePage() {
  const { t, locale } = useLanguage();
  const shop = t.shop!;
  const { user } = useAuth();
  const { cart, addItem, removeItem, updateQuantity, cartCount } = useCart();

  // Shop status
  const [shopAvailable, setShopAvailable] = useState(false);

  // Products from API
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productError, setProductError] = useState("");

  // User items for "requiresItem" products
  const [userItems, setUserItems] = useState<UserItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(!!user);

  // Item selection modal
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [modalSelection, setModalSelection] = useState("");

  // Checkout
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  // "Added" feedback per product slug
  const [addedSlug, setAddedSlug] = useState<string | null>(null);

  // ── Fetch shop status + products ─────────────────────────────────
  useEffect(() => {
    apiRequest<{ available: boolean }>("/shop/status")
      .then((data) => setShopAvailable(data.available))
      .catch(() => setShopAvailable(false));

    apiRequest<{ products: Product[] }>("/shop/products")
      .then((data) => setProducts(data.products.filter((p) => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder)))
      .catch((err) => setProductError(getErrorMessage(err, t)))
      .finally(() => setLoadingProducts(false));
  }, [t]);

  // ── Fetch user items ─────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    apiRequest<{ items: UserItem[] }>("/items")
      .then((data) => setUserItems(data.items.filter((i) => i.status !== "stolen" && !i.archivedAt)))
      .catch(() => { /* ignore */ })
      .finally(() => setLoadingItems(false));
  }, [user]);

  // ── Localized product fields ─────────────────────────────────────
  function pName(p: Product): string { return locale === "fr" ? p.nameFr : p.nameEn; }
  function pDesc(p: Product): string { return locale === "fr" ? p.descriptionFr : p.descriptionEn; }
  function pFeatures(p: Product): string[] { return locale === "fr" ? p.featuresFr : p.featuresEn; }

  // ── Add to cart logic ────────────────────────────────────────────
  function handleAddClick(product: Product) {
    if (product.requiresItem) {
      if (!user) return; // loginRequired message shown in card
      if (userItems.length === 0) return; // noItemsMessage shown in card
      setModalSelection(userItems[0].id);
      setModalProduct(product);
    } else {
      // Directly add / increment
      addItem({
        productId: product.id,
        productSlug: product.slug,
        productName: pName(product),
      });
      setAddedSlug(product.slug);
      setTimeout(() => setAddedSlug(null), 2000);
    }
  }

  function handleModalConfirm() {
    if (!modalProduct) return;
    const item = userItems.find((i) => i.id === modalSelection);
    if (!item) return;
    addItem({
      productId: modalProduct.id,
      productSlug: modalProduct.slug,
      productName: pName(modalProduct),
      itemId: item.id,
      itemName: item.name,
    });
    setAddedSlug(modalProduct.slug);
    setTimeout(() => setAddedSlug(null), 2000);
    setModalProduct(null);
  }

  // ── Checkout ─────────────────────────────────────────────────────
  async function handleCheckout() {
    setCheckingOut(true);
    setCheckoutError("");
    try {
      // Resolve productId from productSlug using fetched products
      const items = cart.map((ci) => {
        let resolvedId = ci.productId;
        if (!resolvedId) {
          const matched = products.find((p) => p.slug === ci.productSlug);
          if (matched) resolvedId = matched.id;
        }
        return {
          productId: resolvedId,
          quantity: ci.quantity,
          ...(ci.itemId ? { itemId: ci.itemId } : {}),
        };
      });

      const res = await apiRequest<{ url: string }>("/shop/checkout", {
        method: "POST",
        body: { items },
      });
      window.location.href = res.url;
    } catch (err) {
      setCheckoutError(getErrorMessage(err, t));
      setCheckingOut(false);
    }
  }

  // ── Render helpers ───────────────────────────────────────────────
  function renderAddButton(product: Product) {
    const isAdded = addedSlug === product.slug;

    if (!shopAvailable) {
      return (
        <p className="text-sm text-[var(--rcb-text-muted)]">
          {shop.comingSoonBanner}
        </p>
      );
    }

    if (product.requiresItem) {
      if (!user) {
        return (
          <p className="text-sm text-[var(--rcb-text-muted)]">
            {shop.loginRequired}{" "}
            <Link to={ROUTES.login} className="font-medium text-[var(--rcb-primary)] hover:underline">
              {shop.loginLink}
            </Link>
          </p>
        );
      }
      if (loadingItems) return null;
      if (userItems.length === 0) {
        return (
          <p className="text-sm text-[var(--rcb-text-muted)]">
            {shop.noItemsMessage}{" "}
            <Link to={ROUTES.registerItem} className="font-medium text-[var(--rcb-primary)] hover:underline">
              {shop.noItemsLink}
            </Link>
          </p>
        );
      }
    }

    return (
      <Button
        size="sm"
        onClick={() => handleAddClick(product)}
        disabled={isAdded}
        className={isAdded ? "cursor-default opacity-70" : ""}
      >
        {isAdded ? (
          <span className="inline-flex items-center gap-2">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            {t.registration?.addedToCart ?? "Added"}
          </span>
        ) : (
          shop.addButton
        )}
      </Button>
    );
  }

  return (
    <>
      
        <title>{t.pages.shop.title}</title>
        <meta name="description" content={t.pages.shop.description} />
      
      <section className="min-h-[70vh] bg-[var(--rcb-white)]">
        {/* ── Page heading ──────────────────────────────────────────── */}
        <div className="section-shell py-16">
          <h1 className="text-center text-3xl font-bold text-[var(--rcb-text-strong)] sm:text-4xl">
            {shop.heading}
          </h1>

          {/* ── Loading / Error states ────────────────────────────── */}
          {loadingProducts ? (
            <div className="mt-16 flex justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--rcb-primary)] border-t-transparent" />
            </div>
          ) : productError ? (
            <div className="mt-10 rounded-lg bg-red-50 px-4 py-3 text-center text-sm text-red-700">
              {shop.loadError}
            </div>
          ) : (
            <>
              {/* ── Product grid ──────────────────────────────────── */}
              <div className="mt-12 grid gap-8 sm:grid-cols-2">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="flex flex-col overflow-hidden rounded-2xl border border-[var(--rcb-border)] bg-[var(--rcb-bg)]"
                  >
                    {/* Product image(s) */}
                    {product.imageUrls.length > 0 && (
                      <ProductGallery
                        images={product.imageUrls}
                        alt={pName(product)}
                        thumbnailLabel={(n) =>
                          (shop.galleryThumbnailLabel ?? "Image {n}").replace(
                            "{n}",
                            String(n),
                          )
                        }
                      />
                    )}

                    {/* Product info */}
                    <div className="flex flex-1 flex-col p-6">
                      <h2 className="text-xl font-bold text-[var(--rcb-text-strong)]">
                        {pName(product)}
                      </h2>
                      <p className="mt-2 text-sm leading-relaxed text-[var(--rcb-text-muted)]">
                        {pDesc(product)}
                      </p>

                      {/* Features */}
                      {pFeatures(product).length > 0 && (
                        <ul className="mt-4 space-y-2">
                          {pFeatures(product).map((feature) => (
                            <li key={feature} className="flex items-start gap-2 text-sm text-[var(--rcb-text-body)]">
                              <CheckIcon />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Price + action */}
                      <div className="mt-auto pt-6">
                        <p className="mb-3 text-2xl font-bold text-[var(--rcb-text-strong)]">
                          {formatPrice(product.priceCents, locale, shop.freePrice)}
                        </p>
                        {renderAddButton(product)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Separator ──────────────────────────────────────────── */}
        <div className="section-shell">
          <hr className="border-[var(--rcb-border)]" />
        </div>

        {/* ── Cart section ───────────────────────────────────────── */}
        <div className="section-shell py-16">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-2xl font-bold text-[var(--rcb-text-strong)]">
              {shop.cartTitle}
            </h2>

            {cartCount === 0 ? (
              <div className="mt-8 rounded-xl border border-dashed border-[var(--rcb-border)] px-6 py-12 text-center">
                <svg className="mx-auto h-12 w-12 text-[var(--rcb-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 01-8 0" />
                </svg>
                <p className="mt-4 text-[var(--rcb-text-muted)]">{shop.cartEmpty}</p>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {cart.map((item) => {
                  const key = cartKey(item);
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-4 rounded-xl border border-[var(--rcb-border)] px-5 py-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-[var(--rcb-text-strong)]">
                          {item.productName}
                        </p>
                        {item.itemName && (
                          <p className="truncate text-sm text-[var(--rcb-text-muted)]">
                            {item.itemName}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateQuantity(key, item.quantity - 1)}
                          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[var(--rcb-border)] text-sm font-medium transition-colors hover:bg-[var(--rcb-border)]"
                        >
                          −
                        </button>
                        <span className="w-8 text-center font-medium">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(key, item.quantity + 1)}
                          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[var(--rcb-border)] text-sm font-medium transition-colors hover:bg-[var(--rcb-border)]"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(key)}
                          className="ml-2 cursor-pointer text-sm text-red-500 transition-colors hover:text-red-700"
                        >
                          {shop.removeItem}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {checkoutError && (
                  <p className="text-sm text-red-600">{checkoutError}</p>
                )}

                <div className="pt-3">
                  <Button
                    onClick={handleCheckout}
                    disabled={checkingOut || !shopAvailable || !user}
                    className="w-full"
                  >
                    {!shopAvailable
                      ? shop.comingSoonCheckout
                      : !user
                        ? shop.loginRequired
                        : checkingOut
                          ? shop.checkingOut
                          : shop.checkout}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Item selection modal ───────────────────────────────── */}
        <Modal
          open={!!modalProduct}
          onClose={() => setModalProduct(null)}
          title={shop.forWhichItem}
        >
          <div className="space-y-2">
            {userItems.map((item) => (
              <label
                key={item.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--rcb-border)] p-3 transition-colors hover:bg-[var(--rcb-surface)]"
              >
                <input
                  type="radio"
                  name="item-select"
                  value={item.id}
                  checked={modalSelection === item.id}
                  onChange={() => setModalSelection(item.id)}
                  className="accent-[var(--rcb-primary)]"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--rcb-text-strong)]">
                    {item.name}
                  </p>
                </div>
              </label>
            ))}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" size="sm" onClick={() => setModalProduct(null)}>
              {t.registration?.backButton ?? "Cancel"}
            </Button>
            <Button size="sm" onClick={handleModalConfirm}>
              {shop.confirmAdd}
            </Button>
          </div>
        </Modal>
      </section>
    </>
  );
}
export default BoutiquePage;
