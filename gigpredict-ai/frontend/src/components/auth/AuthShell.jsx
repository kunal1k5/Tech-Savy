import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

export default function AuthShell({
  eyebrow,
  title,
  description,
  backTo = "/",
  backLabel = "Back",
  note,
  footer,
  children,
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="relative mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-4 py-10 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: "easeOut" }}
          className="w-full"
        >
          <div className="mb-5 flex items-center justify-between gap-4">
            <Link to="/" className="text-lg font-semibold tracking-tight text-slate-900">
              GigPredict AI
            </Link>
            <Link
              to={backTo}
              className="text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-slate-900"
            >
              {backLabel}
            </Link>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] sm:p-8">
            <div>
              <p className="text-sm font-medium text-blue-600">{eyebrow}</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                {title}
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">{description}</p>
            </div>

            {note ? (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
                {note}
              </div>
            ) : null}

            <div className="mt-6">{children}</div>

            {footer ? <div className="mt-6 text-center text-sm text-slate-500">{footer}</div> : null}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
