import React, { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Bike, MapPinned, Shield } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { registerWorker } from "../services/demoFlow";
import { saveAuthSession } from "../utils/auth";

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

    registerWorker({
      fullName: form.fullName.trim(),
      phone: form.phone.replace(/\D/g, ""),
      city: form.city,
      zone: form.zone,
      platform: form.platform,
      weeklyIncome: Number(form.weeklyIncome),
    })
      .then((response) => {
        saveAuthSession(response);
        navigate("/dashboard", { replace: true });
      })
      .catch((registerError) => {
        setError(registerError.response?.data?.error || "Could not create profile right now.");
      })
      .finally(() => {
        setLoading(false);
      });
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 text-slate-50">
      <div className="pointer-events-none absolute inset-0 fintech-grid opacity-30" />
      <div className="pointer-events-none absolute left-[10%] top-[10%] h-80 w-80 rounded-full bg-sky-500/[0.16] blur-[150px]" />
      <div className="pointer-events-none absolute right-[8%] top-[30%] h-80 w-80 rounded-full bg-violet-500/[0.16] blur-[150px]" />

      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
          <Card glow="violet">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-[20px] border border-sky-400/25 bg-sky-400/10">
                <Shield className="fill-sky-300/15 text-sky-200" size={20} />
              </div>
              <div>
                <div className="font-display text-2xl font-semibold text-white">GigShield</div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Demo onboarding
                </div>
              </div>
            </div>

            <div className="mt-12 space-y-6">
              <Badge tone="info" className="w-fit">Worker profile setup</Badge>
              <div>
                <h1 className="font-display text-5xl font-semibold leading-tight text-white">
                  Create a realistic profile in under a minute.
                </h1>
                <p className="mt-4 text-base leading-8 text-slate-300">
                  This onboarding flow sets up the worker context used across the dashboard, claim simulator, and payout story.
                </p>
              </div>

              <div className="space-y-4">
                {[
                  "Pre-fills worker identity across the product",
                  "Lets judges switch platform and zone context quickly",
                  "Keeps the whole experience interactive with zero backend friction",
                ].map((item) => (
                  <div key={item} className="rounded-[22px] border border-white/10 bg-slate-950/55 px-4 py-4 text-sm text-slate-300">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card glow="sky">
            <div className="mx-auto max-w-xl">
              <div className="mb-8 flex items-start justify-between gap-4">
                <div>
                  <Badge tone="violet" className="w-fit">Worker profile</Badge>
                  <h2 className="mt-4 font-display text-4xl font-semibold text-white">
                    Set up your demo account
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Create the demo user that powers the live GigShield experience.
                  </p>
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
                    className="mt-3 w-full rounded-[22px] border border-white/10 bg-slate-950/55 px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:border-sky-400/30 focus:ring-2 focus:ring-sky-400/20"
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
                    className="mt-3 w-full rounded-[22px] border border-white/10 bg-slate-950/55 px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:border-sky-400/30 focus:ring-2 focus:ring-sky-400/20"
                  />
                </label>

                <label>
                  <span className="text-sm font-medium text-slate-300">Platform</span>
                  <select
                    value={form.platform}
                    onChange={(event) => updateField("platform", event.target.value)}
                    className="mt-3 w-full rounded-[22px] border border-white/10 bg-slate-950/55 px-4 py-3 text-white outline-none transition focus:border-sky-400/30 focus:ring-2 focus:ring-sky-400/20"
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
                      className="w-full rounded-[22px] border border-white/10 bg-slate-950/55 px-4 py-3 pr-10 text-white outline-none transition focus:border-sky-400/30 focus:ring-2 focus:ring-sky-400/20"
                    />
                    <MapPinned className="absolute right-3 top-3.5 text-slate-500" size={18} />
                  </div>
                </label>

                <label>
                  <span className="text-sm font-medium text-slate-300">Zone</span>
                  <input
                    value={form.zone}
                    onChange={(event) => updateField("zone", event.target.value)}
                    className="mt-3 w-full rounded-[22px] border border-white/10 bg-slate-950/55 px-4 py-3 text-white outline-none transition focus:border-sky-400/30 focus:ring-2 focus:ring-sky-400/20"
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="text-sm font-medium text-slate-300">Average weekly income</span>
                  <div className="relative mt-3">
                    <input
                      value={form.weeklyIncome}
                      onChange={(event) => updateField("weeklyIncome", event.target.value.replace(/\D/g, ""))}
                      className="w-full rounded-[22px] border border-white/10 bg-slate-950/55 px-4 py-3 pr-10 text-white outline-none transition focus:border-sky-400/30 focus:ring-2 focus:ring-sky-400/20"
                    />
                    <Bike className="absolute right-3 top-3.5 text-slate-500" size={18} />
                  </div>
                </label>

                {error ? (
                  <div className="sm:col-span-2 rounded-[22px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                    {error}
                  </div>
                ) : (
                  <div className="sm:col-span-2 rounded-[22px] border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                    This profile creates a live demo user and starts the protected GigShield flow immediately.
                  </div>
                )}

                <Button type="submit" variant="primary" block size="lg" loading={loading} rightIcon={ArrowRight} className="sm:col-span-2">
                  {loading ? "Creating profile" : "Create demo account"}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm text-slate-500">
                Already have a session?{" "}
                <Link to="/login" className="text-sky-300 transition hover:text-sky-200">
                  Sign in here
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
