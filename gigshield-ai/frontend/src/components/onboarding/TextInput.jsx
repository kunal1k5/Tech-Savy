import React from "react";

export default function TextInput({
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
  disabled = false,
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
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
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
      />
    </label>
  );
}
