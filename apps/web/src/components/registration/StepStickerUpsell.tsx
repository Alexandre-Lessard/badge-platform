import { useState } from "react";
import { useLanguage } from "@/i18n/context";
import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/Button";
import { PRODUCT_SLUGS } from "@rnbp/shared";

type StepStickerUpsellProps = {
  onNext: () => void;
  onBack: () => void;
  loading: boolean;
  error: string;
};

export function StepStickerUpsell({
  onNext,
  onBack,
  loading,
  error,
}: StepStickerUpsellProps) {
  const { t } = useLanguage();
  const { addItem } = useCart();
  const reg = t.registration!;
  const [added, setAdded] = useState(false);

  function handleAddToCart() {
    if (loading) {
      return;
    }

    // Sticker sheets are generic 10-code packs since the post-launch redesign;
    // the customer assigns each code to one of their items themselves later.
    addItem({
      productId: "",
      productSlug: PRODUCT_SLUGS.STICKER_SHEET,
      productName: t.shop?.productName ?? "",
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border-2 border-[var(--rcb-primary)]/30 bg-[var(--rcb-primary)]/5 p-6 sm:p-8">
        <h3 className="text-xl font-bold text-[var(--rcb-text-strong)]">
          {reg.stickerHeading}
        </h3>
        <p className="mt-3 text-[var(--rcb-text-body)]">
          {reg.stickerPitch}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            onClick={handleAddToCart}
            disabled={added || loading}
            className={added ? "cursor-default opacity-70" : ""}
          >
            {added ? (
              <span className="inline-flex items-center gap-2">
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {reg.addedToCart}
              </span>
            ) : (
              reg.addToCart
            )}
          </Button>

        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="cursor-pointer text-sm font-medium text-[var(--rcb-text-muted)] transition-colors hover:text-[var(--rcb-text-strong)]"
        >
          &larr; {reg.backButton}
        </button>
        <Button onClick={onNext} disabled={loading}>
          {loading ? reg.submitting : reg.confirmButton}
        </Button>
      </div>
    </div>
  );
}
