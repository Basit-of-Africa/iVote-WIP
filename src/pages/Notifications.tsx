import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Radio, 
  ShieldAlert, 
  CheckCircle2, 
  Info, 
  AlertTriangle, 
  Megaphone, 
  Clock, 
  Filter, 
  Check, 
  PlusCircle, 
  Volume2
} from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Notification } from '../types';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/common/PageHeader';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';
import EmptyState from '../components/common/EmptyState';
import DirectiveBroadcastModal from '../components/DirectiveBroadcastModal';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

const SAMPLE_NOTIFICATIONS: Notification[] = [
  {
    id: 'notif-01',
    userId: 'all',
    title: 'Directive #04: BVAS Device Restart Protocol Enacted',
    message: 'All presiding field observers are hereby instructed to follow standard 30-second restart sequence before requesting manual voter log verification in Osun Central.',
    type: 'urgent_directive',
    category: 'directive',
    priority: 'urgent',
    senderName: 'HQ Operations Command',
    senderRole: 'National Electoral Supervisor',
    read: false,
    timestamp: new Date(Date.now() - 1800000).toISOString()
  },
  {
    id: 'notif-02',
    userId: 'all',
    title: 'Security Advisory: Police Patrol Deployed in Ife South',
    message: 'Rapid Response Unit 4 has arrived at Ward 03. Field observers should maintain normal logging protocols.',
    type: 'info',
    category: 'update',
    priority: 'normal',
    senderName: 'State Security Coordinator',
    senderRole: 'Security Liaison',
    read: true,
    timestamp: new Date(Date.now() - 5400000).toISOString()
  },
  {
    id: 'notif-03',
    userId: 'all',
    title: 'System Notice: Offline Mode & Batch Syncing Active',
    message: 'All queued encrypted reports will automatically push to the national tally server upon connection restoration.',
    type: 'success',
    category: 'system',
    priority: 'normal',
    senderName: 'System Engine',
    senderRole: 'Infrastructure',
    read: true,
    timestamp: new Date(Date.now() - 14400000).toISOString()
  }
];

