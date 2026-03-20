import React from "react";
import { Link } from "react-router-dom";
import { isAuthenticated, removeToken } from "../utils/auth";

/**
 * Navbar — Top navigation bar with auth-aware links.
 */
function Navbar() {
  const loggedIn = isAuthenticated();

  const handleLogout = () => {
    removeToken();
    window.location.href = "/";
  };

  return (
    <nav className="bg-primary-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold tracking-tight">
              🛡️ GigShield AI
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center space-x-4">
            {loggedIn ? (
              <>
                <Link to="/dashboard" className="hover:text-primary-200 transition">
                  Dashboard
                </Link>
                <Link to="/quote" className="hover:text-primary-200 transition">
                  Get Quote
                </Link>
                <Link to="/claims" className="hover:text-primary-200 transition">
                  Claims
                </Link>
                <button
                  onClick={handleLogout}
                  className="bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded text-sm font-medium transition"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="hover:text-primary-200 transition">
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-shield-green hover:bg-green-600 px-4 py-1.5 rounded font-medium transition"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
