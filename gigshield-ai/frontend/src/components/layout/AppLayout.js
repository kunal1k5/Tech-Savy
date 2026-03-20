import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import Sidebar from './Sidebar';

export default function AppLayout() {
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-50 relative overflow-hidden">
      {/* Background ambient light effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/30 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-emerald-900/20 rounded-full blur-[100px] pointer-events-none"></div>
      
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative z-10 h-screen">
        {/* React Hot Toast for Premium Notifications */}
        <Toaster 
          position="top-right" 
          toastOptions={{
            style: {
              background: '#0f172a',
              color: '#fff',
              border: '1px solid #1e293b',
              borderRadius: '16px',
            }
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
            className="min-h-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
