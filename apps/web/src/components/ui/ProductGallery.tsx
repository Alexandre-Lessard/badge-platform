import { useState } from "react";
import { ItemImage } from "./ItemImage";

type Props = {
  images: string[];
  alt: string;
  className?: string;
  thumbnailLabel?: (index: number) => string;
};

export function ProductGallery({
  images,
  alt,
  className = "aspect-[4/3] w-full overflow-hidden bg-[var(--rcb-surface)]",
  thumbnailLabel,
}: Props) {
  const [active, setActive] = useState(0);
  if (images.length === 0) return null;

  const fallbackClass = "flex items-center justify-center";

  return (
    <div>
      <div className={className}>
        <ItemImage
          src={images[active]}
          alt={alt}
          className="h-full w-full object-contain"
          fallbackClassName={`h-full w-full ${fallbackClass}`}
        />
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 px-6">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(i)}
              aria-label={thumbnailLabel?.(i + 1) ?? `Image ${i + 1}`}
              aria-pressed={i === active}
              className={`h-16 w-16 cursor-pointer overflow-hidden rounded-lg border-2 transition-colors ${
                i === active
                  ? "border-[var(--rcb-primary)]"
                  : "border-[var(--rcb-border)] hover:border-[var(--rcb-text-muted)]"
              }`}
            >
              <ItemImage
                src={src}
                alt=""
                className="h-full w-full object-contain"
                fallbackClassName={`h-full w-full ${fallbackClass}`}
                iconClassName="h-6 w-6 text-[var(--rcb-border)]"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
