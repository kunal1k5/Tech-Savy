import React, { useEffect, useRef } from "react";
import { cn } from "../../utils/cn";

export default function OtpInputGroup({
  value,
  onChange,
  autoFocus = false,
  disabled = false,
}) {
  const inputRefs = useRef([]);
  const otpLength = value.length;

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  function handleDigitChange(rawValue, index) {
    const nextValue = rawValue.replace(/\D/g, "");

    if (!nextValue) {
      onChange(value.map((digit, digitIndex) => (digitIndex === index ? "" : digit)));
      return;
    }

    if (nextValue.length > 1) {
      const nextDigits = [...value];
      nextValue
        .slice(0, otpLength)
        .split("")
        .forEach((digit, digitIndex) => {
          if (index + digitIndex < otpLength) {
            nextDigits[index + digitIndex] = digit;
          }
        });

      onChange(nextDigits);
      inputRefs.current[Math.min(index + nextValue.length, otpLength - 1)]?.focus();
      return;
    }

    const nextDigits = [...value];
    nextDigits[index] = nextValue;
    onChange(nextDigits);

    if (index < otpLength - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(event, index) {
    if (event.key === "Backspace" && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(event) {
    event.preventDefault();
    const pastedDigits = event.clipboardData
      .getData("text/plain")
      .replace(/\D/g, "")
      .slice(0, otpLength);

    if (!pastedDigits) {
      return;
    }

    const nextDigits = new Array(otpLength).fill("");
    pastedDigits.split("").forEach((digit, index) => {
      nextDigits[index] = digit;
    });

    onChange(nextDigits);
    inputRefs.current[Math.min(pastedDigits.length, otpLength) - 1]?.focus();
  }

  return (
    <div
      className="mx-auto grid w-full max-w-[460px] gap-2 sm:gap-3"
      style={{
        gridTemplateColumns: `repeat(${otpLength}, minmax(0, 1fr))`,
      }}
    >
      {value.map((digit, index) => (
        <input
          key={index}
          ref={(input) => {
            inputRefs.current[index] = input;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(event) => handleDigitChange(event.target.value, index)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          onPaste={handlePaste}
          aria-label={`OTP digit ${index + 1}`}
          className={cn(
            "h-14 w-full min-w-0 rounded-2xl border border-slate-200 bg-white text-center text-xl font-semibold text-slate-900 outline-none transition-all duration-200 focus:border-blue-300 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50",
            "sm:h-16 sm:text-2xl"
          )}
        />
      ))}
    </div>
  );
}
