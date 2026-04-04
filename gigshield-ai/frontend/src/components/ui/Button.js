import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../utils/cn";

const VARIANTS = {
  primary:
    "border border-sky-400/40 bg-[linear-gradient(135deg,rgba(56,189,248,0.92),rgba(99,102,241,0.92))] text-white shadow-[0_18px_50px_rgba(56,189,248,0.24)] hover:shadow-[0_22px_55px_rgba(56,189,248,0.3)]",
  secondary:
    "border border-white/[0.12] bg-white/5 text-slate-100 hover:border-white/20 hover:bg-white/10",
  ghost:
    "border border-transparent bg-transparent text-slate-300 hover:border-white/10 hover:bg-white/5 hover:text-white",
  success:
    "border border-emerald-400/30 bg-emerald-400/[0.12] text-emerald-50 hover:bg-emerald-400/20",
  danger:
    "border border-rose-400/30 bg-rose-400/[0.12] text-rose-50 hover:bg-rose-400/20",
};

const SIZES = {
  sm: "min-h-[40px] px-4 text-sm",
  md: "min-h-[46px] px-4.5 text-sm",
  lg: "min-h-[54px] px-5 text-sm",
};

export function buttonStyles({
  variant = "secondary",
  size = "md",
  block = false,
  className,
} = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold tracking-[0.01em] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sky-400/30 disabled:cursor-not-allowed disabled:opacity-60",
    VARIANTS[variant] || VARIANTS.secondary,
    SIZES[size] || SIZES.md,
    block && "w-full",
    className
  );
}

export default function Button({
  children,
  className,
  variant = "secondary",
  size = "md",
  block = false,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  loading = false,
  disabled,
  ...props
}) {
  return (
    <motion.button
      whileHover={disabled ? undefined : { y: -2, scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={{ type: "spring", stiffness: 360, damping: 24 }}
      className={buttonStyles({ variant, size, block, className })}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
      ) : LeftIcon ? (
        <LeftIcon size={16} />
      ) : null}
      <span>{children}</span>
      {RightIcon ? <RightIcon size={16} /> : null}
    </motion.button>
  );
}
