import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Vote, 
  FilePlus, 
  AlertTriangle, 
  Siren, 
  MapPin, 
  BookOpen, 
  Phone, 
  ShieldCheck, 
  X, 
  CheckCircle2, 
  Radio, 
  LogIn, 
  ExternalLink,
  PhoneCall,
  Flame
} from 'lucide-react';
import DangerAlertModal from './DangerAlertModal';
import ObserverOnboarding from './ObserverOnboarding';
import CheckInCard from './CheckInCard';
import { toast } from 'sonner';

export default function ObserverFAB() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [showDangerModal, setShowDangerModal] = useState(false);
  const [showGuidelinesModal, setShowGuidelinesModal] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showHotlinesModal, setShowHotlinesModal] = useState(false);

  // Close speed dial on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setShowHotlinesModal(false);
        setShowCheckInModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Only render floating button for authenticated users (Observers, Supervisors, and Admin)
  if (!user) {
    return null;
  }

  const isCheckedIn = user?.checkInStatus === 'checked_in' || user?.checkInStatus === 'observing';

  const actions = [
    {
      id: 'report',
      label: 'File Polling Report',
      description: 'Submit accreditation & vote tally',
      icon: FilePlus,
      color: 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400',
      badge: 'Fast Transmit',
      onClick: () => {
        setIsOpen(false);
        navigate('/report');
      }
    },
    {
      id: 'incident',
      label: 'Report Incident',
      description: 'Log malpractice, violence or BVAS failure',
      icon: AlertTriangle,
      color: 'bg-amber-600 hover:bg-amber-500 text-white border-amber-400',
      badge: 'Irregularity',
      onClick: () => {
        setIsOpen(false);
        navigate('/incidents');
      }
    },
    {
      id: 'checkin',
      label: isCheckedIn ? 'Update PU Check-In' : 'Check In at Polling Unit',
      description: isCheckedIn ? 'Transmitting GPS lock' : 'Log arrival & verify location',
      icon: MapPin,
      color: 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400',
      badge: isCheckedIn ? 'Checked In' : 'Action Required',
      onClick: () => {
        setIsOpen(false);
        setShowCheckInModal(true);
      }
    },
    {
      id: 'sos',
      label: 'Emergency SOS / Danger Alert',
      description: 'Instant distress broadcast to HQ & Police',
      icon: Siren,
      color: 'bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white border-red-400',
      badge: 'HIGH PRIORITY',
      onClick: () => {
        setIsOpen(false);
        setShowDangerModal(true);
      }
    },
    {
      id: 'guidelines',
      label: 'Code of Conduct & Rules',
      description: 'Observer checklist, INEC guidelines',
      icon: BookOpen,
      color: 'bg-slate-800 hover:bg-slate-700 text-white border-slate-600',
      badge: 'Manual',
      onClick: () => {
        setIsOpen(false);
        setShowGuidelinesModal(true);
      }
    },
    {
      id: 'hotlines',
      label: 'Emergency Hotlines & HQ',
      description: 'Direct numbers for INEC, Police, & Watch Desk',
      icon: Phone,
      color: 'bg-indigo-700 hover:bg-indigo-600 text-white border-indigo-500',
      badge: 'Helpline',
      onClick: () => {
        setIsOpen(false);
        setShowHotlinesModal(true);
      }
    }
  ];

  return (
    <>
      {/* Floating Action Button (Speed Dial Trigger) */}
      <div 
        id="observer-fab-container"
        className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-40 flex flex-col items-end pointer-events-none"
      >
        {/* Backdrop Overlay when opened */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-30 pointer-events-auto cursor-pointer"
              aria-hidden="true"
            />
          )}
        </AnimatePresence>

        {/* Speed Dial Menu Actions */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative z-40 mb-3 w-[calc(100vw-3rem)] max-w-sm sm:max-w-md bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-4 shadow-2xl space-y-2 pointer-events-auto overflow-hidden text-white"
              role="dialog"
              aria-label="Observer Quick Actions Menu"
            >
              {/* Header inside popup */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 px-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shadow-inner">
                    <Vote className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
                      Observer Quick Actions
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    </h3>
                    <p className="text-[10px] text-gray-400 font-medium">
                      Logged in: {user.displayName || user.email}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                  aria-label="Close actions menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Action Buttons List */}
              <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
                {actions.map((action, idx) => {
                  const Icon = action.icon;
                  return (
                    <motion.button
                      key={action.id}
                      type="button"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      onClick={action.onClick}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all text-left group shadow-sm ${action.color} cursor-pointer active:scale-[0.98]`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 shadow-inner">
                        <Icon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-white tracking-tight truncate">
                            {action.label}
                          </span>
                          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/30 text-white/90 shrink-0">
                            {action.badge}
                          </span>
                        </div>
                        <p className="text-[10px] text-white/80 font-medium truncate mt-0.5">
                          {action.description}
                        </p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Status footer snippet */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-gray-400 px-1">
                <span className="flex items-center gap-1.5">
                  <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                  Live Sync Active
                </span>
                <span className="font-mono text-gray-300">
                  {isCheckedIn ? 'Status: Stationed' : 'Status: Pending Check-In'}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Primary FAB Trigger Button */}
        <button
          id="observer-fab-trigger"
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-label="Observer Quick Actions Floating Button"
          className="relative z-40 pointer-events-auto flex items-center gap-2.5 px-4 py-3.5 bg-gradient-to-r from-[#141A56] via-indigo-900 to-emerald-800 text-white rounded-full shadow-2xl hover:shadow-emerald-900/50 border-2 border-emerald-400/80 hover:border-emerald-300 active:scale-95 transition-all duration-200 group cursor-pointer"
        >
          {/* Pulsing Alert/Live Dot */}
          <span className="relative flex h-3 w-3 shrink-0">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isCheckedIn ? 'bg-emerald-400' : 'bg-[#FC560C]'}`} />
            <span className={`relative inline-flex rounded-full h-3 w-3 ${isCheckedIn ? 'bg-emerald-500' : 'bg-[#FC560C]'}`} />
          </span>

          {/* Animated Icon */}
          <div className="relative w-6 h-6 flex items-center justify-center">
            <AnimatePresence mode="wait">
              {isOpen ? (
                <motion.div
                  key="close"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <X className="w-6 h-6 text-white" />
                </motion.div>
              ) : (
                <motion.div
                  key="open"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center justify-center"
                >
                  <Vote className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Button Text Label */}
          <div className="text-left hidden sm:block">
            <p className="text-[11px] font-black uppercase tracking-wider text-white leading-tight">
              {isOpen ? 'Close Actions' : 'Observer Actions'}
            </p>
            <p className="text-[9px] text-emerald-300 font-medium leading-none">
              {isCheckedIn ? 'Field Active' : 'Quick Transmit'}
            </p>
          </div>
        </button>
      </div>

      {/* EMERGENCY SOS MODAL */}
      <DangerAlertModal 
        isOpen={showDangerModal} 
        onClose={() => setShowDangerModal(false)} 
      />

      {/* CODE OF CONDUCT / GUIDELINES MODAL */}
      <AnimatePresence>
        {showGuidelinesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-4xl"
            >
              <ObserverOnboarding 
                onCancel={() => setShowGuidelinesModal(false)}
                onComplete={() => setShowGuidelinesModal(false)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* INLINE POLLING UNIT CHECK-IN MODAL */}
      <AnimatePresence>
        {showCheckInModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-xl bg-white rounded-3xl p-6 shadow-2xl border border-gray-100 relative"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">Polling Unit Check-In</h3>
                    <p className="text-xs text-gray-500">Transmit real-time GPS coordinates & verification</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCheckInModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <CheckInCard onCheckInSuccess={() => {
                toast.success('Observer Check-In Synchronized Successfully');
                setTimeout(() => setShowCheckInModal(false), 1200);
              }} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EMERGENCY HOTLINES MODAL */}
      <AnimatePresence>
        {showHotlinesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg bg-slate-900 text-white rounded-3xl p-6 shadow-2xl border border-slate-800 relative space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-2xl">
                    <PhoneCall className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Electoral & Security Hotlines</h3>
                    <p className="text-xs text-gray-400">Direct situation room response contacts</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHotlinesModal(false)}
                  className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-white text-sm">INEC Situation Room Hotline</p>
                    <p className="text-gray-400 text-[11px]">Official National Election Complaints</p>
                  </div>
                  <a 
                    href="tel:07004632696" 
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center gap-1.5 transition-all text-xs shrink-0"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>0700-CALL-INEC</span>
                  </a>
                </div>

                <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-white text-sm">Nigeria Police Election Security</p>
                    <p className="text-gray-400 text-[11px]">Rapid Response & Anti-Violence Unit</p>
                  </div>
                  <a 
                    href="tel:112" 
                    className="px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl flex items-center gap-1.5 transition-all text-xs shrink-0"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>112 / 08031230000</span>
                  </a>
                </div>

                <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-white text-sm">Civilian Observer Desk (iVote HQ)</p>
                    <p className="text-gray-400 text-[11px]">Technical issues & BVAS incident routing</p>
                  </div>
                  <a 
                    href="tel:080000048683" 
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center gap-1.5 transition-all text-xs shrink-0"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>iVote Desk</span>
                  </a>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowHotlinesModal(false);
                    setShowDangerModal(true);
                  }}
                  className="w-full py-3 bg-red-600/30 hover:bg-red-600/40 text-red-300 hover:text-red-200 border border-red-500/50 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Flame className="w-4 h-4 text-red-400" />
                  <span>Switch to Emergency SOS Distress Broadcast</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
