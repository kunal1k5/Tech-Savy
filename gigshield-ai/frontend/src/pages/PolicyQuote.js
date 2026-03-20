import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Check, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PolicyQuote() {
  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
      
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4">Choose Your Protection</h1>
        <p className="text-slate-400 max-w-2xl mx-auto">GigShield AI dynamically calculates your premium based on your delivery zone, historical weather data, and real-time risk scores.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 mt-8">
        
        {/* Basic Plan */}
        <motion.div variants={item} whileHover={{ scale: 1.05 }} className="glass-panel p-8 rounded-[2rem] border border-white/5 relative bg-gradient-to-b from-slate-800/20 to-slate-900/50 hover:border-white/10 transition-colors h-fit">
          <h3 className="text-xl font-bold text-white mb-2">Basic Cover</h3>
          <p className="text-slate-400 text-sm mb-6">Essential protection for minor disruptions.</p>
          <div className="text-4xl font-bold text-white mb-6">₹15 <span className="text-lg text-slate-500 font-normal">/ week</span></div>
          
          <ul className="space-y-4 mb-8">
            <li className="flex items-start"><Check size={18} className="text-blue-400 mr-2 mt-0.5"/> <span className="text-slate-300 text-sm">₹300 daily max payout</span></li>
            <li className="flex items-start"><Check size={18} className="text-blue-400 mr-2 mt-0.5"/> <span className="text-slate-300 text-sm">Cover for severe rain (>50mm)</span></li>
            <li className="flex items-start opacity-40"><Check size={18} className="text-slate-600 mr-2 mt-0.5"/> <span className="text-slate-500 text-sm">No coverage for heatwaves</span></li>
            <li className="flex items-start opacity-40"><Check size={18} className="text-slate-600 mr-2 mt-0.5"/> <span className="text-slate-500 text-sm">No coverage for high AQI</span></li>
          </ul>
          
          <motion.button whileTap={{ scale: 0.95 }} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-3.5 rounded-xl transition-all border border-white/10" onClick={() => toast("Basic plan selected")}>
            Select Basic
          </motion.button>
        </motion.div>

        {/* AI Recommended Plan */}
        <motion.div variants={item} whileHover={{ scale: 1.05 }} className="glass-panel p-8 rounded-[2rem] border-2 border-blue-500/50 relative bg-gradient-to-b from-blue-900/40 to-slate-900/80 transform md:-translate-y-4 shadow-[0_0_40px_rgba(37,99,235,0.2)] hover:shadow-[0_0_60px_rgba(37,99,235,0.3)] transition-all">
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-full flex items-center shadow-[0_0_20px_rgba(59,130,246,0.6)] animate-pulse border border-blue-400/50 w-max">
            <Zap size={14} className="mr-1.5 fill-white" /> RECOMMENDED BY AI · BEST FOR YOUR LOCATION
          </div>
          
          <h3 className="text-2xl font-bold text-white mb-2 text-center mt-3">Comprehensive Cover</h3>
          <p className="text-blue-200/70 text-sm mb-4 text-center">Full protection tailored for Bangalore Zones.</p>
          
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-bold py-1.5 px-4 rounded-full mx-auto w-max mb-6 shadow-[0_0_15px_rgba(16,185,129,0.2)] flex items-center justify-center animate-pulse">
            ✨ You save ₹200/week with this plan
          </div>

          <div className="text-5xl font-bold text-white mb-6 text-center shadow-blue-500/50 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">₹25 <span className="text-lg text-blue-300/50 font-normal">/ week</span></div>
          
          <ul className="space-y-4 mb-8 bg-black/20 p-5 rounded-2xl border border-white/5">
            <li className="flex items-start"><Check size={18} className="text-emerald-400 mr-2 mt-0.5 shadow-[0_0_10px_rgba(16,185,129,0.5)] rounded-full"/> <span className="text-slate-200 text-sm font-medium">₹600 daily max payout (80% income)</span></li>
            <li className="flex items-start"><Check size={18} className="text-emerald-400 mr-2 mt-0.5 shadow-[0_0_10px_rgba(16,185,129,0.5)] rounded-full"/> <span className="text-slate-200 text-sm">Cover for severe rain & waterlogging</span></li>
            <li className="flex items-start"><Check size={18} className="text-emerald-400 mr-2 mt-0.5 shadow-[0_0_10px_rgba(16,185,129,0.5)] rounded-full"/> <span className="text-slate-200 text-sm">Cover for extreme Heatwaves (>45°C)</span></li>
            <li className="flex items-start"><Check size={18} className="text-emerald-400 mr-2 mt-0.5 shadow-[0_0_10px_rgba(16,185,129,0.5)] rounded-full"/> <span className="text-slate-200 text-sm">Cover for hazardous pollution (AQI >400)</span></li>
          </ul>
          
          <motion.button 
            whileTap={{ scale: 0.95 }}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-4 rounded-xl transition-all shadow-[0_4px_20px_rgba(37,99,235,0.5)] hover:shadow-[0_4px_30px_rgba(37,99,235,0.7)] flex justify-center items-center hover:scale-[1.02]"
            onClick={() => toast.success('Policy active! Instantly processing payment...')}
          >
            Buy Policy <Shield size={18} className="ml-2" />
          </motion.button>
        </motion.div>

      </div>
    </motion.div>
  );
}
