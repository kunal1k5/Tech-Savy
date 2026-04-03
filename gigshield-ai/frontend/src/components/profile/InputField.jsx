import React from "react";

export default function InputField({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  options,
}) {
  const baseClassName =
    "mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100";

  return (
    <label htmlFor={id} className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {options ? (
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={baseClassName}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={baseClassName}
        />
      )}
    </label>
  );
}
