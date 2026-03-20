import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, AlertCircle, Calendar, MapPin, IndianRupee, CloudRain, Wind } from 'lucide-react';
import toast from 'react-hot-toast';

const claimsData = [
  {
    id: "CLM-8842-X",
    date: "17 Mar 2026",
    trigger: "Auto-triggered due to heavy rain (72mm)",
    zone: "Koramangala, Bangalore",
    amount: "₹450",
    status: "PAID",
    time: "Processed instantly",
    icon: <CloudRain size={24} />
  },
  {
    id: "CLM-7731-Y",
    date: "05 Oct 2025",
    trigger: "Auto-triggered due to hazardous AQI (420)",
    zone: "Indiranagar, Bangalore",
    amount: "₹300",
    status: "PAID",
    time: "Auto-processed in 1m 40s",
    icon: <Wind size={24} />
  },
  {
    id: "CLM-6620-Z",
    date: "28 Sep 2025",
    trigger: "Waterlogging / Traffic Halt",
    zone: "HSR Layout, Bangalore",
    amount: "₹300",
    status: "PENDING_REVIEW",
    time: "Analyzing Data Sources",
    icon: <AlertCircle size={24} />
  }
];

export default function Claims() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
      toast('Syncing latest parametric triggers...', {
        icon: '🔄',
        id: 'sync-toast',
      });
      setTimeout(() => {
        toast.success('Claims up to date', { id: 'sync-toast' });
      }, 1500);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
        <div className="h-10 bg-slate-800/50 rounded-xl w-1/4 animate-pulse mb-8"></div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-white/5 rounded-2xl animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      
      <div className="flex justify-between items-end mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Claim History</h1>
            <span className="text-[10px] font-medium tracking-wider uppercase bg-slate-800 text-slate-300 px-2 py-1 rounded flex items-center mb-2">
              <Clock size={10} className="mr-1" /> Updated just now
            </span>
          </div>
          <p className="text-slate-400 mb-2">Zero-touch claims. Triggered by data, paid in seconds.</p>
          <div className="inline-block bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm px-3 py-1.5 rounded-full">
            ✨ No action required — auto processed instantly
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {claimsData.map((claim, idx) => (
          <motion.div key={claim.id} variants={item} whileHover={{ scale: 1.02 }} className={`glass-panel p-6 rounded-2xl flex flex-col md:flex-row justify-between md:items-center gap-4 transition-all border ${
            idx === 0 ? 'border-emerald-500/30 bg-emerald-950/20 shadow-[0_0_20px_rgba(16,185,129,0.1)] hover:bg-emerald-900/30' : 'border-white/5 hover:bg-white/10'
          }`}>
            
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-full mt-1 ${claim.status === 'PAID' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                {claim.icon}
              </div>
              
              <div>
                <h3 className="text-lg font-bold text-white mb-1">{claim.trigger}</h3>
                <div className="flex flex-wrap gap-3 text-sm text-slate-400">
                  <span className="flex items-center"><Calendar size={14} className="mr-1"/> {claim.date}</span>
                  <span className="flex items-center"><MapPin size={14} className="mr-1"/> {claim.zone}</span>
                  <span className="flex items-center text-white font-medium"><IndianRupee size={14} className="mr-0.5"/> {claim.amount} payout</span>
                </div>
              </div>
            </div>

            <div className="text-left md:text-right bg-black/30 p-4 rounded-xl border border-white/5 min-w-[200px] flex flex-col justify-center">
              <div className={`text-xs font-bold px-3 py-1.5 rounded-full inline-flex items-center justify-center mb-2 w-max shadow-lg ${
                claim.status === 'PAID' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                {claim.status === 'PAID' ? <><CheckCircle2 size={14} className="mr-1.5"/> Paid ✅</> : 'REVIEW PENDING'}
              </div>
              <p className="text-xs text-slate-500 flex items-center md:justify-end">
                <Clock size={12} className="mr-1"/> {claim.time}
              </p>
            </div>

          </motion.div>
        ))}
      </div>

      <div className="mt-8 p-6 glass-panel rounded-2xl border-blue-500/20 bg-blue-900/10 flex items-start gap-4">
        <div className="text-blue-400 mt-1"><AlertCircle size={24} /></div>
        <div>
          <h4 className="text-white font-medium mb-1">How do parametric claims work?</h4>
          <p className="text-sm text-slate-400">You don't need to file a claim. Our platform continuously monitors weather and traffic APIs for your zone. If conditions cross your policy's threshold, a claim is auto-generated and paid directly to your linked UPI/Bank account.</p>
        </div>
      </div>

    </motion.div>
  );
}
