import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Shield, FileText, Activity, LogOut } from 'lucide-react';

export default function Sidebar() {
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'My Insurance', path: '/insurance', icon: <Shield size={20} /> },
    { name: 'Claims', path: '/claims', icon: <FileText size={20} /> },
    { name: 'Live Risk Map', path: '/risk-map', icon: <Activity size={20} /> },
  ];

  return (
    <aside className="w-64 glass-panel border-r border-white/5 hidden md:flex flex-col z-10 sticky top-0 h-screen bg-slate-950/50">
      <div className="p-6">
        <div className="flex items-center gap-3 text-white font-bold text-xl mb-10">
          <div className="bg-blue-500/20 p-2 rounded-xl shadow-[0_0_15px_rgba(59,130,246,0.3)]">
            <Shield className="text-blue-400 fill-blue-400/20" size={24} />
          </div>
          GigShield AI
        </div>
        
        <div className="mb-4 px-3 text-xs font-semibold text-slate-500 uppercase tracking-widest">
          Main Menu
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.name} 
                to={item.path} 
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-blue-600/20 text-blue-400 font-medium border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                }`}
              >
                {item.icon}
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User profile / Logout snippet at bottom */}
      <div className="mt-auto p-6 border-t border-white/5">
        <Link to="/" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all border border-transparent hover:border-red-500/20 group">
          <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
          Logout User
        </Link>
      </div>
    </aside>
  );
}
