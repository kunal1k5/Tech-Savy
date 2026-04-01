import React from "react";
import Badge from "./Badge";

export default function SectionHeader({ eyebrow, title, description, action }) {
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl space-y-3">
        {eyebrow ? (
          <Badge tone="violet" size="sm" className="w-fit">
            {eyebrow}
          </Badge>
        ) : null}
        <div className="space-y-3">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-white md:text-4xl">
            {title}
          </h2>
          {description ? (
            <p className="text-sm leading-7 text-slate-400 md:text-base">{description}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="flex flex-wrap gap-3">{action}</div> : null}
    </div>
  );
}
