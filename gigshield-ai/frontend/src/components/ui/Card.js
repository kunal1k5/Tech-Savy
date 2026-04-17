import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../utils/cn";

const GLOWS = {
  sky: "border-sky-400/12",
  emerald: "border-emerald-400/12",
  amber: "border-amber-400/12",
  rose: "border-rose-400/12",
  violet: "border-violet-400/12",
};

const PADDING = {
  sm: "p-4",
  md: "p-5",
  lg: "p-6 md:p-7",
};

export default function Card({
  children,
  className,
  glow = "sky",
  padding = "lg",
  interactive = true,
}) {
  const Component = interactive ? motion.div : "div";
  const motionProps = interactive
    ? {
        whileHover: {
          y: -6,
          scale: 1.02,
          boxShadow: "0 24px 65px rgba(2, 6, 23, 0.38)",
        },
        transition: { type: "spring", stiffness: 320, damping: 24 },
      }
    : {};

  return (
    <Component
      className={cn(
        "relative overflow-hidden rounded-[26px] border border-white/12 bg-[radial-gradient(circle_at_8%_0%,rgba(56,189,248,0.14),transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.95),rgba(9,13,27,0.98))] shadow-[0_12px_34px_rgba(2,6,23,0.28)] transition-[transform,box-shadow,border-color,background] duration-300 after:absolute after:inset-x-10 after:top-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-white/25 after:to-transparent",
        GLOWS[glow] || GLOWS.sky,
        PADDING[padding] || PADDING.lg,
        className
      )}
      {...motionProps}
    >
      <div className="relative z-10">{children}</div>
    </Component>
  );
}

export function CardHeader({ children, className }) {
  return <div className={cn("flex items-start justify-between gap-4", className)}>{children}</div>;
}

export function CardTitle({ children, className }) {
  return <h3 className={cn("font-display text-xl font-semibold text-white", className)}>{children}</h3>;
}

export function CardDescription({ children, className }) {
  return <p className={cn("text-sm leading-6 text-slate-400", className)}>{children}</p>;
}
