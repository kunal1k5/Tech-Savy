import React from "react";
import { cn } from "../../utils/cn";

export default function AuthField({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  autoComplete,
  maxLength,
  autoFocus = false,
  options,
  prefix,
  helperText,
  disabled = false,
  className,
}) {
  const baseClassName =
    "mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50";

  return (
    <label htmlFor={id} className={cn("block", className)}>
      <span className="text-sm font-medium text-slate-700">{label}</span>

      {options ? (
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className={baseClassName}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <div className="relative mt-2">
          {prefix ? (
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-base text-slate-500">
              {prefix}
            </span>
          ) : null}

          <input
            id={id}
            type={type}
            inputMode={inputMode}
            value={value}
            maxLength={maxLength}
            autoComplete={autoComplete}
            autoFocus={autoFocus}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            className={cn(baseClassName, prefix && "pl-14", "mt-0")}
          />
        </div>
      )}

      {helperText ? <p className="mt-2 text-sm text-slate-500">{helperText}</p> : null}
    </label>
  );
}
