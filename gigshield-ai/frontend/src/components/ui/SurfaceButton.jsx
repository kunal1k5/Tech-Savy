import React, { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "../../utils/cn";
import { playUiClick } from "../../utils/soundFeedback";

const VARIANTS = {
  primary:
    "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-200",
  secondary:
    "border border-slate-200 bg-white text-slate-900 hover:bg-slate-100 focus-visible:ring-slate-200",
  subtle:
    "bg-slate-100 text-slate-700 hover:bg-slate-200 focus-visible:ring-slate-200",
  success:
    "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 focus-visible:ring-emerald-200",
  icon:
    "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-200",
};

const SIZES = {
  md: "px-4 py-3 text-sm",
  sm: "px-3 py-2.5 text-sm",
  icon: "h-10 w-10",
};

export default function SurfaceButton({
  children,
  className,
  variant = "primary",
  size = "md",
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  block = false,
  disabled = false,
  loading = false,
  onMouseDown,
  ...props
}) {
  const [ripples, setRipples] = useState([]);

  const handleMouseDown = useCallback(
    (event) => {
      if (disabled || loading) {
        onMouseDown?.(event);
        return;
      }

      const rect = event.currentTarget.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const id = Date.now() + Math.random();

      setRipples((current) => [
        ...current,
        {
          id,
          size,
          x: event.clientX - rect.left - size / 2,
          y: event.clientY - rect.top - size / 2,
        },
      ]);

      window.setTimeout(() => {
        setRipples((current) => current.filter((ripple) => ripple.id !== id));
      }, 560);

      playUiClick();
      onMouseDown?.(event);
    },
    [disabled, loading, onMouseDown]
  );

  return (
    <motion.button
      type="button"
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 360, damping: 24 }}
      disabled={disabled || loading}
      onMouseDown={handleMouseDown}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl font-semibold shadow-sm transition-[transform,background-color,border-color,box-shadow] duration-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-sm",
        VARIANTS[variant] || VARIANTS.primary,
        SIZES[size] || SIZES.md,
        block && "w-full",
        className
      )}
      {...props}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0">
        {ripples.map((ripple) => (
          <span
            key={ripple.id}
            className="button-ripple"
            style={{
              width: ripple.size,
              height: ripple.size,
              left: ripple.x,
              top: ripple.y,
            }}
          />
        ))}
      </span>

      <span className="relative z-[1] inline-flex items-center gap-2">
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
        ) : LeftIcon ? (
          <LeftIcon size={16} />
        ) : null}
        {children ? <span>{children}</span> : null}
        {RightIcon ? <RightIcon size={16} /> : null}
      </span>
    </motion.button>
  );
}
