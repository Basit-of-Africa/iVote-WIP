import React, { useState } from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  MapPin, 
  Clock, 
  Camera, 
  AlertTriangle, 
  FileCheck2, 
  Lock, 
  Sparkles, 
  Award, 
  BookOpen, 
  Check, 
  X,
  ChevronRight,
  Shield,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';

interface ObserverOnboardingProps {
  onComplete?: () => void;
  onCancel?: () => void;
  isMandatory?: boolean;
}

export default function ObserverOnboarding({ 
  onComplete, 
  onCancel, 
  isMandatory = false 
}: ObserverOnboardingProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'conduct' | 'arrival' | 'reporting' | 'security'>('conduct');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Checkboxes state for required pledges
  const [pledges, setPledges] = useState({
    neutrality: false,
    punctuality: false,
    accuracy: false,
    security: false,
  });

  const allPledgesChecked = Object.values(pledges).every(Boolean);

  const togglePledge = (key: keyof typeof pledges) => {
    setPledges(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAcknowledge = async () => {
    if (!allPledgesChecked) {
      toast.error('Please check and accept all four observer pledges to proceed.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Store in localStorage for instant offline access
      if (user?.uid) {
        localStorage.setItem(`observer_guidelines_ack_${user.uid}`, 'true');

        // 2. Persist to Firestore user document
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          hasAcknowledgedGuidelines: true,
          guidelinesAcknowledgedAt: serverTimestamp(),
        }).catch((err) => {
          console.warn('Non-fatal Firestore update warning:', err);
        });
      } else {
        localStorage.setItem('observer_guidelines_ack_guest', 'true');
      }

      toast.success('Observer Code of Conduct Acknowledged!', {
        description: 'You now have full authorization to access field reporting tools.'
      });

      if (onComplete) {
        onComplete();
      }
    } catch (err) {
      console.error('Error recording acknowledgment:', err);
      // Fallback
      if (onComplete) onComplete();
    } finally {
      setIsSubmitting(false);
    }
  };

  const tabs = [
    { id: 'conduct', label: '1. Code of Conduct', icon: ShieldCheck },
    { id: 'arrival', label: '2. Arrival & Check-In', icon: Clock },
    { id: 'reporting', label: '3. Field Reporting', icon: FileCheck2 },
    { id: 'security', label: '4. Safety & Security', icon: Shield },
  ] as const;

  return (
    <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden max-w-4xl w-full mx-auto my-4 text-gray-900 font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-emerald-950 text-white p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/20 border border-emerald-400/30 rounded-2xl text-emerald-400 shrink-0">
              <Award className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-slate-950">
                  INEC Accredited Guidelines
                </span>
                <span className="text-xs font-semibold text-emerald-300">Election Day Protocol</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold font-serif text-white mt-1">
                Field Observer Onboarding
              </h2>
            </div>
          </div>

          {!isMandatory && onCancel && (
            <button
              onClick={onCancel}
              className="self-start sm:self-center p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <p className="text-emerald-100/80 text-xs sm:text-sm mt-3 max-w-2xl leading-relaxed">
          As an accredited election observer, your vigilance safeguards democracy. Please review and acknowledge these core operational protocols before accessing real-time accreditation, incident, and result reporting tools.
        </p>

        {/* Tab Navigation Row */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 mt-6 border-t border-emerald-500/20 pt-4 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                    : 'bg-slate-800/80 text-emerald-100/70 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content Container */}
      <div className="p-6 sm:p-8 space-y-6">
        <AnimatePresence mode="wait">
          {activeTab === 'conduct' && (
            <motion.div
              key="conduct"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-3 text-emerald-700 font-bold text-sm border-b border-emerald-100 pb-2">
                <ShieldCheck className="w-5 h-5" />
                <span>Code of Neutrality & Operational Ethics</span>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2 text-slate-900 font-black">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Non-Partisanship & Neutrality</span>
                  </div>
                  <p className="text-gray-600 leading-relaxed">
                    Observers must maintain strict non-partisan behavior. Never wear party colors, campaign apparel, or display badges supporting any political party or candidate.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2 text-slate-900 font-black">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Non-Interference Protocol</span>
                  </div>
                  <p className="text-gray-600 leading-relaxed">
                    Observe and record without interfering with INEC officials, voters, or security personnel. Do not touch election materials, ballot papers, or BVAS machines.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2 text-slate-900 font-black">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Visible Accreditation Tag</span>
                  </div>
                  <p className="text-gray-600 leading-relaxed">
                    Wear your official INEC observer tag and iVote digital badge prominently at all times while present within the 300-meter polling unit zone.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2 text-slate-900 font-black">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Prohibition of Inducements</span>
                  </div>
                  <p className="text-gray-600 leading-relaxed">
                    Strictly reject any monetary gifts, meals, or travel sponsorships provided by political agents or candidates before or during election day.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'arrival' && (
            <motion.div
              key="arrival"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-3 text-emerald-700 font-bold text-sm border-b border-emerald-100 pb-2">
                <Clock className="w-5 h-5" />
                <span>Punctuality & Polling Unit GPS Check-In</span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-amber-900">
                  <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Target Arrival: 07:30 AM WAT</p>
                    <p className="text-amber-800 text-[11px] mt-0.5">
                      Arrive at your assigned polling unit at least 60 minutes before poll opening (08:30 AM) to inspect early arrival of INEC materials, polling agents, and BVAS devices.
                    </p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      <MapPin className="w-4 h-4 text-emerald-600" />
                      <span>GPS Location Verification</span>
                    </div>
                    <p className="text-gray-600">
                      Log your official Check-In using the top-bar button. Ensure high accuracy (&lt;30m) location permissions are enabled on your device.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-slate-900">
                      <FileCheck2 className="w-4 h-4 text-emerald-600" />
                      <span>Setup & Material Audit</span>
                    </div>
                    <p className="text-gray-600">
                      Verify presence of: Presiding Officer, Security Agents, BVAS unit, Ballot Box, EC8A Result Sheets, and Voter Register.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'reporting' && (
            <motion.div
              key="reporting"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-3 text-emerald-700 font-bold text-sm border-b border-emerald-100 pb-2">
                <FileCheck2 className="w-5 h-5" />
                <span>Field Data Collection & Proof Transmission</span>
              </div>

              <div className="grid sm:grid-cols-3 gap-3 text-xs">
                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 space-y-2">
                  <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black">1</span>
                    <span>Accreditation Phase</span>
                  </div>
                  <p className="text-emerald-900/80 leading-relaxed">
                    Monitor BVAS biometric verification speed. Log voter turnout figures, queue lengths, and any device malfunctions.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-2">
                  <div className="font-bold text-amber-950 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px] font-black">2</span>
                    <span>Incident Alerts</span>
                  </div>
                  <p className="text-amber-900/80 leading-relaxed">
                    Immediately flag vote buying, violence, ballot box tampering, or voter intimidation with geotagged media proof.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/80 space-y-2">
                  <div className="font-bold text-blue-950 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black">3</span>
                    <span>Result Tallying</span>
                  </div>
                  <p className="text-blue-900/80 leading-relaxed">
                    Photograph signed EC8A result sheets clearly. Cross-check hardcopy figures against BVAS digital IReV transmissions.
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-900 text-white rounded-2xl flex items-center gap-3 text-xs">
                <Camera className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>
                  <strong>Media Standard:</strong> Photos must clearly capture polling unit codes and EC8A signatures. Video uploads are hashed for tamper-proof verification.
                </span>
              </div>
            </motion.div>
          )}

          {activeTab === 'security' && (
            <motion.div
              key="security"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-3 text-emerald-700 font-bold text-sm border-b border-emerald-100 pb-2">
                <Shield className="w-5 h-5" />
                <span>Safety First & Emergency Protocol</span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-2 text-rose-950">
                  <div className="flex items-center gap-2 font-black text-rose-700">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Personal Safety Paramount Rule</span>
                  </div>
                  <p className="text-rose-900 text-[11px] leading-relaxed">
                    Your personal physical safety supersedes any report or photo. If violent conflict, armed disruption, or mob action erupts, immediately withdraw to a safe distance before filing a Critical Incident Report or triggering the Emergency SOS button.
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                    <p className="font-bold text-slate-900">Red Line Rule 1</p>
                    <p className="text-gray-600">Never argue with security personnel or hostile political party agents.</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                    <p className="font-bold text-slate-900">Red Line Rule 2</p>
                    <p className="text-gray-600">Keep supervisor phone contacts and local emergency lines on speed dial.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Required Observer Pledges Checklist */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 rounded-2xl space-y-4 border border-slate-800">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold flex items-center gap-2 text-emerald-400">
              <BookOpen className="w-4 h-4" />
              Observer Affirmation & Pledges (Required)
            </h3>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-slate-800 rounded-md text-emerald-300">
              {Object.values(pledges).filter(Boolean).length} of 4 Accepted
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <label 
              onClick={() => togglePledge('neutrality')}
              className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                pledges.neutrality 
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200' 
                  : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:border-slate-600'
              }`}
            >
              <div className={`w-4 h-4 rounded border mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                pledges.neutrality ? 'bg-emerald-500 border-emerald-400 text-slate-950' : 'border-slate-500'
              }`}>
                {pledges.neutrality && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
              <div>
                <p className="font-bold text-white">Strict Neutrality</p>
                <p className="text-[11px] opacity-80 mt-0.5">I pledge non-partisan conduct and zero political bias.</p>
              </div>
            </label>

            <label 
              onClick={() => togglePledge('punctuality')}
              className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                pledges.punctuality 
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200' 
                  : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:border-slate-600'
              }`}
            >
              <div className={`w-4 h-4 rounded border mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                pledges.punctuality ? 'bg-emerald-500 border-emerald-400 text-slate-950' : 'border-slate-500'
              }`}>
                {pledges.punctuality && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
              <div>
                <p className="font-bold text-white">Punctual Check-In</p>
                <p className="text-[11px] opacity-80 mt-0.5">I will report at my polling unit by 07:30 AM and log GPS check-in.</p>
              </div>
            </label>

            <label 
              onClick={() => togglePledge('accuracy')}
              className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                pledges.accuracy 
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200' 
                  : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:border-slate-600'
              }`}
            >
              <div className={`w-4 h-4 rounded border mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                pledges.accuracy ? 'bg-emerald-500 border-emerald-400 text-slate-950' : 'border-slate-500'
              }`}>
                {pledges.accuracy && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
              <div>
                <p className="font-bold text-white">Verified Data Transmission</p>
                <p className="text-[11px] opacity-80 mt-0.5">I will transmit unedited, verified result counts and photo proof.</p>
              </div>
            </label>

            <label 
              onClick={() => togglePledge('security')}
              className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                pledges.security 
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200' 
                  : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:border-slate-600'
              }`}
            >
              <div className={`w-4 h-4 rounded border mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                pledges.security ? 'bg-emerald-500 border-emerald-400 text-slate-950' : 'border-slate-500'
              }`}>
                {pledges.security && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
              <div>
                <p className="font-bold text-white">Security Awareness</p>
                <p className="text-[11px] opacity-80 mt-0.5">I will prioritize personal safety and escalate threat alerts.</p>
              </div>
            </label>
          </div>
        </div>

        {/* Action Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Lock className="w-4 h-4 text-emerald-600" />
            <span>Accepting unlocks full field accreditation & report creation.</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {!isMandatory && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="w-full sm:w-auto px-5 py-3 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Dismiss
              </button>
            )}

            <button
              type="button"
              disabled={!allPledgesChecked || isSubmitting}
              onClick={handleAcknowledge}
              className={`w-full sm:w-auto px-6 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                allPledgesChecked && !isSubmitting
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 active:scale-95'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
              }`}
            >
              {isSubmitting ? (
                <>Recording Acknowledgment...</>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Acknowledge & Unlock Reporting Tools</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
