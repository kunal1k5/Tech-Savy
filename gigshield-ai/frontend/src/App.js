import React from "react";
import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import AppLayout from "./components/layout/AppLayout";
import { Claims, Dashboard, Login, PolicyQuote, Profile, Register } from "./modules";
import Landing from "./pages/Landing";
import LocationPredictor from "./pages/LocationPredictor";
import RiskMap from "./pages/RiskMap";
import { isAuthenticated } from "./utils/auth";

function HomeRedirect() {
  if (isAuthenticated()) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Landing />;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/policy" element={<PolicyQuote />} />
          <Route path="/insurance" element={<Navigate to="/policy" replace />} />
          <Route path="/claims" element={<Claims />} />
          <Route path="/risk-map" element={<RiskMap />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/location-predictor" element={<LocationPredictor />} />
        </Route>

        <Route
          path="*"
          element={<Navigate to={isAuthenticated() ? "/dashboard" : "/"} replace />}
        />
      </Routes>
    </Router>
  );
}
