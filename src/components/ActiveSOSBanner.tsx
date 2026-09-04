import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, orderBy, onSnapshot, limit, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Incident } from '../types';
import { Siren, ShieldAlert, CheckCircle2, Phone, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

export default function ActiveSOSBanner() {
  const { user, isAdmin, isSupervisor } = useAuth();
  const [activeUserSos, setActiveUserSos] = useState<any | null>(null);
  const [recentCriticalIncidents, setRecentCriticalIncidents] = useState<Incident[]>([]);
  const [isDismissed, setIsDismissed] = useState(false);

  // Check localStorage for current user's local active SOS
  useEffect(() => {
    if (!user) return;

    const checkLocalSos = () => {
      try {
        const raw = localStorage.getItem(`ivote_active_sos_${user.uid}`);
        if (raw) {
          setActiveUserSos(JSON.parse(raw));
        } else {
          setActiveUserSos(null);
        }
      } catch (e) {
        setActiveUserSos(null);
      }
    };

    checkLocalSos();
    window.addEventListener('ivote_sos_updated', checkLocalSos);
    return () => window.removeEventListener('ivote_sos_updated', checkLocalSos);
  }, [user]);

  // Listen to Firestore critical incidents in real-time
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'incidents'),
      where('severity', '==', 'critical'),
      where('status', '==', 'pending'),
      orderBy('timestamp', 'desc'),
      limit(3)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Incident));
      setRecentCriticalIncidents(docs);
    }, (err) => {
      console.warn('Realtime critical incidents listener error:', err);
    });

    return () => unsubscribe();
  }, [user]);

  const handleResolveMySos = async () => {
    if (!user || !activeUserSos) return;
    try {
      if (activeUserSos.incidentId) {
        await updateDoc(doc(db, 'incidents', activeUserSos.incidentId), {
          status: 'resolved',
          resolutionNotes: 'Marked safe by reporting observer.'
        });
      }
      localStorage.removeItem(`ivote_active_sos_${user.uid}`);
      setActiveUserSos(null);
      window.dispatchEvent(new Event('ivote_sos_updated'));
      toast.success('SOS Alert marked resolved and canceled.');
    } catch (e) {
      localStorage.removeItem(`ivote_active_sos_${user.uid}`);
      setActiveUserSos(null);
      window.dispatchEvent(new Event('ivote_sos_updated'));
    }
  };

  if (isDismissed) return null;

  // Render User's Own Active SOS Banner
  if (activeUserSos) {
    return (
      <div className="bg-gradient-to-r from-red-950 via-red-900 to-red-950 border-b border-red-700 text-white p-3 sm:px-6 shadow-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-600/40 border border-red-400 flex items-center justify-center shrink-0 text-red-400 animate-ping">
              <Siren className="w-4 h-4" />
            </div>
            <div>
              <p className="font-extrabold uppercase text-[11px] text-red-300 tracking-wider flex items-center gap-2">
                <span>🚨 YOUR DANGER SOS IS ACTIVE</span>
                <span className="bg-red-600 text-white text-[9px] px-2 py-0.5 rounded-full font-bold">
                  BROADCASTING
                </span>
              </p>
              <p className="text-gray-200 font-medium mt-0.5">
                {activeUserSos.category} reported at <strong>{activeUserSos.puName || activeUserSos.puId}</strong>. Control room & nearby observers alerted.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleResolveMySos}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              I Am Safe (Cancel SOS)
            </button>
            <a
              href="tel:112"
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl flex items-center gap-1.5 transition-all border border-white/20"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              Call 112
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Render System-Wide Critical SOS Banner (for Admins, Supervisors, and Observers)
  if (recentCriticalIncidents.length > 0) {
    const latestIncident = recentCriticalIncidents[0];
    return (
      <div className="bg-gradient-to-r from-red-900 via-rose-950 to-red-950 border-b border-red-600 text-white p-3 sm:px-6 shadow-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-600/50 border border-red-400 flex items-center justify-center shrink-0 text-white animate-pulse">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-red-600 text-white font-black text-[9px] uppercase px-2 py-0.5 rounded">
                  CRITICAL EMERGENCY SOS
                </span>
                <span className="font-mono text-red-200 font-bold">
                  PU: {latestIncident.pollingUnitId}
                </span>
              </div>
              <p className="text-white font-semibold mt-0.5 line-clamp-1">
                {latestIncident.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              to={`/incidents/${latestIncident.id}`}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl flex items-center gap-1 transition-all shadow-md"
            >
              Inspect Alert <ChevronRight className="w-3.5 h-3.5" />
            </Link>
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
