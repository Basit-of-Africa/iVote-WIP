import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  BellRing, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  X, 
  RefreshCw,
  Radio,
  Zap,
  Check,
  Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { 
  requestFcmNotificationPermission, 
  getPushNotificationStatus, 
  sendTestWebPushNotification 
} from '../lib/fcm';
import { toast } from 'sonner';

interface PushNotificationPromptProps {
  compact?: boolean;
  className?: string;
  onStatusChange?: (granted: boolean) => void;
}

export default function PushNotificationPrompt({ 
  compact = false, 
  className = '',
  onStatusChange 
}: PushNotificationPromptProps) {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [isRequesting, setIsRequesting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => {
    return localStorage.getItem('push_prompt_dismissed_v1') === 'true';
  });

  useEffect(() => {
    const status = getPushNotificationStatus();
    setPermission(status.permission);
  }, []);

  const handleEnablePush = async () => {
    if (!user) return;
    setIsRequesting(true);
    try {
      const res = await requestFcmNotificationPermission(user.uid, user.role, {
        displayName: user.displayName || user.email,
        state: user.state,
        lga: user.lga,
        pollingUnitId: user.assignedPollingUnitId
      });

      if (res.granted) {
        setPermission('granted');
        setIsDismissed(false);
        localStorage.removeItem('push_prompt_dismissed_v1');
        toast.success('Web Push Notifications Activated!', {
          description: 'You will receive immediate system push alerts for emergency declarations and urgent directives.'
        });
        if (onStatusChange) onStatusChange(true);
      } else {
        const currentPerm = 'Notification' in window ? Notification.permission : 'denied';
        setPermission(currentPerm);
        if (currentPerm === 'denied') {
          toast.error('Notification Permission Blocked', {
            description: 'Please enable notifications for this site in your browser URL lock/settings bar.'
          });
        }
        if (onStatusChange) onStatusChange(false);
      }
    } catch (err) {
      console.error('Error enabling push notifications:', err);
      toast.error('Could not activate push notifications.');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleTestAlert = async () => {
    setIsTesting(true);
    try {
      await sendTestWebPushNotification();
    } finally {
      setIsTesting(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('push_prompt_dismissed_v1', 'true');
  };

  // If unsupported or already granted in compact mode, render status pill
  if (permission === 'granted') {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-200/80 text-xs font-bold ${className}`}>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
        </span>
        <span className="font-mono text-[11px]">Web Push Active</span>
        <button
          onClick={handleTestAlert}
          disabled={isTesting}
          title="Send a sample emergency declaration alert to this device"
          className="text-[10px] uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-2 py-0.5 rounded-md transition-colors cursor-pointer disabled:opacity-50 ml-1"
        >
          {isTesting ? 'Testing...' : 'Test Alert'}
        </button>
      </div>
    );
  }

  if (permission === 'unsupported' || (isDismissed && !compact)) {
    return null;
  }

  // Compact Pill for Top Bar / Header
  if (compact) {
    return (
      <button
        onClick={handleEnablePush}
        disabled={isRequesting}
        className={`flex items-center gap-2 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold rounded-2xl shadow-xs transition-all hover:scale-105 active:scale-95 cursor-pointer ${className}`}
        title="Activate OS Web Push notifications for immediate emergency alerts"
      >
        <BellRing className="w-3.5 h-3.5 animate-bounce" />
        <span>{isRequesting ? 'Activating...' : 'Enable Emergency Push'}</span>
      </button>
    );
  }

  // Full Banner for Observers
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        className={`relative bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-xl border-2 border-amber-500/40 overflow-hidden ${className}`}
      >
        {/* Ambient Glow */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-widest bg-amber-500 text-slate-950 px-2.5 py-0.5 rounded-full font-mono">
                  🚨 Priority Notification Protocol
                </span>
                <span className="text-xs text-amber-200/80 font-medium">OS-Level Web Push</span>
              </div>
              <h3 className="text-lg font-bold font-serif text-white">
                Enable Web Push Alerts for Emergency Declarations
              </h3>
              <p className="text-xs text-gray-300 max-w-2xl leading-relaxed">
                Receive instant sound alarms and device lockscreen banners when Headquarters declares a security evacuation, accreditation time extension, or urgent operational advisory in your polling area.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-amber-500/20">
            <button
              onClick={handleDismiss}
              className="px-3.5 py-2 text-xs font-bold text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              Later
            </button>
            <button
              onClick={handleEnablePush}
              disabled={isRequesting}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer disabled:opacity-50"
            >
              {isRequesting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <BellRing className="w-4 h-4" />
                  <span>Enable Push Alerts</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
