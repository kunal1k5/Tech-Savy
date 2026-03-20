import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { saveToken } from "../utils/auth";

/**
 * Register — Worker onboarding form.
 */
function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", password: "",
    platform: "zomato", city: "", zone: "",
    avg_weekly_income: "", vehicle_type: "motorcycle",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/workers/register", {
        ...form,
        avg_weekly_income: parseFloat(form.avg_weekly_income),
      });
      saveToken(res.data.data.token);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8 text-center">Join GigShield AI</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <input name="full_name" placeholder="Full Name" required value={form.full_name} onChange={handleChange}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 outline-none" />

        <input name="email" type="email" placeholder="Email" required value={form.email} onChange={handleChange}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 outline-none" />

        <input name="phone" placeholder="Phone (10 digits)" required value={form.phone} onChange={handleChange}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 outline-none" />

        <input name="password" type="password" placeholder="Password (min 8 chars)" required value={form.password} onChange={handleChange}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 outline-none" />

        <select name="platform" value={form.platform} onChange={handleChange}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 outline-none">
          <option value="zomato">Zomato</option>
          <option value="swiggy">Swiggy</option>
          <option value="amazon">Amazon Flex</option>
          <option value="dunzo">Dunzo</option>
          <option value="other">Other</option>
        </select>

        <div className="grid grid-cols-2 gap-4">
          <input name="city" placeholder="City" required value={form.city} onChange={handleChange}
            className="border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 outline-none" />
          <input name="zone" placeholder="Zone / Pincode" required value={form.zone} onChange={handleChange}
            className="border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 outline-none" />
        </div>

        <input name="avg_weekly_income" type="number" placeholder="Avg Weekly Income (₹)" required value={form.avg_weekly_income} onChange={handleChange}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 outline-none" />

        <select name="vehicle_type" value={form.vehicle_type} onChange={handleChange}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary-500 outline-none">
          <option value="bicycle">Bicycle</option>
          <option value="motorcycle">Motorcycle</option>
          <option value="scooter">Scooter</option>
          <option value="car">Car</option>
        </select>

        <button type="submit" disabled={loading}
          className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-lg font-semibold transition disabled:opacity-50">
          {loading ? "Registering..." : "Create Account"}
        </button>
      </form>
    </div>
  );
}

export default Register;
