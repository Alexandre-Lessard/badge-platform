import { useState } from "react";

type ItemImageProps = {
  src: string | null | undefined;
  alt: string;
  className: string;
  fallbackClassName?: string;
  iconClassName?: string;
  /**
   * When true, shows the full image (`object-contain`) over a blurred copy of
   * itself as backdrop, so photos of any aspect ratio display cleanly without
   * cropping or distortion. `className` styles the outer box.
   */
  blurBackdrop?: boolean;
};

export function ItemImage({
  src,
  alt,
  className,
  fallbackClassName,
  iconClassName = "h-12 w-12 text-[var(--rcb-border)]",
  blurBackdrop = false,
}: ItemImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const hasError = !!src && failedSrc === src;

  if (!src || hasError) {
    return (
      <div className={fallbackClassName ?? className}>
        <svg
          className={iconClassName}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      </div>
    );
  }

  if (blurBackdrop) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <img
          src={src}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl"
        />
        {/* Absolute so a portrait photo's intrinsic height can't stretch the
            box past the aspect ratio set by the caller (flex `min-height: auto`). */}
        <img
          src={src}
          alt={alt}
          className="absolute inset-0 h-full w-full object-contain"
          onError={() => setFailedSrc(src)}
        />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailedSrc(src)}
    />
  );
}
