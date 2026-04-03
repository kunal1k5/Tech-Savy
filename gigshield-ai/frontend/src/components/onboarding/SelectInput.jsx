import React from "react";

export default function SelectInput({
  id,
  label,
  value,
  onChange,
  options,
  disabled = false,
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none transition-all duration-200 focus:border-blue-300 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
