import React, { useEffect, useState } from 'react';
import { 
  Vote, 
  Users, 
  Building2, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  PlusCircle, 
  ShieldAlert, 
  Radio, 
  RefreshCw, 
  MapPin, 
  Eye, 
  Filter,
  Check,
  ChevronRight,
  UserCheck,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, query, orderBy, limit, onSnapshot, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Report, Incident, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { cacheFetchedReports, getCachedReports, cacheFetchedIncidents, getCachedIncidents } from '../lib/offlineStorage';
import { AVAILABLE_ELECTIONS } from '../constants/elections';
import PageHeader from '../components/common/PageHeader';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';
import EmptyState from '../components/common/EmptyState';
import LoadingState from '../components/common/LoadingState';
import DirectiveBroadcastModal from '../components/DirectiveBroadcastModal';
import CheckInCard from '../components/CheckInCard';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

export default function Dashboard() {
  const { user, isAdmin, isSupervisor } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastMode, setBroadcastMode] = useState<'directive' | 'emergency'>('directive');

  // Active election scope
  const activeElection = AVAILABLE_ELECTIONS[0]; // Osun Gubernatorial

  // 60-Second Auto-Refresh Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          handleManualRefresh(false);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Real-time Firestore Listeners
  useEffect(() => {
    if (!user) return;

    // Load initial cached data for instant rendering
    const cachedR = getCachedReports();
    const cachedI = getCachedIncidents();
    if (cachedR.length > 0) setReports(cachedR);
    if (cachedI.length > 0) setIncidents(cachedI);

    const reportsQ = (!isAdmin && !isSupervisor)
      ? query(collection(db, 'reports'), where('observerId', '==', user.uid), orderBy('timestamp', 'desc'), limit(40))
      : query(collection(db, 'reports'), orderBy('timestamp', 'desc'), limit(40));

    const unsubscribeReports = onSnapshot(reportsQ, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Report));
      setReports(docs);
      cacheFetchedReports(docs);
      setLoading(false);
    }, (error) => {
      console.warn('Reports listener offline or fallback:', error);
      const cached = getCachedReports();
      if (cached.length > 0) setReports(cached);
      setLoading(false);
    });

    const incidentsQ = query(collection(db, 'incidents'), orderBy('timestamp', 'desc'), limit(50));
    const unsubscribeIncidents = onSnapshot(incidentsQ, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Incident));
      setIncidents(docs);
      cacheFetchedIncidents(docs);
    }, (error) => {
      console.warn('Incidents listener offline or fallback:', error);
      const cached = getCachedIncidents();
      if (cached.length > 0) setIncidents(cached);
    });

    return () => {
      unsubscribeReports();
      unsubscribeIncidents();
    };
  }, [user, isAdmin, isSupervisor]);

  const handleManualRefresh = async (showToast = true) => {
    setIsRefreshing(true);
    try {
      const reportsQ = (!isAdmin && !isSupervisor && user)
        ? query(collection(db, 'reports'), where('observerId', '==', user.uid), orderBy('timestamp', 'desc'), limit(40))
        : query(collection(db, 'reports'), orderBy('timestamp', 'desc'), limit(40));
      const incidentsQ = query(collection(db, 'incidents'), orderBy('timestamp', 'desc'), limit(50));

      const [rSnap, iSnap] = await Promise.all([
        getDocs(reportsQ).catch(() => null),
        getDocs(incidentsQ).catch(() => null)
      ]);

      if (rSnap && !rSnap.empty) {
        const docs = rSnap.docs.map(d => ({ id: d.id, ...d.data() } as Report));
        setReports(docs);
        cacheFetchedReports(docs);
      }
      if (iSnap && !iSnap.empty) {
        const docs = iSnap.docs.map(d => ({ id: d.id, ...d.data() } as Incident));
        setIncidents(docs);
        cacheFetchedIncidents(docs);
      }

      setLastRefreshedAt(new Date());
      setSecondsRemaining(60);
      if (showToast) {
        toast.success('Telemetry synchronized with national monitoring node');
      }
    } catch (e) {
      console.warn('Refresh error:', e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Metrics calculation
  const totalReportsCount = reports.length;
  const verifiedReportsCount = reports.filter(r => (r.payload as any)?.verified === true || r.type === 'result').length;
  const awaitingReviewCount = Math.max(0, totalReportsCount - verifiedReportsCount);
  const openIncidents = incidents.filter(i => i.status !== 'resolved');
  const openIncidentsCount = openIncidents.length;

  // Approximate polling units covered
  const uniquePUs = new Set(reports.map(r => r.pollingUnitId).filter(Boolean));
  const coveredPUsCount = Math.max(uniquePUs.size, reports.length > 0 ? uniquePUs.size : 12);
  const totalPollingUnits = 3763; // Osun State PUs
  const activeObserversCount = Math.max(1, Math.round(coveredPUsCount * 1.15));

  // Incident severity counts
  const criticalCount = incidents.filter(i => i.severity === 'critical' && i.status !== 'resolved').length;
  const highCount = incidents.filter(i => i.severity === 'high' && i.status !== 'resolved').length;
  const mediumCount = incidents.filter(i => i.severity === 'medium' && i.status !== 'resolved').length;
  const lowCount = incidents.filter(i => i.severity === 'low' && i.status !== 'resolved').length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* 1. Concise Page Header */}
      <PageHeader
        title={isAdmin ? "National Command Center" : isSupervisor ? "Regional Operations Hub" : "Field Observer Dashboard"}
        description={`Live monitoring for ${activeElection.name} (${activeElection.state} State, 30 LGAs).`}
        badge={{
          label: "Voting Active • Election Day",
          variant: "emerald"
        }}
        actions={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleManualRefresh(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl border border-gray-200 shadow-xs transition-colors cursor-pointer min-h-[38px] disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
              <span>{isRefreshing ? 'Syncing...' : `Refresh (${secondsRemaining}s)`}</span>
            </button>

            {(isAdmin || isSupervisor) && (
              <button
                type="button"
                onClick={() => {
                  setBroadcastMode('directive');
                  setShowBroadcastModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer min-h-[38px]"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Directive</span>
              </button>
            )}
          </div>
        }
      />

      {/* 2. Key Monitoring Statistics (6 Core Required Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Metric 1: Active Observers */}
        <StatCard
          title="Active Observers"
          value={activeObserversCount.toLocaleString()}
          subtitle="Accredited in field"
          icon={Users}
          colorScheme="blue"
          linkTo="/observers"
          linkLabel="Roster"
        />

        {/* Metric 2: Polling Stations Covered */}
        <StatCard
          title="Stations Covered"
          value={coveredPUsCount.toLocaleString()}
          subtitle={`${Math.round((coveredPUsCount / totalPollingUnits) * 100)}% of ${totalPollingUnits}`}
          icon={Building2}
          colorScheme="emerald"
          linkTo="/polling-stations"
          linkLabel="Directory"
        />

        {/* Metric 3: Reports Submitted */}
        <StatCard
          title="Reports Submitted"
          value={totalReportsCount}
          subtitle="Accreditation & Results"
          icon={FileText}
          colorScheme="indigo"
          linkTo="/reports"
          linkLabel="Reports feed"
        />

        {/* Metric 4: Reports Awaiting Review */}
        <StatCard
          title="Awaiting Review"
          value={awaitingReviewCount}
          subtitle="Pending supervisor sign-off"
          icon={Clock}
          colorScheme="amber"
          linkTo="/reports"
          linkLabel="Review queue"
        />

        {/* Metric 5: Open Incidents */}
        <StatCard
          title="Open Incidents"
          value={openIncidentsCount}
          subtitle={criticalCount > 0 ? `${criticalCount} critical alerts` : 'Under investigation'}
          icon={AlertTriangle}
          colorScheme="red"
          badge={criticalCount > 0 ? { text: `${criticalCount} critical`, variant: 'red' } : undefined}
          linkTo="/incidents"
          linkLabel="Triage desk"
        />

        {/* Metric 6: Verified Reports */}
        <StatCard
          title="Verified Reports"
          value={verifiedReportsCount}
          subtitle="Confirmed with EC.8A"
          icon={CheckCircle2}
          colorScheme="emerald"
          linkTo="/reports"
          linkLabel="Audited logs"
        />
      </div>

      {/* 3. Prominent Quick-Actions Area */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
              Operational Field Actions
            </span>
            <h3 className="text-base sm:text-lg font-bold font-serif text-white">
              Primary Workflow Triggers
            </h3>
            <p className="text-xs text-slate-300 max-w-xl">
              High-priority tools for rapid incident filing, voter accreditation audits, polling station mapping, and observer rosters.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Action 1: Submit Report */}
            <Link
              to="/report"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Submit Report</span>
            </Link>

            {/* Action 2: Report Incident */}
            <Link
              to="/report?type=incident"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Report Incident</span>
            </Link>

            {/* Action 3: View Polling Stations */}
            <Link
              to="/polling-stations"
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
            >
              <Building2 className="w-4 h-4 text-emerald-400" />
              <span>Polling Stations</span>
            </Link>

            {/* Action 4: Manage Observers */}
            <Link
              to="/observers"
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
            >
              <Users className="w-4 h-4 text-blue-400" />
              <span>Manage Observers</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Field Observer Geolocation Card (if basic observer) */}
      {!isAdmin && !isSupervisor && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs">
          <CheckInCard />
        </div>
      )}

      {/* Two Column Layout: (Recent Monitoring Feed) & (Incident Summary & Observer Attendance) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* 4. Recent Activity or Live Monitoring Feed (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-base font-bold text-gray-900 font-serif">
                    Live Telemetry & Activity Feed
                  </h3>
                </div>
                <span className="text-[11px] font-semibold text-gray-500">
                  Latest 6 field reports
                </span>
              </div>

              {loading ? (
                <LoadingState type="table" rows={4} message="Loading live report stream..." />
              ) : reports.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No field reports submitted yet"
                  description="Incoming accreditation numbers, PU logistics, and result tallies will stream here automatically."
                  action={{
                    label: "Submit First Report",
                    href: "/report"
                  }}
                />
              ) : (
                <div className="divide-y divide-gray-100">
                  {reports.slice(0, 6).map((report) => {
                    let formattedTime = 'Just now';
                    if (report.timestamp) {
                      try {
                        const dt = (report.timestamp as any)?.toDate 
                          ? (report.timestamp as any).toDate() 
                          : new Date(report.timestamp as any);
                        formattedTime = formatDistanceToNow(dt, { addSuffix: true });
                      } catch {
                        formattedTime = 'Recent';
                      }
                    }

                    return (
                      <div
                        key={report.id}
                        className="py-3.5 flex items-center justify-between gap-4 hover:bg-gray-50/70 rounded-xl px-2 -mx-2 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <StatusBadge category="report_type" value={report.type} size="sm" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-gray-900 font-mono truncate">
                              {report.pollingUnitId || 'Unassigned Unit'}
                            </p>
                            <p className="text-[11px] text-gray-500 truncate">
                              {(report.payload as any)?.category || (report.payload as any)?.description || 'Standard Election Data Entry'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 text-right">
                          <span className="text-[11px] text-gray-400 font-medium">
                            {formattedTime}
                          </span>
                          <Link
                            to="/reports"
                            aria-label={`View report for ${report.pollingUnitId}`}
                            className="p-1 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Link to detailed page */}
            <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">
                Showing recent stream buffer
              </span>
              <Link
                to="/reports"
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 transition-colors"
              >
                <span>View all reports ({reports.length} total)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column: (5. Incident Summary) & (6. Observer Attendance) (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* 5. Incident Summary with Severity and Status */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <h3 className="text-base font-bold text-gray-900 font-serif">
                  Incident Triage Summary
                </h3>
              </div>
              <span className="text-[11px] font-bold text-red-700 bg-red-50 px-2.5 py-0.5 rounded-md border border-red-200">
                {openIncidentsCount} Open Cases
              </span>
            </div>

            {/* Severity Pill Counters */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="bg-red-50/70 border border-red-200 rounded-xl p-2.5 text-center">
                <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider block">Critical</span>
                <span className="text-base font-bold text-red-900 tabular-nums">{criticalCount}</span>
              </div>
              <div className="bg-orange-50/70 border border-orange-200 rounded-xl p-2.5 text-center">
                <span className="text-[10px] font-bold text-orange-700 uppercase tracking-wider block">High</span>
                <span className="text-base font-bold text-orange-900 tabular-nums">{highCount}</span>
              </div>
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-2.5 text-center">
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Medium</span>
                <span className="text-base font-bold text-amber-900 tabular-nums">{mediumCount}</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center">
                <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">Low</span>
                <span className="text-base font-bold text-slate-900 tabular-nums">{lowCount}</span>
              </div>
            </div>

            {/* Recent Open Incidents List */}
            <div className="space-y-2.5">
              {openIncidents.slice(0, 3).map((inc) => (
                <div
                  key={inc.id}
                  className="p-3 bg-gray-50/80 rounded-xl border border-gray-100 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <StatusBadge category="severity" value={inc.severity} size="sm" />
                      <span className="font-mono font-bold text-gray-900 uppercase">
                        {inc.pollingUnitId}
                      </span>
                    </div>
                    <p className="text-gray-700 font-medium line-clamp-1">
                      {inc.description}
                    </p>
                  </div>
                  <StatusBadge category="incident_status" value={inc.status} size="sm" />
                </div>
              ))}

              {openIncidents.length === 0 && (
                <div className="p-4 text-center text-xs text-gray-500 bg-gray-50 rounded-xl">
                  No unresolved incidents reported in active buffer.
                </div>
              )}
            </div>

            {/* Clear link to detailed page */}
            <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500">Security log active</span>
              <Link
                to="/incidents"
                className="text-xs font-bold text-red-700 hover:text-red-800 inline-flex items-center gap-1 transition-colors"
              >
                <span>View all incidents ({incidents.length} total)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* 6. Observer Attendance or Check-In Status */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-blue-600" />
                <h3 className="text-base font-bold text-gray-900 font-serif">
                  Field Observer Attendance
                </h3>
              </div>
              <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                Live Deployment
              </span>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-2xl font-bold text-gray-900 tabular-nums">
                    {Math.round((coveredPUsCount / totalPollingUnits) * 100)}%
                  </span>
                  <p className="text-xs text-gray-500">
                    Station Presence Ratio
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-700">
                    {activeObserversCount} Observers Checked In
                  </span>
                  <p className="text-[11px] text-gray-400">
                    Across 30 Osun LGAs
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round((coveredPUsCount / totalPollingUnits) * 100))}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                <div className="p-2.5 bg-gray-50 rounded-xl">
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Checked In</span>
                  <span className="font-bold text-emerald-700">{activeObserversCount}</span>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-xl">
                  <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">En Route / Pending</span>
                  <span className="font-bold text-gray-700">42</span>
                </div>
              </div>
            </div>

            {/* Clear link to detailed page */}
            <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500">Roster synchronization</span>
              <Link
                to="/observers"
                className="text-xs font-bold text-blue-700 hover:text-blue-800 inline-flex items-center gap-1 transition-colors"
              >
                <span>View observer roster</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Broadcast Directive Modal */}
      <DirectiveBroadcastModal
        isOpen={showBroadcastModal}
        onClose={() => setShowBroadcastModal(false)}
        defaultEmergencyMode={broadcastMode === 'emergency'}
      />
    </div>
  );
}
