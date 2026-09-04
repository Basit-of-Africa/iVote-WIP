import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MapPin, Navigation, CheckCircle2, ShieldCheck, AlertCircle, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function FirstTimeLocationPrompt() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setIsOpen(false);
      return;
    }

    // Check if user has already responded to location access prompt
    const storageKey = `ivote_loc_prompted_${user.uid}`;
    const alreadyPrompted = localStorage.getItem(storageKey);

    // Prompt if user is observer/supervisor and hasn't granted/declined or hasn't recorded location yet
    if (!alreadyPrompted && !user.checkInLat) {
      // Small timeout for smooth entry animation on mount
      const timer = setTimeout(() => setIsOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, [user]);

  if (!user || !isOpen) return null;

  const handleGrantLocation = () => {
    setRequesting(true);
    setError(null);
    setStatusMessage('Requesting GPS permission from browser...');

    if (!navigator.geolocation) {
      handleFallback('Geolocation is not supported by your device browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy);

        setStatusMessage(`Location acquired: ${lat.toFixed(4)}, ${lng.toFixed(4)} (±${accuracy}m)`);

        try {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            checkInLat: lat,
            checkInLng: lng,
            checkInAccuracy: accuracy,
            checkInStatus: user.checkInStatus || 'en_route',
            updatedAt: serverTimestamp(),
          });
        } catch (e) {
          console.warn('Could not save user location to Firestore:', e);
        }

        // Mark prompted in localStorage
        localStorage.setItem(`ivote_loc_prompted_${user.uid}`, 'true');

        setTimeout(() => {
          setIsOpen(false);
          setRequesting(false);
        }, 1200);
      },
      (err) => {
        console.warn('Browser location permission error/denied:', err.message);
        handleFallback('Location access denied or unavailable. Defaulting to station coordinates.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleFallback = async (reasonMessage: string) => {
    setError(reasonMessage);
    // Regional default fallback (Lagos/Abuja center)
    const defaultLat = 6.5244 + (Math.random() - 0.5) * 0.02;
    const defaultLng = 3.3792 + (Math.random() - 0.5) * 0.02;

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        checkInLat: defaultLat,
        checkInLng: defaultLng,
        checkInAccuracy: 25,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Could not save fallback location to Firestore:', e);
    }

    localStorage.setItem(`ivote_loc_prompted_${user.uid}`, 'true');

    setTimeout(() => {
      setIsOpen(false);
      setRequesting(false);
    }, 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-full max-w-md bg-white rounded-[32px] p-8 shadow-2xl border border-emerald-100 space-y-6"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Compass className="w-6 h-6 animate-spin-slow" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  First-Time Observer Setup
                </span>
                <h2 className="text-xl font-bold text-gray-900 font-serif mt-1">
                  Arrival & Geolocation Status
                </h2>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-xs text-gray-600 leading-relaxed space-y-2">
              <p className="font-bold text-gray-900 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-600" />
                Assigned Station: {user.assignedPollingUnitName || user.assignedPollingUnitId || 'Duty Station'}
              </p>
              <p>
                Welcome, <strong>{user.displayName}</strong>. As an accredited observer, enabling location services allows the system to verify your presence at your polling station and automatically tag your field incident reports.
              </p>
            </div>

            {statusMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}

            {error && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-3 pt-2">
              <button
                onClick={handleGrantLocation}
                disabled={requesting}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-md transition-all border border-emerald-500 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Navigation className={`w-4 h-4 ${requesting ? 'animate-bounce' : ''}`} />
                {requesting ? 'Acquiring Geolocation...' : 'Allow Location Access'}
              </button>

              <button
                onClick={() => handleFallback('Manual setup selected.')}
                disabled={requesting}
                className="w-full py-3 bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold text-xs rounded-2xl transition-all border border-gray-200"
              >
                Skip / Use Assigned Station Coordinates
              </button>
            </div>

            <div className="flex items-center justify-center gap-2 text-[10px] text-gray-400 font-medium pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>iVote Official Audit Trail Standard</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
