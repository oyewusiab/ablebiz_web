import { useState } from "react";
import { cn } from "../utils/cn";

export interface BrandLogoProps {
  /**
   * "landscape" uses the wide ABLEBIZ logo (ideal for auth, headers, invoices, reports).
   * "square" uses the compact square logo (ideal for collapsed sidebar, mobile nav, avatars).
   */
  variant?: "landscape" | "square";
  /**
   * Size presets or custom styling.
   */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "custom";
  /**
   * Extra classes for fine-tuned sizing and positioning.
   */
  className?: string;
  /**
   * Priority loading for above-the-fold or auth screens.
   */
  priority?: boolean;
  /**
   * Print optimization: guarantees high-contrast rendering on paper exports.
   */
  print?: boolean;
  /**
   * Set true when rendered on dark surfaces (e.g. Navy sidebar or dark headers).
   */
  darkBackground?: boolean;
  /**
   * Accessible image description.
   */
  alt?: string;
}

const SIZE_MAP = {
  landscape: {
    xs: "h-6 w-auto max-w-[120px]",
    sm: "h-8 w-auto max-w-[150px]",
    md: "h-11 w-auto max-w-[200px]",
    lg: "h-14 w-auto max-w-[250px]",
    xl: "h-18 w-auto max-w-[320px]",
    custom: "",
  },
  square: {
    xs: "h-6 w-6",
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
    xl: "h-16 w-16",
    custom: "",
  },
} as const;

export function BrandLogo({
  variant = "landscape",
  size = "md",
  className,
  priority = false,
  print = false,
  darkBackground = false,
  alt = "ABLEBIZ Business Services",
}: BrandLogoProps) {
  // Step in fallback chain: 0 = primary PNG, 1 = fallback JPEG, 2 = accessible text fallback
  const [fallbackStep, setFallbackStep] = useState<0 | 1 | 2>(0);

  const pngSource =
    variant === "landscape"
      ? "/images/ablebiz-logo.png"
      : "/images/ablebiz-logo-sq.png";

  const jpegSource =
    variant === "landscape"
      ? "/images/ablebiz-logo.jpeg"
      : "/images/ablebiz-logo-sq.jpg";

  const handleImageError = () => {
    setFallbackStep((prev) => (prev === 0 ? 1 : 2));
  };

  const sizeClasses = SIZE_MAP[variant][size] || SIZE_MAP[variant].md;

  // Final fallback: Accessible text brandmark (no broken image icon is ever shown)
  if (fallbackStep === 2) {
    if (variant === "square") {
      return (
        <div
          className={cn(
            "flex items-center justify-center rounded-lg font-black tracking-wider text-xs",
            darkBackground
              ? "bg-[#0A2558] text-[#F59E0B] border border-amber-400/30"
              : "bg-[#0A2558] text-white",
            sizeClasses,
            className
          )}
          role="img"
          aria-label={alt}
        >
          AB
        </div>
      );
    }

    return (
      <div
        className={cn(
          "inline-flex flex-col justify-center select-none",
          sizeClasses,
          className
        )}
        role="img"
        aria-label={alt}
      >
        <span
          className={cn(
            "font-black tracking-tight leading-none text-base",
            darkBackground ? "text-white" : "text-[#0A2558]"
          )}
        >
          ABLEBIZ
        </span>
        <span
          className={cn(
            "text-[9px] font-bold tracking-widest uppercase",
            darkBackground ? "text-[#F59E0B]" : "text-[#D97706]"
          )}
        >
          BUSINESS SERVICES
        </span>
      </div>
    );
  }

  const currentSource = fallbackStep === 0 ? pngSource : jpegSource;

  return (
    <img
      src={currentSource}
      alt={alt}
      onError={handleImageError}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={cn(
        "object-contain select-none transition-opacity duration-150",
        sizeClasses,
        print && "print:brightness-100 print:contrast-125",
        darkBackground && "filter drop-shadow-sm",
        className
      )}
    />
  );
}
