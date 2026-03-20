import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, AlertTriangle, CloudRain, Wind, Activity } from 'lucide-react';

export default function RiskMap() {
  const [activeZone, setActiveZone] = useState('red');

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.5 } } };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-2 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Live Risk Map</h1>
          <p className="text-slate-400">Real-time artificial intelligence assessing weather, traffic, and zone warnings.</p>
        </div>
        <div className="flex flex-wrap gap-3">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveZone('red')}
              className={`flex items-center text-xs px-3 py-1.5 rounded-full border transition-colors ${activeZone === 'red' ? 'bg-red-500/20 text-red-400 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-red-500/5 text-red-500/50 border-red-500/10 hover:bg-red-500/10'}`}>
              <AlertTriangle size={14} className="mr-1.5"/> High Risk (Active)
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveZone('amber')}
              className={`flex items-center text-xs px-3 py-1.5 rounded-full border transition-colors ${activeZone === 'amber' ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-amber-500/5 text-amber-500/50 border-amber-500/10 hover:bg-amber-500/10'}`}>
              <CloudRain size={14} className="mr-1.5"/> Moderate Warning
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveZone('green')}
              className={`flex items-center text-xs px-3 py-1.5 rounded-full border transition-colors ${activeZone === 'green' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-emerald-500/5 text-emerald-500/50 border-emerald-500/10 hover:bg-emerald-500/10'}`}>
              <Wind size={14} className="mr-1.5"/> Safe Zone
            </motion.button>
        </div>
      </div>

      <div className="glass-panel border-white/10 rounded-3xl relative overflow-hidden flex-1 min-h-[600px] w-full flex items-center justify-center bg-slate-900/50 shadow-2xl">
        
        {/* Mock Grid Map Element background */}
        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/gridme.png')] repeat mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950"></div>
        
        {/* Interactive Zones */}
        <div className="relative w-full max-w-4xl h-[500px] z-10 flex items-center justify-center">
          
          {/* Central UI */}
          <div className="absolute z-0 flex flex-col items-center pointer-events-none">
            <div className="w-20 h-20 bg-slate-800/80 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)] relative overflow-hidden">
              <div className="absolute inset-0 bg-blue-500/20 animate-pulse"></div>
              <Activity className="text-blue-400 relative z-10" size={36} />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3 drop-shadow-md">GigShield AI Backend</h3>
          </div>

          {/* Red Zone Drop Tooltip / Pulse */}
          <AnimatePresence>
            {activeZone === 'red' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute top-[15%] left-[20%] z-20 cursor-pointer group"
              >
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute -inset-8 bg-red-500/20 rounded-full blur-xl"></motion.div>
                <div className="relative bg-slate-900/90 backdrop-blur border border-red-500/50 p-4 rounded-xl shadow-[0_0_30px_rgba(239,68,68,0.3)] w-56 transform transition-transform group-hover:scale-105 group-hover:border-red-400">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                    <MapPin size={16} className="text-red-400" />
                    <span className="font-bold text-white text-sm">Zone: Koramangala</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <p className="text-slate-300 flex justify-between"><span>Risk:</span> <span className="text-red-400 font-bold">🔥 High</span></p>
                    <p className="text-slate-300 flex justify-between"><span>Rainfall:</span> <span className="text-amber-400 font-bold">72mm</span></p>
                    <p className="text-slate-300 flex justify-between"><span>Status:</span> <span className="text-white">Payout Triggered</span></p>
                  </div>
                </div>
              </motion.div>
            )}
            
            {/* Amber Zone */}
            {activeZone === 'amber' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute bottom-[25%] right-[25%] z-20 cursor-pointer group"
              >
                <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 3 }} className="absolute -inset-10 bg-amber-500/20 rounded-full blur-xl"></motion.div>
                <div className="relative bg-slate-900/90 backdrop-blur border border-amber-500/50 p-4 rounded-xl shadow-[0_0_30px_rgba(245,158,11,0.2)] w-56 transform transition-transform group-hover:scale-105 group-hover:border-amber-400">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                    <MapPin size={16} className="text-amber-400" />
                    <span className="font-bold text-white text-sm">Zone: Indiranagar</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <p className="text-slate-300 flex justify-between"><span>Risk:</span> <span className="text-amber-400 font-bold">Moderate</span></p>
                    <p className="text-slate-300 flex justify-between"><span>Traffic:</span> <span className="text-red-400 font-bold">Gridlock Alerts</span></p>
                    <p className="text-slate-300 flex justify-between"><span>Status:</span> <span className="text-white">Monitoring</span></p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Green Zone */}
            {activeZone === 'green' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute top-[35%] right-[10%] z-20 cursor-pointer group"
              >
                <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 4 }} className="absolute -inset-12 bg-emerald-500/10 rounded-full blur-xl"></motion.div>
                <div className="relative bg-slate-900/90 backdrop-blur border border-emerald-500/50 p-4 rounded-xl shadow-[0_0_30px_rgba(16,185,129,0.2)] w-56 transform transition-transform group-hover:scale-105 group-hover:border-emerald-400">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                    <MapPin size={16} className="text-emerald-400" />
                    <span className="font-bold text-white text-sm">Zone: HSR Layout</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <p className="text-slate-300 flex justify-between"><span>Risk:</span> <span className="text-emerald-400 font-bold">Low</span></p>
                    <p className="text-slate-300 flex justify-between"><span>Weather:</span> <span className="text-emerald-400 font-bold">Clear</span></p>
                    <p className="text-slate-300 flex justify-between"><span>Status:</span> <span className="text-white">All Clear</span></p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </motion.div>
  );
}
