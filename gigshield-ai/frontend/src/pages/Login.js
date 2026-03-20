import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Shield, Smartphone, ArrowRight, ShieldCheck } from 'lucide-react';

export default function Login() {
  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState(new Array(4).fill(''));
  const inputRefs = useRef([]);
  const navigate = useNavigate();

  // Auto-focus first OTP input when step changes to 2
  useEffect(() => {
    if (step === 2 && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [step]);

  const handleSendOTP = (e) => {
    e.preventDefault();
    setStep(2);
  };

  const handleVerify = (e) => {
    e.preventDefault();
    const combinedOtp = otp.join('');
    if (combinedOtp.length === 4) {
      navigate('/dashboard');
    }
  };

  const handleOtpChange = (e, index) => {
    const value = e.target.value;
    if (isNaN(value)) return;

    const newOtp = [...otp];
    // Allow only the last entered digit
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    // Auto-advance
    if (value && index < 3 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleOtpKeyDown = (e, index) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0 && inputRefs.current[index - 1]) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text/plain').trim();
    if (isNaN(pastedData)) return;

    const pastedArray = pastedData.slice(0, 4).split('');
    const newOtp = [...otp];
    pastedArray.forEach((char, idx) => {
      newOtp[idx] = char;
    });
    setOtp(newOtp);

    const nextIndex = pastedArray.length < 4 ? pastedArray.length : 3;
    if (inputRefs.current[nextIndex]) {
      inputRefs.current[nextIndex].focus();
    }
  };

  return (
    <div className="min-h-screen flex text-slate-50 items-center justify-center p-4">
      {/* Decorative background elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/30 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/20 rounded-full blur-[100px] pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="glass-panel p-8 md:p-10 rounded-[2rem] border border-white/10 shadow-2xl relative overflow-hidden backdrop-blur-2xl">
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>
          
          <div className="relative z-10 flex flex-col items-center mb-10 text-center">
            <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(59,130,246,0.3)]">
              <Shield className="text-blue-400 fill-blue-400/20" size={32} />
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">GigShield AI</h1>
            <p className="text-slate-400 text-sm">Income protection for India's gig workers.</p>
          </div>

          <form onSubmit={step === 1 ? handleSendOTP : handleVerify} className="relative z-10">
            {step === 1 ? (
              <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-300 mb-2">Mobile Number</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <span className="text-slate-500 font-medium">+91</span>
                    </div>
                    <input 
                      type="tel" 
                      placeholder="98765 43210" 
                      className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl py-3.5 pl-14 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium tracking-wide"
                      required
                      autoFocus
                    />
                    <Smartphone className="absolute inset-y-0 right-4 top-3.5 text-slate-500" size={20} />
                  </div>
                </div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3.5 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all flex justify-center items-center group">
                  Get OTP <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>
            ) : (
              <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-slate-300">Enter OTP</label>
                    <span className="text-xs text-blue-400 cursor-pointer hover:underline" onClick={() => setStep(1)}>Change Number</span>
                  </div>
                  <div className="flex gap-2 justify-between">
                    {otp.map((data, index) => (
                      <input 
                        key={index}
                        type="text" 
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength="1"
                        ref={(ref) => (inputRefs.current[index] = ref)}
                        value={data}
                        onChange={(e) => handleOtpChange(e, index)}
                        onKeyDown={(e) => handleOtpKeyDown(e, index)}
                        onPaste={handleOtpPaste}
                        className="w-14 h-14 text-center text-xl bg-slate-900/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 transition-all font-bold"
                        required
                        aria-label={`OTP input digit ${index + 1}`}
                      />
                    ))}
                  </div>
                  <p className="text-center text-xs text-slate-500 mt-4">Demo mode: Enter any 4 digits</p>
                </div>
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3.5 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all flex justify-center items-center">
                  Verify & Secure Login <ShieldCheck size={18} className="ml-2" />
                </button>
              </motion.div>
            )}
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center relative z-10">
             <p className="text-xs text-slate-500">By logging in, you agree to our Terms & Insurance Policy constraints.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
