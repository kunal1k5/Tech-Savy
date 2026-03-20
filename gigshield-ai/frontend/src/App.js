import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Layout
import AppLayout from './components/layout/AppLayout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PolicyQuote from './pages/PolicyQuote';
import Claims from './pages/Claims';
import RiskMap from './pages/RiskMap';

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Public Route */}
        <Route path="/" element={<Login />} />

        {/* Protected Dashboard Routes (Shared Layout with Sidebar) */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/insurance" element={<PolicyQuote />} />
          <Route path="/claims" element={<Claims />} />
          <Route path="/risk-map" element={<RiskMap />} />
        </Route>
      </Routes>
    </Router>
  );
}
