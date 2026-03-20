import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, TrendingUp, AlertTriangle, CloudRain, Clock, MapPin, CheckCircle, ChevronRight, Wind } from 'lucide-react';
import toast from 'react-hot-toast';

const EarningsChart = () => (
  <div className="h-64 mt-4 bg-slate-800/50 rounded-xl border border-white/5 flex items-end justify-between p-4 px-8 items-center gap-2 relative">
    {[30, 45, 20, 60, 40, 80, 50].map((h, i) => (
      <div key={i} className="w-full flex justify-center h-full items-end group cursor-pointer hover:-translate-y-1 transition-transform">
        <div className="w-12 bg-blue-500/20 hover:bg-blue-500/50 rounded-t-md relative transition-all duration-300 flex items-end justify-center shadow-[0_0_10px_rgba(59,130,246,0)] group-hover:shadow-[0_0_15px_rgba(59,130,246,0.5)]" style={{ height: `${h}%` }}>
          <div className="h-1 bg-blue-400 w-full rounded-t-md absolute top-0" />
        </div>
      </div>
    ))}
  </div>
);

export default function Dashboard() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate smart API connection load
    const timer = setTimeout(() => {
      setLoading(false);
      toast.success("Risk Engine Connected & Live", { 
        icon: '🟢',
        duration: 3000 
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        <div className="h-12 bg-slate-800/50 rounded-xl w-1/3 animate-pulse mb-8"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-40 bg-white/5 rounded-3xl animate-pulse"></div>
          <div className="h-40 bg-white/5 rounded-3xl animate-pulse"></div>
          <div className="h-40 bg-white/5 rounded-3xl animate-pulse"></div>
        </div>
        <div className="h-80 bg-white/5 rounded-3xl animate-pulse mt-8"></div>
      </div>
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 relative">
      
      {/* Top Notification Banner */}
      <motion.div 
        initial={{ y: -50, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        transition={{ delay: 0.5, type: "spring" }}
        className="absolute top-4 right-4 md:top-8 md:right-8 bg-amber-500/20 border border-amber-500/40 text-amber-400 px-4 py-2 rounded-xl flex items-center shadow-[0_0_15px_rgba(245,158,11,0.2)] z-50 backdrop-blur-md"
      >
        <AlertTriangle size={16} className="mr-2 animate-pulse" />
        <span className="text-sm font-medium">⚠ Heavy Rain Alert — Claims may trigger</span>
      </motion.div>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 mt-12 md:mt-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2 flex items-center gap-3">
            Good Morning, Rahul 🛵
          </h1>
          <div className="flex flex-col sm:flex-row sm:items-center text-slate-400 gap-2 sm:gap-4 mt-2">
            <span className="flex items-center"><MapPin size={16} className="mr-1" /> Bangalore — Koramangala Zone</span>
            <span className="hidden sm:block text-slate-600">|</span>
            <span className="flex items-center text-emerald-400 text-sm font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
              Real-time Monitoring Active (Live)
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2 bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-full border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)] hover:scale-105 transition-transform cursor-default">
          <ShieldCheck size={20} />
          <span className="font-medium">Active Policy</span>
          <span className="relative flex h-3 w-3 ml-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
        </div>
      </div>

      {/* Top Value Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card 1: Protected Income */}
        <motion.div variants={item} whileHover={{ scale: 1.05 }} className="glass-panel p-6 rounded-3xl relative overflow-hidden group hover:border-white/20 transition-all">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 bg-blue-500/20 w-32 h-32 rounded-full blur-3xl transition-transform group-hover:scale-125 duration-500"></div>
          <p className="text-slate-400 text-sm font-medium mb-2">Protected Income</p>
          <div className="flex items-center space-x-2 text-white">
            <span className="text-4xl font-bold border-b border-dashed border-slate-600 pb-1">₹4,500</span>
          </div>
          <p className="text-emerald-400 text-sm mt-4 flex items-center bg-emerald-500/10 w-fit px-3 py-1 rounded-full">
            <Clock size={14} className="mr-1.5"/> Coverage ends in 4 days
          </p>
        </motion.div>

        {/* Card 2: Live Risk AI (Smart Fake Data) */}
        <motion.div variants={item} whileHover={{ scale: 1.05 }} className="glass-panel p-6 rounded-3xl relative overflow-hidden group hover:border-white/20 transition-all ring-1 ring-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)]">
          <div className="absolute top-0 right-0 p-4">
             <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
          </div>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">Live Risk Score</p>
              <h2 className="text-2xl font-bold text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)] flex items-center gap-2">
                 <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse border border-white/20"></span> HIGH RISK
              </h2>
            </div>
            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="p-3 bg-red-500/20 rounded-2xl text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] group-hover:rotate-12 transition-transform">
              <AlertTriangle size={24} />
            </motion.div>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <span className="bg-red-950/40 border border-red-500/30 text-xs px-3 py-1.5 rounded-lg text-red-200 flex items-center w-fit shadow-[0_0_10px_rgba(239,68,68,0.1)]">
              <CloudRain size={12} className="mr-1.5 text-blue-400"/> Heavy Rain Detected (72mm)
            </span>
            <span className="bg-red-950/40 border border-red-500/30 text-xs px-3 py-1.5 rounded-lg text-red-200 flex items-center w-fit shadow-[0_0_10px_rgba(239,68,68,0.1)]">
              <Wind size={12} className="mr-1.5 text-slate-400"/> AQI: 420 (Hazardous)
            </span>
          </div>
        </motion.div>

        {/* Card 3: Hours Lost */}
        <motion.div variants={item} whileHover={{ scale: 1.05 }} className="glass-panel p-6 rounded-3xl relative overflow-hidden group hover:border-white/20 transition-all ring-1 ring-amber-500/30">
          <div className="absolute -bottom-10 -right-10 bg-amber-500/20 w-32 h-32 rounded-full blur-3xl transition-transform group-hover:scale-125 duration-500"></div>
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">Hours Lost Today</p>
              <div className="flex items-end gap-2 text-white">
                <span className="text-4xl font-bold text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.3)]">3.5</span>
                <span className="text-lg text-amber-400/70 mb-1 font-medium">hrs</span>
              </div>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500 group-hover:-rotate-12 transition-transform">
              <Clock size={24} />
            </div>
          </div>
          <p className="text-slate-400 text-sm mt-4 leading-relaxed">
            Automatic payout calculated to cover this downtime.
          </p>
        </motion.div>

        {/* Card 4: Premium */}
        <motion.div variants={item} whileHover={{ scale: 1.05 }} className="glass-panel p-6 rounded-3xl bg-gradient-to-br from-indigo-900/40 to-blue-900/20 border-indigo-500/20 relative group hover:border-indigo-500/40 transition-all flex flex-col justify-between">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
          <p className="text-indigo-200 text-sm font-medium mb-1">Weekly Premium Plan</p>
          <div className="text-4xl font-bold text-white mb-4">₹25<span className="text-lg text-indigo-300 font-normal"> / wk</span></div>
          <motion.button 
            whileTap={{ scale: 0.95 }} 
            onClick={() => toast.success('Redirecting to Upgrade Coverage...')}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-all shadow-[0_4px_20px_rgba(37,99,235,0.4)] hover:shadow-[0_4px_25px_rgba(37,99,235,0.6)] flex items-center justify-center group-hover:scale-[1.02]">
            Upgrade Coverage <ChevronRight size={18} className="ml-1 group-hover:translate-x-1 transition-transform" />
          </motion.button>
        </motion.div>
      </div>

      {/* Lower Section: Chart & Claims */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
        <motion.div variants={item} className="glass-panel p-6 rounded-3xl lg:col-span-2">
          <h3 className="text-lg font-bold text-white mb-1 flex items-center"><TrendingUp size={18} className="mr-2 text-blue-400"/> Income & Payout Trend</h3>
          <p className="text-sm text-slate-400 mb-4">Your platform earnings vs GigShield payouts (Last 7 days)</p>
          <EarningsChart /> 
          <div className="flex gap-4 mt-4 text-xs text-slate-400 justify-center">
            <div className="flex items-center"><div className="w-3 h-3 bg-blue-500/50 rounded mr-2"></div> Platform Earnings</div>
            <div className="flex items-center"><div className="w-3 h-3 bg-emerald-500/50 rounded mr-2"></div> GigShield Auto-Claims</div>
          </div>
        </motion.div>
        
        <motion.div variants={item} className="glass-panel p-6 rounded-3xl flex flex-col">
            <h3 className="text-lg font-bold text-white mb-4">Recent Auto-Claims</h3>
            <div className="space-y-4 flex-1">
              
              {/* Fake Live API Claim Item */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-900/20 to-transparent border border-emerald-500/30 hover:bg-emerald-900/30 transition-colors cursor-pointer group shadow-[0_0_15px_rgba(16,185,129,0.05)]">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-semibold text-white flex items-center">
                      <CloudRain size={14} className="mr-1.5 text-blue-400" />
                      Auto-triggered (Rain: 72mm)
                    </span>
                    <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full flex items-center font-medium shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                      <CheckCircle size={10} className="mr-1" /> Paid
                    </span>
                  </div>
                  <div className="flex justify-between items-end text-slate-400 text-xs">
                    <div>
                      <p className="mb-0.5 text-emerald-200/70 font-medium">Processed instantly</p>
                      <p>Koramangala Zone</p>
                    </div>
                    <span className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">₹450</span>
                  </div>
              </div>

               {/* Claim Item 2 */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer opacity-70 group">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-semibold text-white">Heatwave Shift</span>
                    <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full flex items-center font-medium">
                      <CheckCircle size={10} className="mr-1"/> Paid
                    </span>
                  </div>
                  <div className="flex justify-between items-end text-slate-400 text-xs">
                    <div>
                      <p className="mb-0.5">Oct 05 • 2:00 PM</p>
                      <p>Indiranagar Zone</p>
                    </div>
                    <span className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">₹150</span>
                  </div>
              </div>
            </div>
            
            <button 
                onClick={() => toast('Loading Detailed History...', { icon: '⏳' })}
                className="w-full mt-4 text-blue-400 text-sm font-medium hover:text-blue-300 py-3 bg-blue-500/10 rounded-xl transition-all hover:bg-blue-500/20 flex items-center justify-center gap-1 group">
                View Detailed History <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
        </motion.div>
      </div>

    </motion.div>
  );
}
