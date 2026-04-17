import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Outlet, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import { getPageTitle } from "./navigation";

export default function AppLayout() {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pageTitle = useMemo(() => getPageTitle(location.pathname), [location.pathname]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isSidebarOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsSidebarOpen(false);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSidebarOpen]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-900">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="min-h-screen lg:pl-60">
        <Navbar title={pageTitle} onMenuClick={() => setIsSidebarOpen(true)} />

        <main className="min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, x: 18, y: 8, filter: "blur(3px)" }}
              animate={{ opacity: 1, x: 0, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: -14, y: -6, filter: "blur(2px)" }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 2800,
          style: {
            background: "linear-gradient(120deg, #ffffff, #f8fafc)",
            color: "#0f172a",
            border: "1px solid #e2e8f0",
            borderRadius: "16px",
            boxShadow: "0 16px 36px rgba(15, 23, 42, 0.1)",
          },
          success: {
            iconTheme: {
              primary: "#16a34a",
              secondary: "#ecfdf5",
            },
          },
          error: {
            iconTheme: {
              primary: "#dc2626",
              secondary: "#fef2f2",
            },
          },
        }}
      />
    </div>
  );
}
