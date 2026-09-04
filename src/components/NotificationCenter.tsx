import { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import type { Notification as AppNotification, Incident } from '../types';
import { toast } from 'sonner';
import { 
  Bell, 
  X, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  CheckCircle2,
  ShieldAlert, 
  Zap,
  ChevronRight,
  Radio,
  Megaphone,
  Filter
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { 
  requestFcmNotificationPermission, 
  triggerSystemPushNotification, 
  registerFcmForegroundHandler 
} from '../lib/fcm';

export default function NotificationCenter() {
  const { user, isAdmin, isSupervisor } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'directives' | 'alerts'>('all');
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushEnabled, setPushEnabled] = useState<boolean>(() => {
    return 'Notification' in window && Notification.permission === 'granted';
  });

  // Register or request FCM push token on mount if user is logged in
  useEffect(() => {
    if (!user) return;
    if ('Notification' in window && Notification.permission === 'granted') {
      requestFcmNotificationPermission(user.uid, user.role);
    }

    // Register foreground FCM message handler
    let unsubscribeFcm: (() => void) | undefined;
    registerFcmForegroundHandler((payload) => {
      const title = payload.notification?.title || payload.data?.title || '🚨 EMERGENCY SOS ALERT';
      const body = payload.notification?.body || payload.data?.body || 'High priority danger reported.';
      const link = payload.data?.link || '/incidents';
      triggerHighSeverityToast(title, body, undefined, link);
    }).then(unsub => {
      unsubscribeFcm = unsub;
    });

    return () => {
      if (unsubscribeFcm) unsubscribeFcm();
    };
  }, [user]);

  const handleEnablePush = async () => {
    if (!user) return;
    const res = await requestFcmNotificationPermission(user.uid, user.role);
    if (res.granted) {
      setPushEnabled(true);
      toast.success('Push Notifications Enabled!', {
        description: 'You will receive immediate system alerts when a Danger SOS or urgent directive is triggered.'
      });
    } else {
      toast.error('Notification Permission Denied', {
        description: 'Please allow notifications in your browser settings to receive push alerts.'
      });
    }
  };

  // Track initial load to prevent toast spam for historical records
  const isInitialNotificationLoad = useRef(true);
  const isInitialIncidentLoad = useRef(true);
  const toastedNotificationIds = useRef<Set<string>>(new Set());
  const toastedIncidentIds = useRef<Set<string>>(new Set());

  // Function to trigger high-severity alert toast
  const triggerHighSeverityToast = (
    title: string,
    message: string,
    pollingUnitId?: string,
    link?: string,
    senderName?: string
  ) => {
    // Play subtle audio chime for high-severity alert
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.35);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch {
      // Audio context may be restricted before user interaction
    }

    toast.custom((t) => (
      <div className="w-full max-w-md bg-gradient-to-r from-red-950 via-red-900 to-gray-950 text-white rounded-3xl p-5 shadow-2xl border-2 border-red-500/80 backdrop-blur-md flex items-start gap-4 animate-in fade-in slide-in-from-top-5 duration-300">
        <div className="w-12 h-12 rounded-2xl bg-red-600/30 border border-red-400/40 flex items-center justify-center shrink-0 text-red-400 animate-pulse">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-0.5 bg-red-600 text-white text-[10px] font-extrabold uppercase tracking-widest rounded-md shadow-sm">
              🚨 URGENT DIRECTIVE / ALERT
            </span>
            <button 
              onClick={() => toast.dismiss(t)} 
              className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <h4 className="font-bold text-white text-base leading-tight font-serif pt-1">
            {title}
          </h4>
          {senderName && (
            <p className="text-[11px] text-red-200 font-semibold">
              Dispatched by: {senderName}
            </p>
          )}
          {pollingUnitId && (
            <p className="text-xs text-red-200 font-mono font-bold">
              Polling Unit: {pollingUnitId}
            </p>
          )}
          <p className="text-xs text-gray-300 font-medium line-clamp-2">
            {message}
          </p>
          {link && (
            <div className="pt-2">
              <Link
                to={link}
                onClick={() => toast.dismiss(t)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-md transition-all"
              >
                Inspect / Comply <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>
    ), {
      duration: 12000,
    });
  };

  // 1. Listen for Firestore Notifications targeted to current user, their roles, or 'all'
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
      limit(25)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification));
      setNotifications(docs);
      setUnreadCount(docs.filter(n => !n.read).length);

      if (isInitialNotificationLoad.current) {
        docs.forEach(d => toastedNotificationIds.current.add(d.id));
        isInitialNotificationLoad.current = false;
        return;
      }

      // Handle newly added notification items in real-time
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const id = change.doc.id;
          const data = change.doc.data() as AppNotification;
          if (!toastedNotificationIds.current.has(id) && !data.read) {
            toastedNotificationIds.current.add(id);

            const isUrgent = 
              data.type === 'urgent_directive' ||
              data.priority === 'urgent' ||
              data.priority === 'critical' ||
              data.type === 'error' || 
              data.type === 'warning' ||
              data.title?.toUpperCase().includes('CRITICAL') || 
              data.title?.toUpperCase().includes('URGENT');

            if (isUrgent) {
              triggerHighSeverityToast(data.title, data.message, undefined, data.link, data.senderName);
              triggerSystemPushNotification({
                title: `🚨 ${data.title}`,
                body: data.message,
                link: data.link || '/dashboard',
                isSosAlert: true
              });
            } else {
              toast(data.title, {
                description: data.message,
                action: data.link ? {
                  label: 'View',
                  onClick: () => window.location.href = data.link!
                } : undefined,
              });
            }
          }
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });

    return () => unsubscribe();
  }, [user, isAdmin, isSupervisor]);

  // 2. Listen directly for new High / Critical Severity Incidents in real-time
  useEffect(() => {
    if (!user) return;

    const incidentsQuery = query(
      collection(db, 'incidents'),
      orderBy('timestamp', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(incidentsQuery, (snapshot) => {
      if (isInitialIncidentLoad.current) {
        snapshot.docs.forEach(d => toastedIncidentIds.current.add(d.id));
        isInitialIncidentLoad.current = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const id = change.doc.id;
          const incident = { id, ...change.doc.data() } as Incident;

          if (!toastedIncidentIds.current.has(id)) {
            toastedIncidentIds.current.add(id);

            if (incident.severity === 'high' || incident.severity === 'critical') {
              triggerHighSeverityToast(
                `${incident.severity.toUpperCase()} SEVERITY INCIDENT REPORTED`,
                incident.description,
                incident.pollingUnitId,
                `/incidents/${id}`
              );
              triggerSystemPushNotification({
                title: `🚨 ${incident.severity.toUpperCase()} SEVERITY INCIDENT: ${incident.pollingUnitId || 'PU-FIELD'}`,
                body: incident.description,
                link: `/incidents/${id}`,
                isSosAlert: true
              });
            }
          }
        }
      });
    }, (error) => {
      console.warn('Incidents live listener error in NotificationCenter:', error);
    });

    return () => unsubscribe();
  }, [isAdmin, isSupervisor]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `notifications/${id}`);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'urgent_directive':
        return <Radio className="w-4 h-4 text-red-500 animate-pulse" />;
      case 'admin_update':
        return <Megaphone className="w-4 h-4 text-blue-500" />;
      case 'error': 
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning': 
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'success': 
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      default: 
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (activeFilter === 'directives') {
      return n.type === 'urgent_directive' || n.type === 'admin_update' || n.category === 'directive' || n.category === 'update';
    }
    if (activeFilter === 'alerts') {
      return n.type === 'error' || n.type === 'warning' || n.category === 'incident';
    }
    return true;
  });

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-2xl bg-gray-50 text-gray-400 hover:bg-gray-100 transition-all group cursor-pointer"
        title="Alert Center & Directives Stream"
      >
        <Bell className="w-5 h-5 group-hover:text-emerald-600 transition-colors" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-4 ring-white animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40 bg-black/10"
            />
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-4 w-[390px] sm:w-[420px] bg-white rounded-[32px] shadow-2xl border border-gray-100 z-50 overflow-hidden"
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 font-serif text-lg">HQ Notification Center</h3>
                  <p className="text-[11px] text-gray-400 font-semibold">Directives, updates & incident stream</p>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-400 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* FCM Push Notification Status Banner */}
              <div className="px-6 py-2.5 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${pushEnabled ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
                  <span className="font-bold text-[11px]">
                    {pushEnabled ? 'Push Directives Live' : 'Push Alerts Disabled'}
                  </span>
                </div>
                {!pushEnabled ? (
                  <button
                    onClick={handleEnablePush}
                    className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[10px] uppercase tracking-wider rounded-lg transition-all shadow-xs cursor-pointer"
                  >
                    Enable Push
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      toast.info('Sending Test Emergency Push Alert...');
                      const { sendTestWebPushNotification } = await import('../lib/fcm');
                      await sendTestWebPushNotification();
                    }}
                    className="text-[10px] bg-emerald-700/80 hover:bg-emerald-600 text-white font-bold px-2 py-0.5 rounded cursor-pointer transition-colors"
                    title="Send a sample emergency declaration alert to this device"
                  >
                    Test Alert
                  </button>
                )}
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs">
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    activeFilter === 'all' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  All ({notifications.length})
                </button>
                <button
                  onClick={() => setActiveFilter('directives')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    activeFilter === 'directives' ? 'bg-white text-emerald-700 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Directives & Updates
                </button>
                <button
                  onClick={() => setActiveFilter('alerts')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    activeFilter === 'alerts' ? 'bg-white text-red-700 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Security Alerts
                </button>
              </div>

              {/* Notification Items List */}
              <div className="max-h-[380px] overflow-y-auto">
                {filteredNotifications.length === 0 ? (
                  <div className="p-12 text-center text-gray-400">
                    <Bell className="w-10 h-10 mx-auto mb-4 opacity-20" />
                    <p className="font-medium">No alerts in this view</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {filteredNotifications.map((notification) => {
                      const isUrgent = notification.type === 'urgent_directive' || notification.priority === 'urgent' || notification.priority === 'critical';
                      return (
                        <div 
                          key={notification.id}
                          className={`p-5 transition-colors ${
                            !notification.read 
                              ? (isUrgent ? 'bg-red-50/40 border-l-4 border-red-500' : 'bg-emerald-50/40 border-l-4 border-emerald-500') 
                              : 'bg-white'
                          }`}
                        >
                          <div className="flex gap-3.5">
                            <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${notification.read ? 'bg-gray-100' : 'bg-white shadow-sm'}`}>
                              {getIcon(notification.type)}
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex justify-between items-start gap-2">
                                <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded ${
                                  isUrgent ? 'bg-red-100 text-red-700' : 
                                  notification.type === 'admin_update' ? 'bg-blue-100 text-blue-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {notification.type === 'urgent_directive' ? 'Directive' : notification.type === 'admin_update' ? 'Admin Update' : 'Notice'}
                                </span>
                                <span className="text-[10px] text-gray-400 font-mono whitespace-nowrap">
                                  {notification.timestamp instanceof Object ? formatDistanceToNow((notification.timestamp as any).toDate(), { addSuffix: true }) : 'Now'}
                                </span>
                              </div>

                              <p className={`text-sm font-bold leading-tight ${notification.read ? 'text-gray-900' : 'text-gray-950'}`}>
                                {notification.title}
                              </p>

                              {notification.senderName && (
                                <p className="text-[10px] text-emerald-700 font-semibold">
                                  From: {notification.senderName} ({notification.senderRole || 'HQ'})
                                </p>
                              )}

                              <p className="text-xs text-gray-600 leading-relaxed font-medium">
                                {notification.message}
                              </p>

                              <div className="flex items-center gap-3 pt-2">
                                {!notification.read && (
                                  <button 
                                    onClick={() => markAsRead(notification.id)}
                                    className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 underline cursor-pointer"
                                  >
                                    Mark as Read
                                  </button>
                                )}
                                {notification.link && (
                                  <Link 
                                    to={notification.link}
                                    onClick={() => setIsOpen(false)}
                                    className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 transition-colors flex items-center gap-1"
                                  >
                                    View Module <ChevronRight className="w-3 h-3" />
                                  </Link>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 bg-gray-50 border-t border-gray-100 text-center">
                <Link to="/incidents" onClick={() => setIsOpen(false)} className="text-xs font-bold text-gray-500 hover:text-gray-900">
                  View All Field Security Logs & Incidents
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
