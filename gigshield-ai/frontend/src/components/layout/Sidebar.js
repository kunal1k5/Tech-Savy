import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Activity,
  FileText,
  LayoutDashboard,
  LogOut,
  Shield,
  X,
} from 'lucide-react';

const navItems = [
  { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
  { name: 'My Insurance', path: '/insurance', icon: <Shield size={20} /> },
  { name: 'Claims', path: '/claims', icon: <FileText size={20} /> },
  { name: 'Live Risk Map', path: '/risk-map', icon: <Activity size={20} /> },
];

function SidebarContent({ location, mobile = false, onClose = () => {} }) {
  return (
    <>
      <div className="p-6">
        <div className="mb-10 flex items-start justify-between gap-3">
          <Link
            to="/dashboard"
            onClick={onClose}
            className="flex items-center gap-3 text-white"
          >
            <div className="rounded-xl bg-blue-500/20 p-2 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
              <Shield className="fill-blue-400/20 text-blue-400" size={24} />
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight">GigShield AI</div>
              <div className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Fintech Cover
              </div>
            </div>
          </Link>

          {mobile ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
              aria-label="Close sidebar"
            >
              <X size={18} />
            </button>
          ) : null}
        </div>

        <div className="mb-4 px-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Main Menu
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-200 ${
                  isActive
                    ? 'border-blue-500/20 bg-blue-600/20 font-medium text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                    : 'border-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                {item.icon}
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto border-t border-white/5 p-6">
        <Link
          to="/"
          onClick={onClose}
          className="group flex items-center gap-3 rounded-xl border border-transparent px-4 py-3 text-slate-400 transition-all hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut size={20} className="transition-transform group-hover:-translate-x-1" />
          Logout User
        </Link>
      </div>
    </>
  );
}

export default function Sidebar({ isOpen = false, onClose = () => {} }) {
  const location = useLocation();

  return (
    <>
      <aside className="hidden md:block fixed inset-y-0 left-0 z-30 w-64">
        <div className="glass-panel flex h-full flex-col border-r border-white/5 bg-slate-950/60">
          <SidebarContent location={location} onClose={onClose} />
        </div>
      </aside>

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-out md:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        aria-hidden={!isOpen}
      >
        <div className="glass-panel flex h-full flex-col border-r border-white/10 bg-slate-950/90 shadow-[0_24px_60px_rgba(2,6,23,0.6)]">
          <SidebarContent location={location} mobile onClose={onClose} />
        </div>
      </aside>
    </>
  );
}
