/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        display: ["Inter", "sans-serif"],
      },
      colors: {
        app: {
          canvas: "#ffffff",
          surface: "#f8fafc",
          line: "#e2e8f0",
          strong: "#0f172a",
          muted: "#64748b",
          soft: "#94a3b8",
        },
        brand: {
          primary: "#2563eb",
          "primary-hover": "#1d4ed8",
          accent: "#22c55e",
          warning: "#f59e0b",
          danger: "#ef4444",
          "primary-soft": "#dbeafe",
          "accent-soft": "#dcfce7",
          "warning-soft": "#fef3c7",
          "danger-soft": "#fee2e2",
        },
        primary: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
        shield: {
          green: "#10b981",
          orange: "#f59e0b",
          red: "#ef4444",
        },
      },
      borderRadius: {
        "2.5xl": "1.25rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        fintech: "0 10px 30px rgba(15, 23, 42, 0.08)",
        "fintech-hover": "0 16px 40px rgba(15, 23, 42, 0.12)",
        topbar: "0 6px 18px rgba(15, 23, 42, 0.06)",
      },
      maxWidth: {
        shell: "1440px",
      },
    },
  },
  plugins: [],
};
