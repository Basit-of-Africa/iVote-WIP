import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, limit, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import type { Notification } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Radio, 
  Megaphone, 
  ShieldAlert, 
  CheckCircle2, 
  ExternalLink, 
  Clock, 
  Users, 
  Send,
  Sparkles,
  ChevronRight,
  Info
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

interface HQDirectivesFeedProps {
  onOpenBroadcastModal?: () => void;
}

export default function HQDirectivesFeed({ onOpenBroadcastModal }: HQDirectivesFeedProps) {
  const { user, isAdmin, isSupervisor } = useAuth();
  const [directives, setDirectives] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'urgent' | 'updates'>('all');

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
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      const directiveDocs = docs.filter(d => 
        d.type === 'urgent_directive' || 
        d.type === 'admin_update' || 
        d.category === 'directive' || 
        d.category === 'update' ||
        d.type === 'warning' ||
        Boolean(d.senderName)
      );
      setDirectives(directiveDocs);
      setLoading(false);
    }, (error) => {
      console.warn('Directives feed listener error:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, isAdmin, isSupervisor]);

  const handleAcknowledge = async (id: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'notifications', id), {
        acknowledgedBy: arrayUnion(user.uid),
        read: true
      });
    } catch {
      // Best-effort acknowledgment
    }
  };

  const filteredDirectives = directives.filter(d => {
    if (filter === 'urgent') return d.type === 'urgent_directive' || d.priority === 'urgent' || d.priority === 'critical';
    if (filter === 'updates') return d.type === 'admin_update' || d.category === 'update';
    return true;
  });

  return (
    <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 sm:p-8 border-b border-gray-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                Official Directive Channel
              </span>
              <span className="text-xs text-gray-400 font-medium">In-App Administrative Telemetry</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold font-serif text-white mt-0.5">
              HQ Command Directives & Updates
            </h3>
          </div>
        </div>

        {/* Action Button for Admins & Supervisors */}
        {(isAdmin || isSupervisor) && onOpenBroadcastModal && (
          <button
            onClick={onOpenBroadcastModal}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all hover:-translate-y-0.5 cursor-pointer shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Transmit New Directive</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between px-6 sm:px-8 py-3 bg-gray-50/70 border-b border-gray-100 text-xs">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
              filter === 'all' ? 'bg-white text-gray-900 shadow-xs border border-gray-200/60' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            All Communications ({directives.length})
          </button>
          <button
            onClick={() => setFilter('urgent')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
              filter === 'urgent' ? 'bg-white text-red-700 shadow-xs border border-gray-200/60' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Urgent Directives
          </button>
          <button
            onClick={() => setFilter('updates')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
              filter === 'updates' ? 'bg-white text-blue-700 shadow-xs border border-gray-200/60' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Administrative Memos
          </button>
        </div>

        <span className="text-[11px] text-gray-400 font-mono hidden md:inline-block">
          Direct sync with Election Operations Command
        </span>
      </div>

      {/* Feed List */}
      <div className="p-6 sm:p-8">
        {loading ? (
          <div className="py-12 text-center text-gray-400 font-medium">
            Loading active command directives...
          </div>
        ) : filteredDirectives.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-gray-900 text-base font-serif">
              All Standard Protocols Active
            </h4>
            <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
              No special emergency directives or schedule modifications in effect for your polling area. Continue standard observation workflows.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredDirectives.map((d) => {
              const isUrgent = d.type === 'urgent_directive' || d.priority === 'urgent' || d.priority === 'critical';
              const isAck = (d.acknowledgedBy && user && d.acknowledgedBy.includes(user.uid)) || d.read;

              return (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-6 rounded-2xl border transition-all ${
                    isUrgent 
                      ? 'bg-red-50/30 border-red-200 hover:border-red-300' 
                      : 'bg-slate-50/50 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-md border ${
                          isUrgent ? 'bg-red-600 text-white border-red-600' :
                          d.type === 'admin_update' ? 'bg-blue-600 text-white border-blue-600' :
                          'bg-emerald-600 text-white border-emerald-600'
                        }`}>
                          {isUrgent ? '🚨 URGENT DIRECTIVE' : d.type === 'admin_update' ? '📢 ADMIN MEMO' : 'ℹ️ ADVISORY'}
                        </span>

                        <span className="text-[11px] font-bold text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-md">
                          Scope: {d.targetRole ? d.targetRole.toUpperCase() : 'ALL PERSONNEL'} ({d.targetState || 'National'})
                        </span>

                        <span className="text-[11px] text-gray-400 font-mono flex items-center gap-1 ml-auto">
                          <Clock className="w-3 h-3" />
                          {d.timestamp instanceof Object ? formatDistanceToNow((d.timestamp as any).toDate(), { addSuffix: true }) : 'Live'}
                        </span>
                      </div>

                      <h4 className="text-lg font-bold text-gray-900 font-serif leading-snug">
                        {d.title}
                      </h4>

                      <p className="text-xs sm:text-sm text-gray-700 leading-relaxed font-medium whitespace-pre-wrap">
                        {d.message}
                      </p>

                      {d.senderName && (
                        <p className="text-[11px] text-emerald-800 font-semibold pt-1">
                          Authorized by: <strong>{d.senderName}</strong> ({d.senderRole || 'HQ Command'})
                        </p>
                      )}
                    </div>

                    {/* Action & Acknowledgment Controls */}
                    <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0 w-full sm:w-auto justify-between pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-200">
                      {d.link && (
                        <Link
                          to={d.link}
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                        >
                          Execute / View <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}

                      {!isAck ? (
                        <button
                          onClick={() => handleAcknowledge(d.id)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Acknowledge
                        </button>
                      ) : (
                        <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-xl border border-emerald-200/80 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Acknowledged
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
