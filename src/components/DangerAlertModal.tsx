import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { 
  AlertOctagon, 
  ShieldAlert, 
  MapPin, 
  Phone, 
  X, 
  Send, 
  Radio, 
  CheckCircle2, 
  Flame, 
  Skull, 
  Siren,
  Loader2,
  AlertTriangle,
  Compass
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { triggerSystemPushNotification } from '../lib/fcm';

interface DangerAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DANGER_CATEGORIES = [
  { 
    id: 'violence', 
    label: 'Physical Violence & Riot', 
    icon: Flame, 
    color: 'from-red-600 to-rose-700',
    desc: 'Mob attack, physical assault, rioting at polling station' 
  },
  { 
    id: 'ballot_theft', 
    label: 'Ballot Box Snatching', 
    icon: ShieldAlert, 
    color: 'from-amber-600 to-red-600',
    desc: 'Thugs or armed men seizing ballot boxes or result sheets' 
  },
  { 
    id: 'armed_threat', 
    label: 'Armed Intimidation & Weapons', 
    icon: Skull, 
    color: 'from-purple-700 to-red-700',
    desc: 'Guns, dangerous weapons, or explicit lethal threats' 
  },
  { 
    id: 'teargas_shooting', 
    label: 'Gunshots / Teargas / Explosions', 
    icon: Siren, 
    color: 'from-red-700 to-black',
    desc: 'Active shooting, teargas canister launch, or blast' 
  },
  { 
    id: 'bvas_seizure', 
    label: 'BVAS Seizure / Sabotage', 
    icon: AlertOctagon, 
    color: 'from-orange-600 to-red-600',
    desc: 'Accreditation device forcefully destroyed or confiscated' 
  },
  { 
    id: 'medical', 
    label: 'Medical Emergency / Injury', 
    icon: AlertTriangle, 
    color: 'from-rose-600 to-red-800',
    desc: 'Observer, voter, or official collapsed or severe bodily injury' 
  },
];

// Helper to play browser siren tone
const playEmergencySiren = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sawtooth';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.linearRampToValueAtTime(1200, now + 0.3);
    osc.frequency.linearRampToValueAtTime(600, now + 0.6);
    osc.frequency.linearRampToValueAtTime(1200, now + 0.9);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 1.0);
  } catch (e) {
    console.warn('Audio play restricted:', e);
  }
};

