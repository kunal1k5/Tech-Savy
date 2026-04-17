import React, { useState } from "react";
import { Shield } from "lucide-react";
import { cn } from "../../utils/cn";

const LOGO_CANDIDATE_PATHS = [
  "/assets/logo/logoo.png",
  "/assets/logo/brand-logo.png",
  "/assets/logo/brand-logo.svg",
];

export default function BrandIdentity({
  title = "GigPredict AI",
  subtitle = "AI parametric insurance platform",
  showSubtitle = true,
  className,
  logoClassName,
  titleClassName,
  subtitleClassName,
}) {
  const [logoIndex, setLogoIndex] = useState(0);
  const [showFallbackIcon, setShowFallbackIcon] = useState(false);
  const currentLogoPath = LOGO_CANDIDATE_PATHS[logoIndex];
  const canTryAnotherLogo = logoIndex < LOGO_CANDIDATE_PATHS.length - 1;

  function handleLogoError() {
    if (canTryAnotherLogo) {
      setLogoIndex((current) => current + 1);
      return;
    }

    setShowFallbackIcon(true);
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-[#2563EB] text-white",
          logoClassName
        )}
      >
        {!showFallbackIcon && currentLogoPath ? (
          <img
            src={currentLogoPath}
            alt="Brand logo"
            className="h-full w-full object-cover"
            onError={handleLogoError}
          />
        ) : (
          <Shield size={18} />
        )}
      </div>

      <div>
        <p className={cn("text-base font-semibold text-slate-900", titleClassName)}>{title}</p>
        {showSubtitle ? (
          <p className={cn("text-xs text-slate-500", subtitleClassName)}>{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