export default function Notifications() {
  const { user, isAdmin, isSupervisor } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>(SAMPLE_NOTIFICATIONS);
  const [activeFilter, setActiveFilter] = useState<'all' | 'directive' | 'incident' | 'system'>('all');
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [isEmergencyBroadcast, setIsEmergencyBroadcast] = useState(false);

  // Firestore Real-time synchronization
  useEffect(() => {
    try {
      const q = query(collection(db, 'notifications'), orderBy('timestamp', 'desc'), limit(50));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const liveList = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          } as Notification));
          setNotifications(liveList);
        }
      }, (error) => {
        console.warn('Notifications stream notice, using cached list:', error);
      });

      return () => unsubscribe();
    } catch (e) {
      console.warn('Notifications setup error:', e);
    }
  }, []);

  const handleAcknowledge = async (notifId: string) => {
    if (!user) return;
    try {
      const notifRef = doc(db, 'notifications', notifId);
      await updateDoc(notifRef, {
        acknowledgedBy: arrayUnion(user.uid)
      });
      toast.success('Directive acknowledged');
    } catch (e) {
      // Local fallback
      setNotifications(prev => prev.map(n => {
        if (n.id === notifId) {
          return {
            ...n,
            acknowledgedBy: [...(n.acknowledgedBy || []), user.uid]
          };
        }
        return n;
      }));
      toast.success('Directive marked as acknowledged');
    }
  };

  const filteredNotifs = notifications.filter(n => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'directive') return n.category === 'directive' || n.type === 'urgent_directive';
    if (activeFilter === 'incident') return n.category === 'incident' || n.priority === 'urgent' || n.priority === 'critical';
    return n.category === 'system';
  });

  const unacknowledgedDirectives = notifications.filter(
    n => (n.category === 'directive' || n.type === 'urgent_directive') &&
         (!n.acknowledgedBy || !user || !n.acknowledgedBy.includes(user.uid))
  ).length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageHeader
        title="Notifications & Directives"
        description="Official headquarters broadcasts, urgent tactical security alerts, and field compliance directives."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Notifications' }
        ]}
        badge={{
          label: `${unacknowledgedDirectives} Directives Pending Action`,
          variant: unacknowledgedDirectives > 0 ? 'amber' : 'emerald'
        }}
        actions={
          (isAdmin || isSupervisor) ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsEmergencyBroadcast(true);
                  setShowBroadcastModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer min-h-[38px]"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Declare Emergency Alert</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsEmergencyBroadcast(false);
                  setShowBroadcastModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer min-h-[38px]"
              >
                <Radio className="w-4 h-4" />
                <span>Broadcast Directive</span>
              </button>
            </div>
          ) : undefined
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard
          title="Total Broadcasts"
          value={notifications.length}
          subtitle="All received channel transmissions"
          icon={Bell}
          colorScheme="indigo"
        />
        <StatCard
          title="Pending Directives"
          value={unacknowledgedDirectives}
          subtitle="Directives requiring confirmation"
          icon={Radio}
          colorScheme="amber"
          badge={{ text: `${unacknowledgedDirectives} action`, variant: 'amber' }}
        />
        <StatCard
          title="Security Broadcasts"
          value={notifications.filter(n => n.priority === 'urgent' || n.priority === 'critical').length}
          subtitle="Critical priority field advisories"
          icon={ShieldAlert}
          colorScheme="red"
        />
        <StatCard
          title="System Transmissions"
          value={notifications.filter(n => n.category === 'system').length}
          subtitle="Sync & platform notifications"
          icon={CheckCircle2}
          colorScheme="blue"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-gray-200">
        {[
          { id: 'all', label: 'All Notifications' },
          { id: 'directive', label: 'Official Directives' },
          { id: 'incident', label: 'Security & SOS Alerts' },
          { id: 'system', label: 'System Telemetry' }
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveFilter(tab.id as any)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 -mb-px whitespace-nowrap cursor-pointer ${
              activeFilter === tab.id
                ? 'border-emerald-600 text-emerald-700 font-bold bg-emerald-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {filteredNotifs.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications in this feed"
            description="All field directives and security advisories are up to date."
            action={{
              label: 'View All Notifications',
              onClick: () => setActiveFilter('all')
            }}
          />
        ) : (
          filteredNotifs.map(notif => {
            const isAcknowledged = user && notif.acknowledgedBy && notif.acknowledgedBy.includes(user.uid);
            const isUrgent = notif.priority === 'urgent' || notif.priority === 'critical' || notif.type === 'urgent_directive';

            let dateString = 'Recent';
            if (notif.timestamp) {
              try {
                const dt = (notif.timestamp as any)?.toDate ? (notif.timestamp as any).toDate() : new Date(notif.timestamp as any);
                dateString = formatDistanceToNow(dt, { addSuffix: true });
              } catch {
                dateString = 'Recent';
              }
            }

            return (
              <div
                key={notif.id}
                className={`bg-white rounded-2xl border p-5 sm:p-6 transition-all duration-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6 ${
                  isUrgent 
                    ? 'border-red-200 bg-red-50/20' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="space-y-2 max-w-3xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                      isUrgent 
                        ? 'bg-red-100 text-red-800 border border-red-200' 
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {notif.category || 'Notification'}
                    </span>
                    <span className="text-xs text-gray-400 font-medium">
                      {dateString}
                    </span>
                    {notif.senderName && (
                      <span className="text-xs text-gray-500 font-medium">
                        • from <strong className="text-gray-700">{notif.senderName}</strong> ({notif.senderRole || 'HQ'})
                      </span>
                    )}
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-gray-900 font-serif">
                    {notif.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                    {notif.message}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-start md:self-center">
                  {(notif.category === 'directive' || notif.type === 'urgent_directive') && (
                    isAcknowledged ? (
                      <div className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Acknowledged</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAcknowledge(notif.id)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer min-h-[38px]"
                      >
                        Confirm Acknowledgment
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Broadcast Modal for Admins/Supervisors */}
      <DirectiveBroadcastModal
        isOpen={showBroadcastModal}
        onClose={() => setShowBroadcastModal(false)}
        defaultEmergencyMode={isEmergencyBroadcast}
      />
    </div>
  );
}
