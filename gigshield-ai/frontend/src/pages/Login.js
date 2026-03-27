import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Shield, ShieldCheck, Smartphone } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { saveDemoSession } from "../utils/auth";

function sanitizePhone(value) {
  return value.replace(/\D/g, "").slice(0, 10);
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectPath = location.state?.from || "/dashboard";
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(new Array(4).fill(""));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inputRefs = useRef([]);

  useEffect(() => {
    if (step === 2 && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [step]);

  function handleSendOtp(event) {
    event.preventDefault();
    if (phone.length !== 10) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    window.setTimeout(() => {
      setStep(2);
      setLoading(false);
      setMessage("OTP sent. Use any 4 digits to continue in demo mode.");
    }, 900);
  }

  function handleVerify(event) {
    event.preventDefault();
    const combinedOtp = otp.join("");

    if (combinedOtp.length !== 4) {
      setError("Enter all 4 OTP digits to continue.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    window.setTimeout(() => {
      saveDemoSession({
        fullName: "Rahul Singh",
        phone,
        city: "Bengaluru",
        zone: "Koramangala",
        platform: "Swiggy",
      });
      navigate(redirectPath, { replace: true });
    }, 900);
  }

  function handleOtpChange(event, index) {
    const rawValue = event.target.value.replace(/\D/g, "");
    if (!rawValue) {
      setOtp((current) => current.map((digit, digitIndex) => (digitIndex === index ? "" : digit)));
      return;
    }

    if (rawValue.length > 1) {
      const nextOtp = [...otp];
      rawValue.slice(0, 4).split("").forEach((digit, digitIndex) => {
        if (index + digitIndex < 4) {
          nextOtp[index + digitIndex] = digit;
        }
      });
      setOtp(nextOtp);

      const nextFocusIndex = Math.min(index + rawValue.length, 3);
      inputRefs.current[nextFocusIndex]?.focus();
      return;
    }

    const nextOtp = [...otp];
    nextOtp[index] = rawValue;
    setOtp(nextOtp);

    if (index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(event, index) {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(event) {
    event.preventDefault();
    const pastedDigits = event.clipboardData.getData("text/plain").replace(/\D/g, "").slice(0, 4);
    if (!pastedDigits) {
      return;
    }

    const nextOtp = new Array(4).fill("");
    pastedDigits.split("").forEach((digit, index) => {
      nextOtp[index] = digit;
    });
    setOtp(nextOtp);
    inputRefs.current[Math.min(pastedDigits.length, 4) - 1]?.focus();
  }

  function handleResend() {
    setOtp(new Array(4).fill(""));
    setError("");
    setMessage("Fresh OTP sent. Continue with any 4 digits.");
    inputRefs.current[0]?.focus();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 text-slate-50">
      <div className="pointer-events-none absolute inset-0 fintech-grid opacity-30" />
      <div className="pointer-events-none absolute left-[12%] top-[12%] h-80 w-80 rounded-full bg-sky-600/20 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[8%] right-[10%] h-80 w-80 rounded-full bg-emerald-600/15 blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-5xl"
      >
        <div className="grid overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/80 shadow-[0_30px_90px_rgba(2,6,23,0.55)] backdrop-blur-xl lg:grid-cols-[0.95fr_1.05fr]">
          <div className="hidden border-r border-white/5 bg-gradient-to-br from-slate-950 to-slate-900 p-8 lg:block">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-3">
                <Shield className="fill-sky-400/15 text-sky-300" size={24} />
              </div>
              <div>
                <div className="text-xl font-semibold">GigShield</div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                  Automated income cover
                </div>
              </div>
            </div>

            <div className="mt-14 max-w-md space-y-6">
              <div>
                <div className="text-sm uppercase tracking-[0.24em] text-slate-500">
                  Sign in flow
                </div>
                <h1 className="mt-3 text-4xl font-semibold leading-tight text-white">
                  Fast OTP access for a polished product demo.
                </h1>
              </div>

              <div className="space-y-4">
                {[
                  "Responsive auth shell with clear feedback states",
                  "Auto-advancing OTP input and paste support",
                  "Demo session creation so protected routes always work",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 lg:p-10">
            <div className="mx-auto max-w-md">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                    Secure sign in
                  </div>
                  <h2 className="mt-2 text-3xl font-semibold text-white">Welcome back</h2>
                </div>
                <Link
                  to="/"
                  className="text-sm text-slate-400 transition hover:text-white"
                >
                  Back
                </Link>
              </div>

              <form onSubmit={step === 1 ? handleSendOtp : handleVerify} className="space-y-6">
                {step === 1 ? (
                  <motion.div initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }}>
                    <label className="block text-sm font-medium text-slate-300">
                      Mobile number
                    </label>
                    <div className="relative mt-3">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-500">
                        +91
                      </div>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(event) => setPhone(sanitizePhone(event.target.value))}
                        placeholder="9876543210"
                        className="w-full rounded-2xl border border-white/10 bg-slate-950/70 py-4 pl-14 pr-12 text-white placeholder-slate-500 outline-none transition focus:border-sky-500/30 focus:ring-2 focus:ring-sky-500/20"
                        autoFocus
                      />
                      <Smartphone
                        className="absolute right-4 top-4 text-slate-500"
                        size={18}
                      />
                    </div>
                    <p className="mt-3 text-sm text-slate-500">
                      Demo note: enter any valid mobile number to receive a mock OTP.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }}>
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-slate-300">
                        Enter OTP
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setStep(1);
                          setOtp(new Array(4).fill(""));
                          setError("");
                          setMessage("");
                        }}
                        className="text-sm text-sky-300 transition hover:text-sky-200"
                      >
                        Change number
                      </button>
                    </div>
                    <div className="mt-3 flex justify-between gap-3">
                      {otp.map((digit, index) => (
                        <input
                          key={index}
                          ref={(ref) => {
                            inputRefs.current[index] = ref;
                          }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(event) => handleOtpChange(event, index)}
                          onKeyDown={(event) => handleOtpKeyDown(event, index)}
                          onPaste={handleOtpPaste}
                          className="h-14 w-14 rounded-2xl border border-white/10 bg-slate-950/70 text-center text-xl font-semibold text-white outline-none transition focus:border-emerald-500/30 focus:ring-2 focus:ring-emerald-500/20 sm:h-16 sm:w-16"
                          aria-label={`OTP digit ${index + 1}`}
                        />
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <span className="text-slate-500">Use any 4 digits in demo mode.</span>
                      <button
                        type="button"
                        onClick={handleResend}
                        className="text-sky-300 transition hover:text-sky-200"
                      >
                        Resend OTP
                      </button>
                    </div>
                  </motion.div>
                )}

                {message ? (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                    {message}
                  </div>
                ) : null}

                {error ? (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {step === 1 ? "Send OTP" : "Verify and continue"}
                  {step === 1 ? <ArrowRight size={16} /> : <ShieldCheck size={16} />}
                </button>
              </form>

              <div className="mt-8 text-center text-sm text-slate-500">
                Need a demo account?{" "}
                <Link to="/register" className="text-sky-300 transition hover:text-sky-200">
                  Create one here
                </Link>
                .
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
