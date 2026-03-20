import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import { Menu, Shield } from 'lucide-react';
import Sidebar from './Sidebar';

export default function AppLayout() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.body.classList.add('overflow-hidden');
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.classList.remove('overflow-hidden');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-950 text-slate-50">
      {/* Background ambient light effects */}
      <div className="pointer-events-none absolute left-[-10%] top-[-10%] h-[40%] w-[40%] rounded-full bg-blue-900/30 blur-[120px]"></div>
      <div className="pointer-events-none absolute bottom-[-10%] right-[-10%] h-[30%] w-[30%] rounded-full bg-emerald-900/20 blur-[100px]"></div>

      {/* Sidebar Navigation */}
      <Sidebar isOpen={isOpen} onClose={() => setIsOpen(false)} />

      <AnimatePresence>
        {isOpen ? (
          <motion.button
            type="button"
            aria-label="Close sidebar overlay"
            className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsOpen(false)}
          />
        ) : null}
      </AnimatePresence>

      <div className="relative z-10 min-h-screen">
        <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl md:hidden">
          <div className="flex h-16 items-center justify-between px-4">
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-200 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>

            <Link to="/dashboard" className="flex min-w-0 items-center gap-3 text-white">
              <div className="rounded-xl bg-blue-500/20 p-2 shadow-[0_0_18px_rgba(59,130,246,0.25)]">
                <Shield className="fill-blue-400/20 text-blue-400" size={20} />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold tracking-[0.18em] text-slate-100">
                  GIGSHIELD AI
                </div>
                <div className="truncate text-[11px] text-slate-400">Realtime risk cover</div>
              </div>
            </Link>

            <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
              Live
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="relative min-h-screen pt-16 md:pl-64 md:pt-0">
          {/* React Hot Toast for Premium Notifications */}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#0f172a',
                color: '#fff',
                border: '1px solid #1e293b',
                borderRadius: '16px',
              },
            }}
          />

          {/* Smooth Page Transitions */}
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="min-h-[calc(100vh-4rem)] md:min-h-screen"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
