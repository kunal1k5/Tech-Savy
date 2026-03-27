import React, { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Bike, MapPinned, Shield } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { saveDemoSession } from "../utils/auth";

const INITIAL_FORM = {
  fullName: "",
  phone: "",
  platform: "Swiggy",
  city: "Bengaluru",
  zone: "Koramangala",
  weeklyIncome: "18000",
};

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!form.fullName.trim()) {
      setError("Enter your name to create the demo profile.");
      return;
    }

    if (form.phone.replace(/\D/g, "").length !== 10) {
      setError("Enter a valid 10-digit phone number.");
      return;
    }

    setLoading(true);

    window.setTimeout(() => {
      saveDemoSession({
        fullName: form.fullName.trim(),
        phone: form.phone.replace(/\D/g, ""),
        city: form.city,
        zone: form.zone,
        platform: form.platform,
        weeklyIncome: Number(form.weeklyIncome),
      });
      navigate("/dashboard", { replace: true });
    }, 900);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 text-slate-50">
      <div className="pointer-events-none absolute inset-0 fintech-grid opacity-30" />
      <div className="pointer-events-none absolute left-[12%] top-[10%] h-72 w-72 rounded-full bg-sky-600/20 blur-[120px]" />
      <div className="pointer-events-none absolute right-[10%] top-[35%] h-72 w-72 rounded-full bg-emerald-600/15 blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-6xl"
      >
        <div className="grid overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/80 shadow-[0_30px_90px_rgba(2,6,23,0.55)] backdrop-blur-xl lg:grid-cols-[0.92fr_1.08fr]">
          <div className="border-b border-white/5 bg-gradient-to-br from-slate-950 to-slate-900 p-8 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-3">
                <Shield className="fill-sky-400/15 text-sky-300" size={24} />
              </div>
              <div>
                <div className="text-xl font-semibold">GigShield</div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                  Demo onboarding
                </div>
              </div>
            </div>

            <div className="mt-10 space-y-6">
              <div>
                <div className="text-sm uppercase tracking-[0.24em] text-slate-500">
                  Why this setup works
                </div>
                <h1 className="mt-3 text-4xl font-semibold leading-tight text-white">
                  Create a realistic worker profile in under one minute.
                </h1>
              </div>

              <div className="space-y-4">
                {[
                  "Pre-fills a worker identity for the dashboard and claim simulator",
                  "Lets judges switch city, zone, and platform context quickly",
                  "Keeps the flow fully interactive without backend dependency",
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
            <div className="mx-auto max-w-xl">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                    Worker profile
                  </div>
                  <h2 className="mt-2 text-3xl font-semibold text-white">
                    Set up your demo account
                  </h2>
                </div>
                <Link to="/" className="text-sm text-slate-400 transition hover:text-white">
                  Back
                </Link>
              </div>

              <form onSubmit={handleSubmit} className="grid gap-5 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="text-sm font-medium text-slate-300">Full name</span>
                  <input
                    value={form.fullName}
                    onChange={(event) => updateField("fullName", event.target.value)}
                    placeholder="Rahul Singh"
                    className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:border-sky-500/30 focus:ring-2 focus:ring-sky-500/20"
                  />
                </label>

                <label>
                  <span className="text-sm font-medium text-slate-300">Phone</span>
                  <input
                    value={form.phone}
                    onChange={(event) =>
                      updateField("phone", event.target.value.replace(/\D/g, "").slice(0, 10))
                    }
                    placeholder="9876543210"
                    className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:border-sky-500/30 focus:ring-2 focus:ring-sky-500/20"
                  />
                </label>

                <label>
                  <span className="text-sm font-medium text-slate-300">Platform</span>
                  <select
                    value={form.platform}
                    onChange={(event) => updateField("platform", event.target.value)}
                    className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-sky-500/30 focus:ring-2 focus:ring-sky-500/20"
                  >
                    <option>Swiggy</option>
                    <option>Zomato</option>
                    <option>Zepto</option>
                    <option>Blinkit</option>
                  </select>
                </label>

                <label>
                  <span className="text-sm font-medium text-slate-300">City</span>
                  <div className="relative mt-3">
                    <input
                      value={form.city}
                      onChange={(event) => updateField("city", event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 pr-10 text-white outline-none transition focus:border-sky-500/30 focus:ring-2 focus:ring-sky-500/20"
                    />
                    <MapPinned className="absolute right-3 top-3.5 text-slate-500" size={18} />
                  </div>
                </label>

                <label>
                  <span className="text-sm font-medium text-slate-300">Zone</span>
                  <input
                    value={form.zone}
                    onChange={(event) => updateField("zone", event.target.value)}
                    className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-sky-500/30 focus:ring-2 focus:ring-sky-500/20"
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="text-sm font-medium text-slate-300">
                    Average weekly income
                  </span>
                  <div className="relative mt-3">
                    <input
                      value={form.weeklyIncome}
                      onChange={(event) =>
                        updateField("weeklyIncome", event.target.value.replace(/\D/g, ""))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 pr-10 text-white outline-none transition focus:border-sky-500/30 focus:ring-2 focus:ring-sky-500/20"
                    />
                    <Bike className="absolute right-3 top-3.5 text-slate-500" size={18} />
                  </div>
                </label>

                {error ? (
                  <div className="sm:col-span-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                  </div>
                ) : (
                  <div className="sm:col-span-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                    This flow creates a local demo profile and takes you directly into the
                    product workspace.
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? "Creating profile..." : "Create demo account"}
                  <ArrowRight size={16} />
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-slate-500">
                Already have a session?{" "}
                <Link to="/login" className="text-sky-300 transition hover:text-sky-200">
                  Sign in here
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
