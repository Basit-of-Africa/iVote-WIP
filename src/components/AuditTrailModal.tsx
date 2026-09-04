import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AuditLogEntry } from '../types';
import { 
  History, 
  X, 
  Trash2, 
  ShieldAlert, 
  Search, 
  Calendar, 
  User, 
  Download, 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  Radio, 
  Filter, 
  AlertTriangle,
  Lock
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface AuditTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuditTrailModal({ isOpen, onClose }: AuditTrailModalProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AuditLogEntry));
      setLogs(entries);
      setLoading(false);
    }, (err) => {
      console.warn('Audit logs listener error:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter(log => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      (log.targetId && log.targetId.toLowerCase().includes(term)) ||
      (log.pollingUnitId && log.pollingUnitId.toLowerCase().includes(term)) ||
      (log.summary && log.summary.toLowerCase().includes(term)) ||
      (log.reason && log.reason.toLowerCase().includes(term)) ||
      (log.deletedByName && log.deletedByName.toLowerCase().includes(term)) ||
      (log.deletedByEmail && log.deletedByEmail.toLowerCase().includes(term));

    const matchesFilter = 
      actionFilter === 'all' ? true :
      actionFilter === 'deletions' ? (log.action === 'DELETE_REPORT' || log.action === 'DELETE_INCIDENT') :
      actionFilter === 'reports' ? log.action === 'DELETE_REPORT' :
      actionFilter === 'incidents' ? log.action === 'DELETE_INCIDENT' :
      log.action === actionFilter;

    return matchesSearch && matchesFilter;
  });

  const exportAuditCSV = () => {
    if (filteredLogs.length === 0) {
      toast.error('No audit records to export.');
      return;
    }

    const headers = ['Audit ID', 'Timestamp', 'Action', 'Target Type', 'Target ID', 'Polling Unit', 'Admin Name', 'Admin Email', 'Reason', 'Summary'];
    const rows = filteredLogs.map(l => {
      let timeStr = 'N/A';
      if ((l.timestamp as any)?.toDate) {
        timeStr = format((l.timestamp as any).toDate(), 'yyyy-MM-dd HH:mm:ss');
      } else if (l.timestamp) {
        timeStr = String(l.timestamp);
      }

      return [
        `"${l.id}"`,
        `"${timeStr}"`,
        `"${l.action}"`,
        `"${l.targetType}"`,
        `"${l.targetId}"`,
        `"${l.pollingUnitId || ''}"`,
        `"${(l.deletedByName || '').replace(/"/g, '""')}"`,
        `"${l.deletedByEmail || ''}"`,
        `"${(l.reason || '').replace(/"/g, '""')}"`,
        `"${(l.summary || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ivote_audit_trail_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Exported audit trail CSV successfully.');
  };

  const getActionBadge = (action: AuditLogEntry['action']) => {
    switch (action) {
      case 'DELETE_REPORT':
        return (
          <span className="px-2.5 py-1 bg-red-100 text-red-800 border border-red-200 text-[10px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1">
            <Trash2 className="w-3 h-3 text-red-600" /> Deleted Report
          </span>
        );
      case 'DELETE_INCIDENT':
        return (
          <span className="px-2.5 py-1 bg-orange-100 text-orange-800 border border-orange-200 text-[10px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1">
            <ShieldAlert className="w-3 h-3 text-orange-600" /> Deleted Incident
          </span>
        );
      case 'BROADCAST_DIRECTIVE':
        return (
          <span className="px-2.5 py-1 bg-purple-100 text-purple-800 border border-purple-200 text-[10px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1">
            <Radio className="w-3 h-3 text-purple-600" /> Directive Broadcast
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 bg-gray-100 text-gray-800 border border-gray-200 text-[10px] font-black uppercase tracking-wider rounded-lg">
            {action}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="bg-white rounded-[32px] shadow-2xl border border-gray-100 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Modal Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold font-serif">System Audit Trail</h2>
                <span className="px-2 py-0.5 bg-emerald-950 border border-emerald-700/60 text-emerald-400 text-[10px] font-mono font-bold rounded-md uppercase">
                  IMMUTABLE LOG
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Official chronological record of administrative actions, test purges, and report deletions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportAuditCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all border border-slate-700 cursor-pointer"
              title="Download entire audit trail as CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by PU ID, Admin email, reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
            <Filter className="w-4 h-4 text-gray-400 shrink-0" />
            {['all', 'deletions', 'reports', 'incidents'].map((filt) => (
              <button
                key={filt}
                onClick={() => setActionFilter(filt)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all shrink-0 ${
                  actionFilter === filt
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                {filt}
              </button>
            ))}
            <span className="text-xs font-mono text-gray-400 bg-gray-200/80 px-2 py-1 rounded-lg">
              {filteredLogs.length} Records
            </span>
          </div>
        </div>

        {/* Audit Log Stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="py-20 text-center text-gray-400 space-y-3">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-medium">Retrieving immutable audit logs from database...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-16 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-3xl p-8 space-y-2">
              <Lock className="w-10 h-10 text-gray-300 mx-auto" />
              <h4 className="font-bold text-gray-700 font-serif">No Audit Records Found</h4>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Any future report deletions, incident purges, or critical administrative mutations will automatically be logged here.
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              let formattedDate = 'N/A';
              let relativeDate = 'Recently';
              if ((log.timestamp as any)?.toDate) {
                const d = (log.timestamp as any).toDate();
                formattedDate = format(d, 'MMM d, yyyy • HH:mm:ss');
                relativeDate = formatDistanceToNow(d, { addSuffix: true });
              } else if (log.timestamp) {
                try {
                  const d = new Date(log.timestamp as any);
                  formattedDate = format(d, 'MMM d, yyyy • HH:mm:ss');
                  relativeDate = formatDistanceToNow(d, { addSuffix: true });
                } catch {
                  formattedDate = String(log.timestamp);
                }
              }

              return (
                <div 
                  key={log.id}
                  className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs hover:border-gray-300 transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getActionBadge(log.action)}
                      {log.pollingUnitId && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 font-mono font-bold text-xs rounded-md">
                          PU: {log.pollingUnitId}
                        </span>
                      )}
                      <span className="text-[11px] font-mono text-gray-400">
                        ID: {log.targetId.substring(0, 8)}...
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <span className="font-medium" title={formattedDate}>{relativeDate}</span>
                      <span className="text-gray-300">•</span>
                      <span className="text-[11px] font-mono text-gray-400">{formattedDate}</span>
                    </div>
                  </div>

                  {/* Summary & Deletion Reason */}
                  <div className="space-y-1">
                    {log.summary && (
                      <p className="text-sm font-semibold text-gray-800 font-sans">
                        {log.summary}
                      </p>
                    )}
                    {log.reason && (
                      <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200/80 px-3 py-1.5 rounded-xl flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span><strong>Reason provided:</strong> {log.reason}</span>
                      </div>
                    )}
                  </div>

                  {/* Actor Details & Snapshot Trigger */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 text-xs text-gray-600">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Performed by: <strong className="text-gray-900">{log.deletedByName}</strong> ({log.deletedByEmail})</span>
                    </div>

                    {log.snapshot && (
                      <button
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 cursor-pointer transition-colors"
                      >
                        <FileText className="w-3 h-3" />
                        <span>{isExpanded ? 'Hide Data Snapshot' : 'View Deleted Snapshot'}</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}
                  </div>

                  {/* Expanded JSON Snapshot of the deleted record */}
                  {isExpanded && log.snapshot && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-slate-900 text-emerald-300 p-4 rounded-xl font-mono text-[11px] overflow-x-auto border border-slate-800"
                    >
                      <div className="text-slate-400 mb-1 text-[10px] uppercase font-sans font-bold">
                        Pre-Deletion Snapshot Payload:
                      </div>
                      <pre>{JSON.stringify(log.snapshot, null, 2)}</pre>
                    </motion.div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-emerald-600" />
            <span>Audit logs are permanently synchronized and cannot be modified or purged by any user.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all"
          >
            Close Audit Trail
          </button>
        </div>
      </motion.div>
    </div>
  );
}
