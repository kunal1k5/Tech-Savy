import React from "react";

export default function SectionHeader({ eyebrow, title, description, action }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="space-y-2">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            {eyebrow}
          </p>
        ) : null}
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
            {title}
          </h2>
          {description ? (
            <p className="max-w-3xl text-sm leading-6 text-slate-400 md:text-base">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {action ? <div className="flex flex-wrap gap-3">{action}</div> : null}
    </div>
  );
}
