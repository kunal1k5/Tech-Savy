import React from "react";
import { Link } from "react-router-dom";
import { clearSession, isAuthenticated } from "../utils/auth";

export default function Navbar() {
  const loggedIn = isAuthenticated();

  function handleLogout() {
    clearSession();
    window.location.href = "/";
  }

  return (
    <nav className="border-b border-white/10 bg-slate-950/80 text-white backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="text-lg font-semibold tracking-tight">
          GigShield
        </Link>

        <div className="flex items-center gap-4 text-sm text-slate-300">
          {loggedIn ? (
            <>
              <Link to="/dashboard" className="transition hover:text-white">
                Dashboard
              </Link>
              <Link to="/insurance" className="transition hover:text-white">
                Coverage
              </Link>
              <Link to="/claims" className="transition hover:text-white">
                Claims
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-white/10 px-4 py-2 transition hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-200"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="transition hover:text-white">
                Sign in
              </Link>
              <Link
                to="/register"
                className="rounded-full bg-sky-600 px-4 py-2 font-medium text-white transition hover:bg-sky-500"
              >
                Create demo
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
