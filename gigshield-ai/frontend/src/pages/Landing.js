import React from "react";
import { Link } from "react-router-dom";

/**
 * Landing — Marketing / hero page for GigShield AI.
 */
function Landing() {
  return (
    <div className="bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 text-white">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 py-24 text-center">
        <h1 className="text-5xl md:text-6xl font-extrabold leading-tight">
          Protect Your Income.
          <br />
          <span className="text-shield-green">Ride Without Fear.</span>
        </h1>
        <p className="mt-6 text-xl text-primary-200 max-w-2xl mx-auto">
          AI-powered parametric insurance that automatically pays you when
          extreme weather, pollution, or zone shutdowns disrupt your deliveries.
        </p>
        <div className="mt-10 flex justify-center space-x-4">
          <Link
            to="/register"
            className="bg-shield-green hover:bg-green-600 text-white px-8 py-3 rounded-lg text-lg font-semibold transition"
          >
            Get Covered — ₹15/week
          </Link>
          <Link
            to="/login"
            className="border border-white/30 hover:bg-white/10 px-8 py-3 rounded-lg text-lg transition"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white text-gray-900 py-20">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">How GigShield Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: "🤖",
                title: "AI Risk Assessment",
                desc: "Our ML model analyses weather, AQI, traffic, and zone history to give you a personalised risk score.",
              },
              {
                icon: "💰",
                title: "Affordable Weekly Plans",
                desc: "Starting at just ₹15/week. No hidden charges, no lengthy paperwork.",
              },
              {
                icon: "⚡",
                title: "Instant Payouts",
                desc: "When a disruption is detected, claims are auto-triggered and paid within minutes — no manual process.",
              },
            ].map((feature, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-8 text-center">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Supported Platforms */}
      <section className="bg-gray-50 text-gray-900 py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-6">Built for Delivery Partners on</h2>
          <div className="flex justify-center space-x-10 text-xl font-semibold text-gray-500">
            <span>Zomato</span>
            <span>Swiggy</span>
            <span>Amazon Flex</span>
            <span>Dunzo</span>
          </div>
        </div>
      </section>

      {/* Coverage Disclaimer */}
      <section className="bg-primary-900 text-primary-200 py-10 text-center text-sm">
        <p>
          GigShield AI covers <strong>income loss only</strong>. No health,
          vehicle repair, or accident coverage. Policies are weekly-renewable.
        </p>
      </section>
    </div>
  );
}

export default Landing;
