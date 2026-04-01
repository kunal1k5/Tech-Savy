import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Shield, ShieldCheck, Smartphone } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { requestOtp, verifyOtp } from "../services/demoFlow";
import { saveAuthSession } from "../utils/auth";

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
  const [sessionId, setSessionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inputRefs = useRef([]);

  useEffect(() => {
    if (step === 2 && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [step]);

  async function handleSendOtp(event) {
    event.preventDefault();
    if (phone.length !== 10) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await requestOtp(phone);
      setSessionId(response.sessionId);
      setStep(2);
      setMessage("OTP sent. Use 1234 to continue.");
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Could not send OTP. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(event) {
    event.preventDefault();
    const combinedOtp = otp.join("");

    if (combinedOtp.length !== 4) {
      setError("Enter all 4 OTP digits to continue.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await verifyOtp({
        sessionId,
        phone,
        otp: combinedOtp,
      });
      saveAuthSession(response);
      navigate(redirectPath, { replace: true });
    } catch (verifyError) {
      setError(verifyError.response?.data?.error || "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  }

  function handleOtpChange(event, index) {
    const rawValue = event.target.value.replace(/\D/g, "");
    if (!rawValue) {
      setOtp((current) => current.map((digit, digitIndex) => (digitIndex === index ? "" : digit)));
      return;
    }

    if (rawValue.length > 1) {
      const nextOtp = [...otp];
      rawValue
        .slice(0, 4)
        .split("")
        .forEach((digit, digitIndex) => {
          if (index + digitIndex < 4) {
            nextOtp[index + digitIndex] = digit;
          }
        });
      setOtp(nextOtp);
      inputRefs.current[Math.min(index + rawValue.length, 3)]?.focus();
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

  async function handleResend() {
    try {
      const response = await requestOtp(phone);
      setSessionId(response.sessionId);
      setOtp(new Array(4).fill(""));
      setError("");
      setMessage("Fresh OTP sent. Continue with 1234.");
      inputRefs.current[0]?.focus();
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Could not resend OTP.");
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 text-slate-50">
      <div className="pointer-events-none absolute inset-0 fintech-grid opacity-30" />
      <div className="pointer-events-none absolute left-[10%] top-[10%] h-80 w-80 rounded-full bg-sky-500/[0.16] blur-[150px]" />
      <div className="pointer-events-none absolute right-[10%] bottom-[8%] h-80 w-80 rounded-full bg-violet-500/[0.16] blur-[150px]" />

      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card glow="violet" className="hidden lg:block">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-[20px] border border-sky-400/25 bg-sky-400/10">
                <Shield className="fill-sky-300/15 text-sky-200" size={20} />
              </div>
              <div>
                <div className="font-display text-2xl font-semibold text-white">GigShield</div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Secure demo access
                </div>
              </div>
            </div>

            <div className="mt-12 space-y-6">
              <Badge tone="info" className="w-fit">OTP sign-in flow</Badge>
              <div>
                <h1 className="font-display text-5xl font-semibold leading-tight text-white">
                  Fast sign-in that still feels premium.
                </h1>
                <p className="mt-4 text-base leading-8 text-slate-300">
                  OTP entry is cleaner, faster, and easier to demo with auto-advancing digits, paste support, and clear feedback.
                </p>
              </div>

              <div className="space-y-4">
                {[
                  "Responsive auth shell with polished feedback states",
                  "Auto-advancing OTP input built for demo speed",
                  "Demo session creation so protected routes work instantly",
                ].map((item) => (
                  <div key={item} className="rounded-[22px] border border-white/10 bg-slate-950/55 px-4 py-4 text-sm text-slate-300">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card glow="sky">
            <div className="mx-auto max-w-md">
              <div className="mb-8 flex items-start justify-between gap-4">
                <div>
                  <Badge tone="violet" className="w-fit">Secure sign in</Badge>
                  <h2 className="mt-4 font-display text-4xl font-semibold text-white">Welcome back</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Sign in with OTP to continue into the GigShield demo workspace.
                  </p>
                </div>
                <Link to="/" className="text-sm text-slate-400 transition hover:text-white">
                  Back
                </Link>
              </div>

              <form onSubmit={step === 1 ? handleSendOtp : handleVerify} className="space-y-6">
                {step === 1 ? (
                  <motion.div initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }}>
                    <label className="block text-sm font-medium text-slate-300">Mobile number</label>
                    <div className="relative mt-3 rounded-[24px] border border-white/10 bg-slate-950/55 px-4 py-4">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-500">+91</div>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(event) => setPhone(sanitizePhone(event.target.value))}
                        placeholder="9876543210"
                        className="w-full bg-transparent py-1 pl-10 pr-10 text-white placeholder-slate-500 outline-none"
                        autoFocus
                      />
                      <Smartphone className="absolute right-4 top-4.5 text-slate-500" size={18} />
                    </div>
                    <p className="mt-3 text-sm text-slate-500">
                      Demo note: enter any valid mobile number, then use OTP 1234.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }}>
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-slate-300">Enter OTP</label>
                      <button
                        type="button"
                        onClick={() => {
                          setStep(1);
                          setSessionId("");
                          setOtp(new Array(4).fill(""));
                          setError("");
                          setMessage("");
                        }}
                        className="text-sm text-sky-300 transition hover:text-sky-200"
                      >
                        Change number
                      </button>
                    </div>
                    <div className="mt-4 flex justify-between gap-3">
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
                          className="h-16 w-16 rounded-[22px] border border-white/10 bg-slate-950/55 text-center text-xl font-semibold text-white outline-none transition focus:border-emerald-400/30 focus:ring-2 focus:ring-emerald-400/20"
                          aria-label={`OTP digit ${index + 1}`}
                        />
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <span className="text-slate-500">Use static OTP 1234 for the demo.</span>
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
                  <div className="rounded-[22px] border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                    {message}
                  </div>
                ) : null}

                {error ? (
                  <div className="rounded-[22px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                    {error}
                  </div>
                ) : null}

                <Button
                  type="submit"
                  variant="primary"
                  block
                  size="lg"
                  loading={loading}
                  rightIcon={step === 1 ? ArrowRight : ShieldCheck}
                >
                  {step === 1 ? "Send OTP" : "Verify and continue"}
                </Button>
              </form>

              <div className="mt-8 text-center text-sm text-slate-500">
                Need a demo account?{" "}
                <Link to="/register" className="text-sky-300 transition hover:text-sky-200">
                  Create one here
                </Link>
                .
              </div>
            </div>
          </Card>
        </div>
      </motion.div>
    </div>
  );
}
