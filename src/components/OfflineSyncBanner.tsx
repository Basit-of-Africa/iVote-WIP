import React, { useEffect, useState } from 'react';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Trash2, 
  Clock, 
  HardDrive 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { 
  getPendingReports, 
  syncPendingReports, 
  removePendingReport, 
  clearAllPendingReports,
  PendingReport, 
  getLastSyncTime 
} from '../lib/offlineStorage';

export default function OfflineSyncBanner() {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingReports, setPendingReports] = useState<PendingReport[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(getLastSyncTime());

  const refreshPendingList = () => {
    setPendingReports(getPendingReports());
  };

  useEffect(() => {
    refreshPendingList();

    const currentPending = getPendingReports();
    if (navigator.onLine && currentPending.length > 0) {
      handleSync();
    }

    const handleOnline = () => {
      setIsOnline(true);
      // Auto-trigger sync when network reconnects
      handleSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handlePendingUpdated = () => {
      refreshPendingList();
      if (navigator.onLine && getPendingReports().length > 0 && !isSyncing) {
        handleSync();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', handleOnline);
    window.addEventListener('ivote_pending_reports_updated', handlePendingUpdated);

    // Poll pending list every 3s in case items are added
    const interval = setInterval(() => {
      refreshPendingList();
    }, 3000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleOnline);
      window.removeEventListener('ivote_pending_reports_updated', handlePendingUpdated);
      clearInterval(interval);
    };
  }, [user]);

  const handleSync = async () => {
    if (isSyncing || pendingReports.length === 0) return;
    setIsSyncing(true);
    setSyncResult(null);

    try {
      const res = await syncPendingReports(user?.uid);
      setLastSync(getLastSyncTime());
      refreshPendingList();

      if (res.error) {
        toast.error(res.error);
        setSyncResult(res.error);
      } else if (res.successCount > 0) {
        const msg = `Successfully uploaded ${res.successCount} offline report${res.successCount > 1 ? 's' : ''}!`;
        setSyncResult(msg);
        toast.success(msg);
        setTimeout(() => setSyncResult(null), 5000);
      } else if (res.failedCount > 0) {
        const msg = `Attempted sync, but ${res.failedCount} report(s) encountered network/permission errors.`;
        setSyncResult(msg);
        toast.error(msg);
        setTimeout(() => setSyncResult(null), 6000);
      }
    } catch (err: any) {
      console.error('Offline sync error', err);
      const msg = 'Sync failed. Will retry automatically when connection stabilizes.';
      setSyncResult(msg);
      toast.error(msg);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteDraft = (clientId: string) => {
    removePendingReport(clientId);
    refreshPendingList();
    toast.info('Draft removed from local cache');
  };

  const handleClearAllDrafts = () => {
    clearAllPendingReports();
    refreshPendingList();
    setShowDrawer(false);
    toast.info('All offline drafts cleared');
  };

  // Only show if offline OR if there are pending reports locally
  if (isOnline && pendingReports.length === 0) {
    return null;
  }

  return (
    <div className="w-full bg-slate-900 text-white shadow-md border-b border-slate-800 sticky top-16 z-30 transition-all">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-3">
          {!isOnline ? (
            <span className="flex items-center gap-2 bg-amber-500/20 text-amber-300 font-medium px-2.5 py-1 rounded-full text-xs border border-amber-500/30">
              <WifiOff className="w-3.5 h-3.5 animate-pulse text-amber-400" />
              Offline Mode Active
            </span>
          ) : (
            <span className="flex items-center gap-2 bg-emerald-500/20 text-emerald-300 font-medium px-2.5 py-1 rounded-full text-xs border border-emerald-500/30">
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              Connected
            </span>
          )}

          <div className="flex items-center gap-2 text-slate-300 text-xs">
            <HardDrive className="w-4 h-4 text-slate-400" />
            <span>
              <strong className="text-white">{pendingReports.length}</strong> {pendingReports.length === 1 ? 'incident/report' : 'incidents/reports'} cached locally
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {syncResult && (
            <span className="text-xs text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-800/50 hidden md:inline-block">
              {syncResult}
            </span>
          )}

          {pendingReports.length > 0 && (
            <button
              onClick={() => setShowDrawer(!showDrawer)}
              className="text-xs text-slate-300 hover:text-white flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded border border-slate-700 transition-colors"
            >
              <span>{showDrawer ? 'Hide Drafts' : 'View Cached Drafts'}</span>
              {showDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}

          {isOnline && pendingReports.length > 0 && (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1 rounded-md shadow transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Uploading...' : 'Sync Pending Now'}
            </button>
          )}
        </div>
      </div>

      {/* Expandable Offline Queue Drawer */}
      <AnimatePresence>
        {showDrawer && pendingReports.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-slate-950 border-t border-slate-800/80 px-4 py-3"
          >
            <div className="max-w-7xl mx-auto space-y-2">
              <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                <span className="font-semibold text-slate-300">Cached Incident Submissions Queue</span>
                <div className="flex items-center gap-3">
                  {lastSync && (
                    <span className="text-[11px] text-slate-500 flex items-center gap-1 hidden sm:flex">
                      <Clock className="w-3 h-3" /> Last Sync: {new Date(lastSync).toLocaleTimeString()}
                    </span>
                  )}
                  <button
                    onClick={handleClearAllDrafts}
                    className="text-[11px] text-red-400 hover:text-red-300 transition-colors underline cursor-pointer"
                  >
                    Clear All Cached
                  </button>
                </div>
              </div>

              <div className="grid gap-2 max-h-48 overflow-y-auto pr-1">
                {pendingReports.map((report) => (
                  <div
                    key={report.clientId}
                    className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                        report.type === 'incident' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                        report.type === 'result' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
                        'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {report.type}
                      </span>
                      <div>
                        <div className="font-semibold text-white flex items-center gap-2">
                          <span>Unit: {report.pollingUnitId}</span>
                          {report.payload.severity && (
                            <span className="text-[10px] text-red-400 font-normal capitalize">
                              ({report.payload.severity} severity)
                            </span>
                          )}
                        </div>
                        <p className="text-slate-400 text-[11px] line-clamp-1">
                          {report.payload.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-500">
                        {new Date(report.createdAtISO).toLocaleTimeString()}
                      </span>

                      {report.status === 'failed' && (
                        <span className="text-[10px] text-red-400 bg-red-950/50 px-1.5 py-0.5 rounded border border-red-800/40" title={report.errorMessage}>
                          Sync Failed
                        </span>
                      )}

                      <button
                        onClick={() => handleDeleteDraft(report.clientId)}
                        className="p-1 hover:bg-slate-800 text-slate-400 hover:text-red-400 rounded transition-colors"
                        title="Delete cached draft"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
