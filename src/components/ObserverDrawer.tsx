import React, { useState, useEffect } from 'react';
import { User, Report, CheckInRecord } from '../types';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  User as UserIcon, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Clock, 
  Shield, 
  ShieldCheck,
  ShieldAlert, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  Copy, 
  Check, 
  Edit3, 
  Navigation, 
  Radio, 
  Activity, 
  Vote, 
  Smartphone,
  Send,
  RefreshCw,
  Building2,
  BadgeAlert,
  ChevronRight,
  Award
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface ObserverDrawerProps {
  observer: User | null;
  isOpen: boolean;
  onClose: () => void;
  onEditAssignment?: (observer: User) => void;
  onUpgradeRole?: (observer: User) => void;
  onToggleStatus?: (observer: User, newStatus: 'active' | 'suspended') => void;
  reportCount?: number;
}

export default function ObserverDrawer({
  observer,
  isOpen,
  onClose,
  onEditAssignment,
  onUpgradeRole,
  onToggleStatus,
  reportCount = 0
}: ObserverDrawerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'attendance'>('overview');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [observerReports, setObserverReports] = useState<Report[]>([]);
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset tab when observer changes
  useEffect(() => {
    if (observer) {
      setActiveTab('overview');
    }
  }, [observer?.uid]);

  // Fetch observer's recent reports and check-in logs
  useEffect(() => {
    if (!observer?.uid || !isOpen) return;

    setLoadingActivity(true);

    // 1. Fetch Reports by this observer
    const reportsRef = collection(db, 'reports');
    const unsubReports = onSnapshot(reportsRef, (snapshot) => {
      const allReports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
      const filtered = allReports.filter(r => 
        r.observerId === observer.uid || 
        (r.payload?.observerName && r.payload.observerName.toLowerCase() === observer.displayName.toLowerCase()) ||
        (r.payload?.observerEmail && r.payload.observerEmail.toLowerCase() === observer.email.toLowerCase())
      );
      
      // Sort by timestamp desc
      filtered.sort((a, b) => {
        const timeA = new Date(typeof a.timestamp === 'string' ? a.timestamp : (a.timestamp as any)?.toDate?.() || 0).getTime();
        const timeB = new Date(typeof b.timestamp === 'string' ? b.timestamp : (b.timestamp as any)?.toDate?.() || 0).getTime();
        return timeB - timeA;
      });

      setObserverReports(filtered);
      setLoadingActivity(false);
    }, (err) => {
      console.warn('Error loading observer reports in drawer:', err);
      setLoadingActivity(false);
    });

    // 2. Fetch Check-In History for this observer
    const checkinsRef = collection(db, 'checkins');
    const unsubCheckins = onSnapshot(checkinsRef, (snapshot) => {
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CheckInRecord));
      const filteredCheckins = records.filter(c => 
        c.observerId === observer.uid || 
        c.observerEmail?.toLowerCase() === observer.email?.toLowerCase()
      );

      filteredCheckins.sort((a, b) => {
        const timeA = new Date(typeof a.timestamp === 'string' ? a.timestamp : (a.timestamp as any)?.toDate?.() || 0).getTime();
        const timeB = new Date(typeof b.timestamp === 'string' ? b.timestamp : (b.timestamp as any)?.toDate?.() || 0).getTime();
        return timeB - timeA;
      });

      setCheckIns(filteredCheckins);
    }, (err) => {
      console.warn('Error loading observer checkins in drawer:', err);
    });

    return () => {
      unsubReports();
      unsubCheckins();
    };
  }, [observer?.uid, isOpen]);

  if (!observer) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`Copied ${label} to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const isCurrentActive = observer.status === 'active' || !observer.status;
  const isSuspended = observer.status === 'suspended';
  const roleLabel = observer.role === 'admin' ? 'Administrator' : (observer.role === 'field_supervisor' || observer.role === 'supervisor') ? 'Field Supervisor' : 'Field Observer';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity cursor-pointer"
            aria-hidden="true"
          />

          {/* Slide-Over Drawer Container */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-screen max-w-xl bg-white shadow-2xl flex flex-col justify-between overflow-hidden border-l border-gray-100"
              role="dialog"
              aria-modal="true"
              aria-labelledby="observer-drawer-title"
            >
              {/* Drawer Top Header */}
              <div className="p-6 bg-slate-900 text-white relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-black text-xl flex items-center justify-center shadow-lg border-2 border-white/20 shrink-0">
                      {observer.displayName ? observer.displayName.charAt(0).toUpperCase() : 'O'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 id="observer-drawer-title" className="text-lg sm:text-xl font-bold tracking-tight text-white font-serif">
                          {observer.displayName || 'Unnamed Observer'}
                        </h2>
                        <span className={`w-2.5 h-2.5 rounded-full ${isCurrentActive ? 'bg-emerald-400 animate-pulse' : isSuspended ? 'bg-red-400' : 'bg-gray-400'}`} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                          {roleLabel}
                        </span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-md ${
                          isCurrentActive ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : isSuspended ? 'bg-red-950 text-red-300 border border-red-800' : 'bg-slate-800 text-gray-300'
                        }`}>
                          {isCurrentActive ? 'Active On Duty' : isSuspended ? 'Suspended' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                    aria-label="Close observer details"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Quick Action Contact Bar */}
                <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-slate-800">
                  {observer.phone ? (
                    <a
                      href={`tel:${observer.phone}`}
                      className="flex items-center justify-center gap-2 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm group"
                    >
                      <Phone className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                      <span>Call Observer</span>
                    </a>
                  ) : (
                    <button
                      disabled
                      className="flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-800 text-gray-500 rounded-xl text-xs font-bold cursor-not-allowed"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>No Phone</span>
                    </button>
                  )}

                  {observer.phone ? (
                    <a
                      href={`sms:${observer.phone}`}
                      className="flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all border border-slate-700 group"
                    >
                      <Smartphone className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
                      <span>SMS Alert</span>
                    </a>
                  ) : (
                    <button
                      disabled
                      className="flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-800 text-gray-500 rounded-xl text-xs font-bold cursor-not-allowed"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>SMS</span>
                    </button>
                  )}

                  <a
                    href={`mailto:${observer.email}`}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all border border-slate-700 group"
                  >
                    <Mail className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                    <span>Email</span>
                  </a>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-gray-100 bg-gray-50/70 px-6">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className={`py-3.5 px-4 font-bold text-xs border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                    activeTab === 'overview'
                      ? 'border-emerald-600 text-emerald-800 bg-white shadow-xs'
                      : 'border-transparent text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  <span>Profile & Deployment</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('activity')}
                  className={`py-3.5 px-4 font-bold text-xs border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                    activeTab === 'activity'
                      ? 'border-emerald-600 text-emerald-800 bg-white shadow-xs'
                      : 'border-transparent text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Activity & Transmissions ({observerReports.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('attendance')}
                  className={`py-3.5 px-4 font-bold text-xs border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                    activeTab === 'attendance'
                      ? 'border-emerald-600 text-emerald-800 bg-white shadow-xs'
                      : 'border-transparent text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Check-In & GPS ({checkIns.length})</span>
                </button>
              </div>

              {/* Drawer Scrollable Content Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* TAB 1: OVERVIEW & CONTACT */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Contact & Credentials Card */}
                    <div className="bg-gray-50/80 rounded-2xl p-5 border border-gray-100 space-y-4">
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-emerald-600" />
                        Contact & Account Information
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="text-gray-400 font-medium">Email Address</p>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <span className="font-bold text-gray-900 truncate">{observer.email}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(observer.email, 'Email')}
                              className="text-gray-400 hover:text-emerald-600 p-1"
                              title="Copy email"
                            >
                              {copiedField === 'Email' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <p className="text-gray-400 font-medium">Direct Phone Line</p>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <span className="font-bold text-gray-900">{observer.phone || 'Not provided'}</span>
                            {observer.phone && (
                              <button
                                type="button"
                                onClick={() => copyToClipboard(observer.phone!, 'Phone')}
                                className="text-gray-400 hover:text-emerald-600 p-1"
                                title="Copy phone"
                              >
                                {copiedField === 'Phone' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                        </div>

                        <div>
                          <p className="text-gray-400 font-medium">Observer UID</p>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <span className="font-mono text-gray-700 truncate">{observer.uid}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(observer.uid, 'UID')}
                              className="text-gray-400 hover:text-emerald-600 p-1"
                              title="Copy UID"
                            >
                              {copiedField === 'UID' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <p className="text-gray-400 font-medium">Registration Date</p>
                          <p className="font-bold text-gray-900 mt-0.5">
                            {observer.createdAt ? format(new Date(observer.createdAt), 'MMM d, yyyy') : 'Pre-registered'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Field Deployment Station Card */}
                    <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                          Deployment & Station Assignment
                        </h4>
                        <button
                          type="button"
                          onClick={() => onEditAssignment(observer)}
                          className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 hover:underline cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          Edit Assignment
                        </button>
                      </div>

                      <div className="space-y-3 text-xs">
                        <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 flex items-start gap-3">
                          <MapPin className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono font-bold text-emerald-900">
                                {observer.assignedPollingUnitId || 'PU-UNASSIGNED'}
                              </span>
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                Assigned Station
                              </span>
                            </div>
                            <p className="text-gray-700 font-medium mt-1">
                              {observer.assignedPollingUnitName || 'No specific polling station venue name registered.'}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <p className="text-gray-400 font-medium text-[11px]">Electoral State</p>
                            <p className="font-bold text-gray-900 mt-0.5">{observer.state || 'Lagos'}</p>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <p className="text-gray-400 font-medium text-[11px]">Local Govt Area (LGA)</p>
                            <p className="font-bold text-gray-900 mt-0.5">{observer.lga || 'Ikeja'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Access Level & RBAC Privileges Card */}
                    <div className="bg-white rounded-2xl p-5 border border-indigo-100 shadow-xs space-y-3 relative overflow-hidden">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-indigo-900 uppercase tracking-wider flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-indigo-600" />
                          Access Level & System Privileges
                        </h4>
                        {onUpgradeRole && (
                          <button
                            type="button"
                            onClick={() => onUpgradeRole(observer)}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            <Award className="w-3 h-3" />
                            <span>Modify Access Level</span>
                          </button>
                        )}
                      </div>

                      <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/80 flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider rounded-md border ${
                              observer.role === 'admin'
                                ? 'bg-purple-100 text-purple-800 border-purple-200'
                                : (observer.role === 'field_supervisor' || observer.role === 'supervisor')
                                ? 'bg-blue-100 text-blue-800 border-blue-200'
                                : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            }`}>
                              {roleLabel}
                            </span>
                            <span className="text-xs text-gray-500 font-medium">
                              {observer.role === 'admin' 
                                ? 'Tier 3 • Executive Admin' 
                                : (observer.role === 'field_supervisor' || observer.role === 'supervisor') 
                                ? 'Tier 2 • Tactical Supervisor' 
                                : 'Tier 1 • Ground Observer'}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-600 mt-1">
                            {observer.role === 'admin' 
                              ? 'Authorized for RBAC role upgrades, roster imports, scope setup, and global directives.'
                              : (observer.role === 'field_supervisor' || observer.role === 'supervisor')
                              ? 'Authorized for multi-unit triage, incident investigation updates, and LGA supervision.'
                              : 'Authorized for polling unit accreditation entries, incident reports, and GPS check-ins.'}
                          </p>
                        </div>

                        {onUpgradeRole && (
                          <button
                            type="button"
                            onClick={() => onUpgradeRole(observer)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-all shadow-xs shrink-0 cursor-pointer"
                          >
                            Upgrade
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Operational Summary Metrics */}
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-100">
                        <p className="text-xl font-black text-emerald-800">{observerReports.length || reportCount}</p>
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mt-0.5">Reports Sent</p>
                      </div>
                      <div className="p-3.5 bg-blue-50/70 rounded-2xl border border-blue-100">
                        <p className="text-xl font-black text-blue-800">{checkIns.length}</p>
                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mt-0.5">Check-Ins</p>
                      </div>
                      <div className="p-3.5 bg-purple-50/70 rounded-2xl border border-purple-100">
                        <p className="text-xl font-black text-purple-800">{observer.checkInStatus === 'checked_in' ? '100%' : '0%'}</p>
                        <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider mt-0.5">Station Lock</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: RECENT ACTIVITY & TRANSMISSIONS */}
                {activeTab === 'activity' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-emerald-600" />
                        Transmitted Observation Reports
                      </h4>
                      <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">
                        {observerReports.length} Submitted
                      </span>
                    </div>

                    {loadingActivity ? (
                      <div className="py-12 text-center text-gray-400 flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                        <p className="text-xs font-medium">Fetching observer transmission logs...</p>
                      </div>
                    ) : observerReports.length === 0 ? (
                      <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 space-y-2">
                        <FileText className="w-8 h-8 text-gray-300 mx-auto" />
                        <p className="text-sm font-bold text-gray-700">No transmissions recorded yet</p>
                        <p className="text-xs text-gray-400 max-w-xs mx-auto">
                          When this observer submits election observation forms or incident logs from the field, they will appear here.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {observerReports.map((report) => {
                          const payload = report.payload || {};
                          let timeStr = 'Recently';
                          if (report.timestamp) {
                            try {
                              const d = typeof report.timestamp === 'string' ? new Date(report.timestamp) : (report.timestamp as any).toDate?.();
                              if (d) timeStr = format(d, 'MMM d, yyyy • HH:mm');
                            } catch (e) {
                              // ignore
                            }
                          }

                          return (
                            <div
                              key={report.id}
                              className="p-4 bg-white rounded-2xl border border-gray-200/80 shadow-xs space-y-2 hover:border-emerald-200 transition-all"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                    report.type === 'incident' 
                                      ? 'bg-red-100 text-red-800 border border-red-200'
                                      : report.type === 'result'
                                      ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  }`}>
                                    {report.type}
                                  </span>
                                  <span className="font-mono text-xs font-bold text-gray-800">
                                    {report.pollingUnitId || payload.pollingUnitId || 'PU-N/A'}
                                  </span>
                                </div>
                                <span className="text-[11px] text-gray-400 font-medium">
                                  {timeStr}
                                </span>
                              </div>

                              {payload.details && (
                                <p className="text-xs text-gray-700 line-clamp-2">
                                  {payload.details}
                                </p>
                              )}

                              {/* Key Metrics Chips */}
                              <div className="flex flex-wrap gap-2 pt-1 text-[10px] text-gray-500 font-medium">
                                {payload.turnout && (
                                  <span className="bg-gray-100 px-2 py-0.5 rounded-md">
                                    Turnout: <strong>{payload.turnout}</strong>
                                  </span>
                                )}
                                {payload.security && (
                                  <span className="bg-gray-100 px-2 py-0.5 rounded-md">
                                    Security: <strong>{payload.security}</strong>
                                  </span>
                                )}
                                {payload.bvasFunctioning !== undefined && (
                                  <span className={`px-2 py-0.5 rounded-md ${payload.bvasFunctioning ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                    BVAS: {payload.bvasFunctioning ? 'Working' : 'Malfunction'}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: ATTENDANCE & GPS LOGS */}
                {activeTab === 'attendance' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                        Station Check-In & Location History
                      </h4>
                      <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                        observer.checkInStatus === 'checked_in'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {observer.checkInStatus?.replace('_', ' ') || 'Not Checked In'}
                      </span>
                    </div>

                    {/* Current Live Status Block */}
                    {observer.checkInLat && observer.checkInLng ? (
                      <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-100 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                            <Navigation className="w-4 h-4 text-emerald-600" />
                            <span>Live GPS Lock Verified</span>
                          </div>
                          <a
                            href={`https://www.google.com/maps?q=${observer.checkInLat},${observer.checkInLng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
                          >
                            <span>Open Map</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                          <p className="text-gray-600">Lat: <strong className="text-gray-900">{observer.checkInLat.toFixed(5)}</strong></p>
                          <p className="text-gray-600">Lng: <strong className="text-gray-900">{observer.checkInLng.toFixed(5)}</strong></p>
                        </div>
                        {observer.checkInTimestamp && (
                          <p className="text-[11px] text-gray-500">
                            Logged: {format(new Date(observer.checkInTimestamp), 'MMM d, yyyy HH:mm:ss')}
                          </p>
                        )}
                        {observer.checkInNotes && (
                          <p className="text-xs text-gray-700 bg-white/70 p-2.5 rounded-xl border border-emerald-100/50 mt-1">
                            "{observer.checkInNotes}"
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-xs text-amber-800 space-y-1">
                        <p className="font-bold">No active GPS coordinates recorded</p>
                        <p className="text-amber-700 text-[11px]">
                          Observer has not transmitted a location check-in signal from their field device today.
                        </p>
                      </div>
                    )}

                    {/* Historical Check-In Logs */}
                    <div className="space-y-2 pt-2">
                      <p className="text-xs font-bold text-gray-700">Check-In Timeline</p>
                      {checkIns.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">No historical check-in audit records found.</p>
                      ) : (
                        <div className="space-y-2">
                          {checkIns.map((ci) => {
                            let ciTime = 'Recent';
                            try {
                              const d = typeof ci.timestamp === 'string' ? new Date(ci.timestamp) : (ci.timestamp as any).toDate?.();
                              if (d) ciTime = format(d, 'MMM d, HH:mm:ss');
                            } catch (e) {
                              // ignore
                            }

                            return (
                              <div key={ci.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-gray-800">{ci.pollingUnitName || ci.pollingUnitId}</span>
                                  <span className="text-[10px] text-gray-400">{ciTime}</span>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-gray-500">
                                  <span className="capitalize">{ci.status?.replace('_', ' ')}</span>
                                  {ci.latitude && ci.longitude && (
                                    <span>• GPS: {ci.latitude.toFixed(4)}, {ci.longitude.toFixed(4)}</span>
                                  )}
                                </div>
                                {ci.notes && (
                                  <p className="text-gray-600 text-[11px] italic">"{ci.notes}"</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Drawer Bottom Admin Control Footer */}
              <div className="p-5 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-3">
                {onToggleStatus ? (
                  isSuspended ? (
                    <button
                      type="button"
                      onClick={() => onToggleStatus(observer, 'active')}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer"
                    >
                      Reactivate Account
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onToggleStatus(observer, 'suspended')}
                      className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl font-bold text-xs transition-all cursor-pointer"
                    >
                      Suspend Field Access
                    </button>
                  )
                ) : <div />}

                <div className="flex items-center gap-2">
                  {onUpgradeRole && (
                    <button
                      type="button"
                      onClick={() => onUpgradeRole(observer)}
                      className="px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Upgrade Access</span>
                    </button>
                  )}
                  {onEditAssignment && (
                    <button
                      type="button"
                      onClick={() => onEditAssignment(observer)}
                      className="px-4 py-2.5 bg-white hover:bg-gray-100 text-gray-800 border border-gray-200 rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-gray-500" />
                      <span>Assign Station</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-all cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
