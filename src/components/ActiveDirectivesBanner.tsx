import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, limit, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import type { Notification } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Radio, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink, 
  ChevronRight, 
  ChevronLeft, 
  X, 
  ShieldAlert, 
  Megaphone,
  BellRing,
  Info
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

const LOCAL_ACK_KEY = 'acknowledged_directives_v1';

function getLocalAckIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_ACK_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function saveLocalAckId(id: string) {
  try {
    const set = getLocalAckIds();
    set.add(id);
    localStorage.setItem(LOCAL_ACK_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // Ignore storage quota
  }
}

export default function ActiveDirectivesBanner() {
  const { user, isAdmin, isSupervisor } = useAuth();
  const [activeDirectives, setActiveDirectives] = useState<Notification[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expandedDirective, setExpandedDirective] = useState<Notification | null>(null);
  const [ackIds, setAckIds] = useState<Set<string>>(() => getLocalAckIds());

  useEffect(() => {
    if (!user) return;

    const roles: string[] = [user.uid, 'all'];
    if (isAdmin) roles.push('admin');
    if (isSupervisor) {
      roles.push('supervisor');
      roles.push('field_supervisor');
    }
    roles.push('observer');

    const q = query(
      collection(db, 'notifications'),
      where('userId', 'in', roles),
      orderBy('timestamp', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      
      // Filter for directives & updates that are not yet acknowledged by this user
      const unackDirectives = docs.filter(d => {
        const isDirectiveOrUpdate = 
          d.type === 'urgent_directive' || 
          d.type === 'admin_update' || 
          d.type === 'warning' ||
          d.category === 'directive' || 
          d.category === 'update';
        
        const isAckByFirestore = d.acknowledgedBy && d.acknowledgedBy.includes(user.uid);
        const isAckLocally = ackIds.has(d.id);

        return isDirectiveOrUpdate && !isAckByFirestore && !isAckLocally;
      });

      setActiveDirectives(unackDirectives);
      if (currentIndex >= unackDirectives.length) {
        setCurrentIndex(Math.max(0, unackDirectives.length - 1));
      }
    }, (error) => {
      console.warn('Active directives banner listener error:', error);
    });

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'ACKNOWLEDGE_LATEST_DIRECTIVE' && activeDirectives.length > 0) {
        handleAcknowledge(activeDirectives[0].id);
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }

    return () => {
      unsubscribe();
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, [user, isAdmin, isSupervisor, ackIds, activeDirectives]);

  const handleAcknowledge = async (directiveId: string) => {
    saveLocalAckId(directiveId);
    setAckIds(new Set([...ackIds, directiveId]));
    setActiveDirectives(prev => prev.filter(d => d.id !== directiveId));

    if (expandedDirective?.id === directiveId) {
      setExpandedDirective(null);
    }

    // Attempt to register acknowledgment on Firestore without failing if offline
    try {
      if (user) {
        await updateDoc(doc(db, 'notifications', directiveId), {
          acknowledgedBy: arrayUnion(user.uid)
        });
      }
    } catch {
      // Offline fallback already handled via local storage
    }
  };

  if (activeDirectives.length === 0) return null;

  const current = activeDirectives[currentIndex] || activeDirectives[0];
  const isUrgent = current.type === 'urgent_directive' || current.priority === 'urgent' || current.priority === 'critical';

  return (
    <>
      {/* Top Banner Alert Bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={`w-full rounded-3xl p-4 sm:p-5 shadow-xl border transition-all ${
          isUrgent 
            ? 'bg-gradient-to-r from-red-950 via-red-900 to-slate-950 text-white border-red-500/80 shadow-red-950/20' 
            : 'bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white border-emerald-500/50 shadow-slate-950/20'
        }`}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5 flex-1">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
              isUrgent 
                ? 'bg-red-600/30 border-red-400 text-red-300 animate-pulse' 
                : 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
            }`}>
              {isUrgent ? <ShieldAlert className="w-5 h-5" /> : <Megaphone className="w-5 h-5" />}
            </div>

            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest rounded-md ${
                  isUrgent ? 'bg-red-600 text-white' : 'bg-emerald-500 text-slate-950'
                }`}>
                  {isUrgent ? '🚨 URGENT HQ DIRECTIVE' : '📢 OFFICIAL UPDATE'}
                </span>
                {current.senderName && (
                  <span className="text-[11px] text-gray-300 font-medium">
                    From: <strong className="text-white">{current.senderName}</strong> ({current.senderRole || 'HQ Command'})
                  </span>
                )}
                <span className="text-[10px] text-gray-400 font-mono">
                  {current.timestamp instanceof Object ? formatDistanceToNow((current.timestamp as any).toDate(), { addSuffix: true }) : 'Live'}
                </span>
              </div>

              <h4 className="text-base sm:text-lg font-bold font-serif text-white leading-tight">
                {current.title}
              </h4>
              <p className="text-xs sm:text-sm text-gray-300 line-clamp-1 font-medium">
                {current.message}
              </p>
            </div>
          </div>

          {/* Action & Pagination Controls */}
          <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/10">
            {activeDirectives.length > 1 && (
              <div className="flex items-center gap-1 mr-2 text-xs text-gray-400 font-mono">
                <button
                  onClick={() => setCurrentIndex((prev) => (prev > 0 ? prev - 1 : activeDirectives.length - 1))}
                  className="p-1 hover:text-white rounded transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span>{currentIndex + 1}/{activeDirectives.length}</span>
                <button
                  onClick={() => setCurrentIndex((prev) => (prev < activeDirectives.length - 1 ? prev + 1 : 0))}
                  className="p-1 hover:text-white rounded transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              onClick={() => setExpandedDirective(current)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              Read Full Directive <ExternalLink className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => handleAcknowledge(current.id)}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledge
            </button>
          </div>
        </div>
      </motion.div>

      {/* Expanded Directive Modal */}
      <AnimatePresence>
        {expandedDirective && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-2xl bg-white rounded-[32px] shadow-2xl border border-gray-100 overflow-hidden"
            >
              {/* Header */}
              <div className={`p-6 sm:p-8 text-white flex items-start justify-between gap-4 ${
                expandedDirective.type === 'urgent_directive' || expandedDirective.priority === 'urgent'
                  ? 'bg-gradient-to-r from-red-950 via-red-900 to-gray-950 border-b-2 border-red-500'
                  : 'bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 border-b-2 border-emerald-500'
              }`}>
                <div className="space-y-2">
                  <span className="px-3 py-1 bg-white/20 text-white text-[10px] font-extrabold uppercase tracking-widest rounded-lg border border-white/20">
                    Official Election Memo
                  </span>
                  <h3 className="text-2xl font-bold font-serif text-white">
                    {expandedDirective.title}
                  </h3>
                  <div className="text-xs text-gray-300 flex items-center gap-2 flex-wrap">
                    <span>From: <strong>{expandedDirective.senderName || 'HQ Command'}</strong> ({expandedDirective.senderRole || 'Admin'})</span>
                    <span>•</span>
                    <span>Target: {expandedDirective.targetRole?.toUpperCase() || 'ALL'} ({expandedDirective.targetState || 'National'})</span>
                  </div>
                </div>

                <button
                  onClick={() => setExpandedDirective(null)}
                  className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 sm:p-8 space-y-6">
                <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200/80 text-gray-800 text-sm leading-relaxed font-medium whitespace-pre-wrap">
                  {expandedDirective.message}
                </div>

                {expandedDirective.link && (
                  <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Required Action Destination</p>
                      <p className="text-xs text-emerald-700">Proceed to the recommended module to comply with this directive.</p>
                    </div>
                    <Link
                      to={expandedDirective.link}
                      onClick={() => setExpandedDirective(null)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                    >
                      Open Module <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                )}

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <button
                    onClick={() => setExpandedDirective(null)}
                    className="px-5 py-2.5 text-gray-500 hover:text-gray-900 font-bold text-xs"
                  >
                    Close Window
                  </button>

                  <button
                    onClick={() => handleAcknowledge(expandedDirective.id)}
                    className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-2xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Confirm Acknowledgment & Dismiss
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
