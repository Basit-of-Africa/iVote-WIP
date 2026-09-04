import React, { useState, useEffect } from 'react';
import { 
  Timer, 
  Calendar, 
  MapPin, 
  Users, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  Vote, 
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPassed: boolean;
}

// Scheduled date for the Osun State Off-Cycle Gubernatorial Election: Saturday, August 15, 2026 at 08:00 WAT
const ELECTION_TARGET_DATE = new Date('2026-08-15T08:00:00+01:00').getTime();

export default function OsunCountdown() {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0, isPassed: false });
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const calculateTime = () => {
      const now = Date.now();
      const difference = ELECTION_TARGET_DATE - now;

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isPassed: true });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      setTimeLeft({ days, hours, minutes, seconds, isPassed: false });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-emerald-500/20"
    >
      {/* Background Decorative Accent Ring */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 space-y-5 sm:space-y-6">
        {/* Top Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-emerald-500/20 pb-4 sm:pb-5">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 sm:p-3 bg-emerald-500/20 border border-emerald-400/30 rounded-2xl text-emerald-400 shadow-inner shrink-0 mt-0.5 sm:mt-0">
              <Vote className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-slate-950">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
                  Off-Cycle Race
                </span>
                <span className="text-xs font-bold text-emerald-300/80">INEC Osun State</span>
              </div>
              <h2 className="text-lg sm:text-2xl font-bold font-serif text-white mt-1 tracking-tight leading-snug">
                Osun State Gubernatorial Election Countdown
              </h2>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 text-xs text-gray-300 bg-slate-800/80 backdrop-blur-md border border-slate-700 px-3.5 py-2 rounded-xl self-start sm:self-auto shrink-0">
            <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">Saturday, August 15, 2026</span>
          </div>
        </div>

        {/* Live Countdown Timer Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
          {[
            { label: 'Days', value: timeLeft.days, color: 'from-emerald-500/20 to-emerald-900/40', border: 'border-emerald-500/20' },
            { label: 'Hours', value: timeLeft.hours, color: 'from-slate-800/90 to-slate-900/90', border: 'border-emerald-500/20' },
            { label: 'Minutes', value: timeLeft.minutes, color: 'from-slate-800/90 to-slate-900/90', border: 'border-emerald-500/20' },
            { label: 'Seconds', value: timeLeft.seconds, color: 'from-[#FC560C]/25 to-[#FC560C]/10', border: 'border-[#FC560C]/50 shadow-[#FC560C]/10' },
          ].map((item, idx) => (
            <div 
              key={idx}
              className={`bg-gradient-to-b ${item.color} backdrop-blur-md border ${item.border} rounded-2xl p-3 sm:p-4 text-center shadow-lg hover:border-[#FC560C]/60 transition-all`}
            >
              <div className="text-2xl sm:text-4xl md:text-5xl font-black font-mono tracking-tight text-white leading-none">
                {String(item.value).padStart(2, '0')}
              </div>
              <div className={`text-[10px] sm:text-xs font-bold uppercase tracking-widest ${idx === 3 ? 'text-[#FC560C]' : 'text-emerald-400/90'} mt-1.5`}>
                {item.label}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Stat Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 pt-1">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 flex items-center gap-3">
            <MapPin className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase">Coverage Scope</p>
              <p className="text-xs font-black text-white truncate">30 LGAs • 3,010 Polling Units</p>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 flex items-center gap-3">
            <Users className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase">Voter Register</p>
              <p className="text-xs font-black text-white truncate">~1.95M Registered Voters</p>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase">BVAS Verification</p>
              <p className="text-xs font-black text-white truncate">100% Digital Accreditation</p>
            </div>
          </div>
        </div>

        {/* Footer Toggle and Action Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5 pt-2 border-t border-emerald-500/10">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center justify-between sm:justify-start gap-2 text-xs font-bold text-emerald-300 hover:text-emerald-200 transition-colors cursor-pointer py-1"
          >
            <span>{showDetails ? 'Hide Election Specs & Timeline' : 'View Osun Electoral Guidelines & Breakdown'}</span>
            {showDetails ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
          </button>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link
              to="/report"
              className="w-full sm:w-auto px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md text-center min-h-[44px] flex items-center justify-center"
            >
              File Osun Field Report
            </Link>
          </div>
        </div>

        {/* Expandable Election Details */}
        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-emerald-500/20 pt-4 mt-2 space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-300">
                <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <h4 className="font-bold text-emerald-400 flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
                    <Timer className="w-3.5 h-3.5 shrink-0" /> Official Election Schedule
                  </h4>
                  <ul className="space-y-1.5 text-gray-300">
                    <li className="flex justify-between border-b border-slate-800 pb-1">
                      <span className="text-gray-400">Poll Opening:</span>
                      <span className="font-bold text-white">08:30 AM WAT</span>
                    </li>
                    <li className="flex justify-between border-b border-slate-800 pb-1">
                      <span className="text-gray-400">Poll Closing:</span>
                      <span className="font-bold text-white">02:30 PM WAT</span>
                    </li>
                    <li className="flex justify-between border-b border-slate-800 pb-1">
                      <span className="text-gray-400">Result Transmission:</span>
                      <span className="font-bold text-emerald-400">INEC IReV Direct Portal</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <h4 className="font-bold text-amber-400 flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" /> High-Priority Osun Senatorial Districts
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center text-[10px]">
                    <div className="bg-slate-800 p-2.5 rounded-xl border border-slate-700">
                      <p className="font-black text-white text-xs">Osun Central</p>
                      <p className="text-gray-400 mt-0.5">Osogbo, Olorunda</p>
                    </div>
                    <div className="bg-slate-800 p-2.5 rounded-xl border border-slate-700">
                      <p className="font-black text-white text-xs">Osun East</p>
                      <p className="text-gray-400 mt-0.5">Ife, Ilesa</p>
                    </div>
                    <div className="bg-slate-800 p-2.5 rounded-xl border border-slate-700">
                      <p className="font-black text-white text-xs">Osun West</p>
                      <p className="text-gray-400 mt-0.5">Ede, Iwo</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