export default function DangerAlertModal({ isOpen, onClose }: DangerAlertModalProps) {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>('violence');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [sosDispatched, setSosDispatched] = useState(false);
  const [dispatchedIncidentId, setDispatchedIncidentId] = useState<string | null>(null);

  // Fetch location automatically when modal opens
  const fetchLocation = (): Promise<{ lat: number; lng: number; accuracy: number }> => {
    setGettingLocation(true);
    return new Promise((resolve) => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const freshCoords = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: Math.round(pos.coords.accuracy)
            };
            setCoords(freshCoords);
            setGettingLocation(false);
            resolve(freshCoords);
          },
          (err) => {
            console.warn('Geolocation fallback:', err.message);
            const fallback = {
              lat: user?.checkInLat || 6.5244,
              lng: user?.checkInLng || 3.3792,
              accuracy: user?.checkInAccuracy || 20
            };
            setCoords(fallback);
            setGettingLocation(false);
            resolve(fallback);
          },
          { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
        );
      } else {
        const fallback = {
          lat: user?.checkInLat || 6.5244,
          lng: user?.checkInLng || 3.3792,
          accuracy: 25
        };
        setCoords(fallback);
        setGettingLocation(false);
        resolve(fallback);
      }
    });
  };

  useEffect(() => {
    if (isOpen) {
      fetchLocation();
    } else {
      setSosDispatched(false);
      setSubmitting(false);
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const currentCategoryObj = DANGER_CATEGORIES.find(c => c.id === selectedCategory) || DANGER_CATEGORIES[0];

  const handleSendDangerAlert = async () => {
    if (!user) return;
    setSubmitting(true);
    playEmergencySiren();

    // Capture latest fresh geolocation immediately on press
    let currentCoords = coords;
    if (!currentCoords || gettingLocation) {
      currentCoords = await fetchLocation();
    }

    const lat = currentCoords?.lat || user?.checkInLat || 6.5244;
    const lng = currentCoords?.lng || user?.checkInLng || 3.3792;
    const accuracy = currentCoords?.accuracy || 20;
    const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
    const puId = user.assignedPollingUnitId || 'PU-FIELD';
    const puName = user.assignedPollingUnitName || 'Field Location';
    const timestampISO = new Date().toISOString();

    const fullDescription = `🚨 [EMERGENCY SOS: ${currentCategoryObj.label.toUpperCase()}] at ${puName} (PU: ${puId}), LGA: ${user.lga || 'Local Council'}, State: ${user.state || 'Osun'}. GPS: ${lat.toFixed(5)}°, ${lng.toFixed(5)}° (±${accuracy}m). Map: ${mapsUrl}. ${notes ? 'Incident Nature: ' + notes : 'Immediate security & emergency response required!'}`;

    try {
      // 1. Save critical report with full geolocation (Identity protected)
      const reportRef = await addDoc(collection(db, 'reports'), {
        pollingUnitId: puId,
        observerId: user.uid,
        timestamp: timestampISO,
        type: 'incident',
        payload: {
          incidentType: currentCategoryObj.id,
          categoryLabel: currentCategoryObj.label,
          description: fullDescription,
          severity: 'critical',
          isSos: true,
          state: user.state || 'Osun',
          lga: user.lga || 'Local Council',
          notes: notes,
          gpsLocation: { lat, lng, accuracy },
          mapsUrl
        },
        location: { lat, lng }
      });

      // 2. Save critical incident with geolocation
      const incidentRef = await addDoc(collection(db, 'incidents'), {
        reportId: reportRef.id,
        pollingUnitId: puId,
        severity: 'critical',
        status: 'pending',
        description: fullDescription,
        location: { lat, lng, accuracy },
        mapsUrl,
        timestamp: serverTimestamp()
      });

      // 3. Dispatch high-priority notifications (without leaking personal credentials in summary)
      const notifData = {
        title: `🚨 EMERGENCY SOS: ${currentCategoryObj.label}`,
        message: `SOS flagged for ${currentCategoryObj.label} at ${puName} (${puId}), LGA: ${user.lga || 'Local Council'} [GPS: ${lat.toFixed(4)}°, ${lng.toFixed(4)}°]. Immediate response dispatched.`,
        type: 'error',
        read: false,
        link: `/incidents/${incidentRef.id}`,
        mapsUrl,
        timestamp: serverTimestamp()
      };

      // Send to admin, supervisor, and observer role channels
      await Promise.all([
        addDoc(collection(db, 'notifications'), { ...notifData, userId: 'admin' }),
        addDoc(collection(db, 'notifications'), { ...notifData, userId: 'supervisor' }),
        addDoc(collection(db, 'notifications'), { ...notifData, userId: 'observer' }),
      ]);

      // Trigger system level push notification (runs background OS notification if supported)
      triggerSystemPushNotification({
        title: `🚨 EMERGENCY SOS: ${currentCategoryObj.label}`,
        body: `${user.displayName} at ${puName} (${puId}) [GPS: ${lat.toFixed(4)}°, ${lng.toFixed(4)}°]. Immediate response needed!`,
        link: `/incidents/${incidentRef.id}`,
        isSosAlert: true
      });

      // 4. Save active SOS status in localStorage so app displays persistent emergency banner
      const activeSosPayload = {
        incidentId: incidentRef.id,
        category: currentCategoryObj.label,
        puId,
        puName,
        timestamp: timestampISO,
        notes,
        lat,
        lng,
        accuracy,
        mapsUrl
      };
      localStorage.setItem(`ivote_active_sos_${user.uid}`, JSON.stringify(activeSosPayload));
      window.dispatchEvent(new Event('ivote_sos_updated'));

      setDispatchedIncidentId(incidentRef.id);
      setSosDispatched(true);
      setSubmitting(false);

      toast.error('🚨 EMERGENCY SOS & GPS BROADCASTED TO CONTROL ROOM!', {
        description: `Live coordinates (${lat.toFixed(4)}°, ${lng.toFixed(4)}°) attached to distress signal.`,
        duration: 10000,
      });

    } catch (err) {
      console.error('Failed to submit danger alert:', err);
      handleFirestoreError(err, OperationType.WRITE, 'incidents');
      setSubmitting(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-xl my-auto bg-gradient-to-b from-gray-900 via-slate-950 to-black text-white rounded-3xl border-2 border-red-600/80 shadow-[0_0_50px_rgba(220,38,38,0.5)] overflow-hidden"
        >
          {/* Header Bar */}
          <div className="p-6 bg-gradient-to-r from-red-950 via-red-900 to-red-950 border-b border-red-800/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-600/30 border border-red-500/50 flex items-center justify-center text-red-400 animate-pulse">
                <Siren className="w-7 h-7" />
              </div>
              <div>
                <span className="px-2.5 py-0.5 bg-red-600 text-white font-extrabold text-[10px] uppercase tracking-widest rounded-md">
                  PANIC ALERT / SOS
                </span>
                <h3 className="text-xl font-extrabold text-white font-serif tracking-tight mt-0.5">
                  Report Immediate Danger
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {!sosDispatched ? (
            <div className="p-6 space-y-6">
              {/* Context Banner */}
              <div className="p-4 rounded-2xl bg-red-950/40 border border-red-800/40 flex items-start gap-3 text-red-200 text-xs">
                <AlertOctagon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Pressing this button will <strong>instantly broadcast an urgent high-priority alert</strong> with your GPS coordinates and Polling Unit info to Admin HQ, Security Dispatch, and nearby Field Observers.
                </p>
              </div>

              {/* Station & Location Status */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <p className="text-gray-400 uppercase font-semibold text-[10px] tracking-wider">Target Polling Station</p>
                  <p className="text-sm font-bold text-white mt-0.5">
                    {user?.assignedPollingUnitName || 'Field Operations Station'}
                  </p>
                  <p className="text-red-400 font-mono text-[11px] font-bold">
                    ID: {user?.assignedPollingUnitId || 'PU-FIELD'}
                  </p>
                </div>
                <div className="flex items-center gap-2 bg-black/40 px-3 py-2 rounded-xl border border-white/10">
                  <Compass className={`w-4 h-4 ${gettingLocation ? 'text-amber-400 animate-spin' : 'text-emerald-400'}`} />
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-mono">GPS Location</p>
                    <p className="text-xs font-mono font-bold text-white">
                      {gettingLocation ? 'Acquiring GPS...' : `${coords?.lat.toFixed(4)}°, ${coords?.lng.toFixed(4)}° (±${coords?.accuracy}m)`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Danger Category Select */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-300">
                  Select Danger Type
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                  {DANGER_CATEGORIES.map((cat) => {
                    const isSelected = selectedCategory === cat.id;
                    const IconComp = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`p-3 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                          isSelected
                            ? 'bg-red-600/30 border-red-500 text-white shadow-lg shadow-red-900/30'
                            : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className={`p-2 rounded-xl shrink-0 ${isSelected ? 'bg-red-600 text-white' : 'bg-white/10 text-red-400'}`}>
                          <IconComp className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate">{cat.label}</p>
                          <p className="text-[10px] text-gray-400 line-clamp-2 mt-0.5">{cat.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Additional Quick Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-300">
                  Emergency Situation Details <span className="text-gray-500 font-normal">(Optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. 5 armed thugs stormed ward 2, security officers retreat needed immediately..."
                  rows={2}
                  className="w-full px-4 py-3 bg-black/50 border border-white/15 rounded-2xl text-white placeholder-gray-500 text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              {/* Direct Emergency Dispatch Helplines */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 text-[11px] text-gray-400">
                <span className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  National Election Emergency Hotline: <strong className="text-white font-mono">112 / 0800-ELECTION-SOS</strong>
                </span>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col gap-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSendDangerAlert}
                  className="w-full py-4 px-6 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-black text-sm uppercase tracking-wider rounded-2xl shadow-xl shadow-red-900/50 flex items-center justify-center gap-3 transition-all active:scale-[0.98] border border-red-400/50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-white" />
                      Broadcasting Emergency SOS...
                    </>
                  ) : (
                    <>
                      <Radio className="w-5 h-5 animate-pulse text-white" />
                      DISPATCH EMERGENCY DANGER SOS NOW
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 text-xs text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* SOS Dispatched Success Screen */
            <div className="p-8 text-center space-y-6">
              <div className="w-20 h-20 mx-auto rounded-full bg-red-600/30 border-2 border-red-500 flex items-center justify-center text-red-500 animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h4 className="text-2xl font-black text-white font-serif">
                  DANGER ALERT BROADCASTED!
                </h4>
                <p className="text-xs text-red-200 max-w-md mx-auto">
                  Your SOS signal has been sent with high-priority status to <strong>Admin Control Room</strong>, <strong>Supervisors</strong>, and <strong>Nearby Observers</strong>.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-left text-xs space-y-2">
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <span className="text-gray-400">Danger Type:</span>
                  <span className="font-bold text-red-400">{currentCategoryObj.label}</span>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <span className="text-gray-400">Polling Unit:</span>
                  <span className="font-bold text-white">{user?.assignedPollingUnitName || 'Field'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">GPS Coordinates:</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {coords?.lat.toFixed(4)}, {coords?.lng.toFixed(4)}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                >
                  Close & Keep Active SOS
                </button>
                {dispatchedIncidentId && (
                  <a
                    href={`/incidents/${dispatchedIncidentId}`}
                    onClick={onClose}
                    className="flex-1 py-3 px-4 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all border border-white/20"
                  >
                    View Incident Feed
                  </a>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
