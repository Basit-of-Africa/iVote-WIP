import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User } from '../types';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import {
  Vote,
  ShieldCheck,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Info,
  Clock,
  MapPin,
  Users,
  Search,
  Filter,
  ArrowRight,
  LogIn,
  Globe,
  RefreshCw,
  BarChart3,
  PieChart as PieIcon,
  Radio,
  FileText,
  ChevronRight,
  ShieldAlert,
  SlidersHorizontal,
  LayoutDashboard
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

import OsunCountdown from '../components/OsunCountdown';
import ObserverFAB from '../components/ObserverFAB';

// Dedicated display interface for the public live feed (Zero Observer PII)
export interface PublicDisplayReport {
  id: string;
  pollingUnitId: string;
  pollingUnitName: string;
  type: 'accreditation' | 'incident' | 'result' | 'warning' | 'normal' | 'info';
  state?: string;
  lga?: string;
  ward?: string;
  details: string;
  turnout?: string;
  security?: string;
  accreditation?: string;
  materials?: string;
  incidents?: string;
  timestamp: string;
  observerKey?: string;
}

function parseFirestoreReport(doc: any): PublicDisplayReport {
  const payload = doc.payload || {};
  let timestampStr = new Date().toISOString();
  if (doc.timestamp) {
    if (typeof doc.timestamp === 'object' && 'toDate' in doc.timestamp) {
      timestampStr = doc.timestamp.toDate().toISOString();
    } else {
      timestampStr = String(doc.timestamp);
    }
  }

  let detailsText = typeof payload === 'string'
    ? payload
    : (payload.description || payload.details || 'Observation reported from field.');

  // If it's a result report with vote counts, append summary tally
  if (doc.type === 'result' && (payload.apcVotes !== undefined || payload.pdpVotes !== undefined || payload.lpVotes !== undefined)) {
    const counts: string[] = [];
    if (payload.apcVotes !== undefined) counts.push(`APC: ${payload.apcVotes}`);
    if (payload.pdpVotes !== undefined) counts.push(`PDP: ${payload.pdpVotes}`);
    if (payload.lpVotes !== undefined) counts.push(`LP: ${payload.lpVotes}`);
    if (payload.nnppVotes !== undefined) counts.push(`NNPP: ${payload.nnppVotes}`);
    if (payload.otherVotes !== undefined) counts.push(`Others: ${payload.otherVotes}`);
    if (counts.length > 0) {
      detailsText = `${detailsText} [Tally: ${counts.join(' | ')}]`;
    }
  }

  let reportType: PublicDisplayReport['type'] = 'normal';
  if (doc.type === 'incident') reportType = 'incident';
  else if (doc.type === 'accreditation') reportType = 'accreditation';
  else if (doc.type === 'result') reportType = 'info';

  const puId = doc.pollingUnitId || payload.pollingUnitId || 'PU-FIELD';
  let inferredState = payload.state || doc.state || 'Osun';
  if (puId.startsWith('OS/') || puId.toLowerCase().includes('osun')) {
    inferredState = 'Osun';
  }

  return {
    id: doc.id,
    pollingUnitId: puId,
    pollingUnitName: payload.pollingUnitName || payload.pu || puId,
    type: reportType,
    state: inferredState,
    lga: payload.lga || '',
    ward: payload.ward || '',
    details: detailsText,
    turnout: payload.turnout || (payload.voterCount ? `${payload.voterCount} Registered` : 'Moderate'),
    security: payload.security || (doc.type === 'incident' ? (payload.severity ? `${payload.severity.toUpperCase()} ALERT` : 'Flagged') : 'Peaceful'),
    accreditation: payload.accreditation || 'Smooth',
    materials: payload.materials || 'Complete',
    incidents: payload.incidents || (doc.type === 'incident' ? detailsText : undefined),
    timestamp: timestampStr,
    observerKey: doc.observerId || payload.observerId || puId,
  };
}

export default function LandingPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<PublicDisplayReport[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter Controls
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');

  // Live Clock State
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // 1. Clock Ticker
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    // 2. Fetch Live Reports from Firestore
    const unsubscribeReports = onSnapshot(collection(db, 'reports'), (snapshot) => {
      const parsedDocs = snapshot.docs.map(doc => parseFirestoreReport({ id: doc.id, ...doc.data() }));

      const sorted = parsedDocs.sort((a, b) => {
        const timeA = new Date(a.timestamp || 0).getTime();
        const timeB = new Date(b.timestamp || 0).getTime();
        return timeB - timeA;
      });

      setReports(sorted);
      setLoading(false);
    }, (error) => {
      console.warn('Firestore reports error on landing page:', error);
      setReports([]);
      setLoading(false);
    });

    // 3. Fetch Users for Active Observers metric
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const uDocs = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
      setUsers(uDocs);
    }, (error) => {
      console.warn('Firestore users error on landing page:', error);
    });

    return () => {
      clearInterval(timer);
      unsubscribeReports();
      unsubscribeUsers();
    };
  }, []);

  // Filtered Reports (Zero Observer PII in search)
  const filteredReports = reports.filter(r => {
    const matchesSearch =
      (r.details && r.details.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.pollingUnitName && r.pollingUnitName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.pollingUnitId && r.pollingUnitId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.lga && r.lga.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.ward && r.ward.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.state && r.state.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = typeFilter === 'all' || r.type === typeFilter;
    const matchesState = stateFilter === 'all' || r.state === stateFilter;

    return matchesSearch && matchesType && matchesState;
  });

  // Calculate Metrics from real Firestore stream
  const totalReportsCount = reports.length;
  const incidentCount = reports.filter(r => r.type === 'incident').length;
  const warningCount = reports.filter(r => r.type === 'warning').length;
  const normalCount = reports.filter(r => r.type === 'normal' || r.type === 'accreditation').length;
  const infoCount = reports.filter(r => r.type === 'info').length;

  // Observers onboarded in the directory
  const onboardedObserversCount = users.filter(u => u.role === 'observer' || u.role === 'field_supervisor' || u.role === 'supervisor' || !u.role).length;
  const activeObserversCount = onboardedObserversCount;

  const statesReportingCount = new Set(reports.map(r => r.state).filter(Boolean)).size || 1;

  // Chart Data: Category Donut
  const categoryData = [
    { name: 'Normal', value: normalCount, color: '#141A56' },
    { name: 'Incident', value: incidentCount, color: '#EF4444' },
    { name: 'Warning', value: warningCount, color: '#F59E0B' },
    { name: 'Information', value: infoCount, color: '#3B82F6' },
  ];

  // Chart Data: Security Situation Bar
  const securityCounts = reports.reduce((acc, r) => {
    const sec = r.security || 'Peaceful';
    acc[sec] = (acc[sec] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const securityChartData = [
    { name: 'Peaceful', count: securityCounts['Peaceful'] || 0, fill: '#141A56' },
    { name: 'Tense', count: securityCounts['Tense'] || 0, fill: '#F59E0B' },
    { name: 'Violent', count: securityCounts['Violent'] || 0, fill: '#EF4444' },
  ];

  // Dynamic Polling Unit Status Cells derived from real field submissions
  const dynamicHeatmapCells = useMemo(() => {
    const map = new Map<string, { id: string; name: string; state: string; status: 'normal' | 'warning' | 'incident' | 'critical'; label: string }>();
    reports.forEach((r, idx) => {
      const puId = r.pollingUnitId || `PU-${idx + 1}`;
      if (!map.has(puId)) {
        let status: 'normal' | 'warning' | 'incident' | 'critical' = 'normal';
        let label = 'Normal';
        if (r.type === 'incident') {
          const det = (r.details || '').toLowerCase();
          status = det.includes('critical') || det.includes('snatch') || det.includes('violence') ? 'critical' : 'incident';
          label = r.incidents || 'Incident Reported';
        } else if (r.type === 'warning') {
          status = 'warning';
          label = 'Caution';
        }
        map.set(puId, {
          id: puId,
          name: puId,
          state: r.state || 'Field',
          status,
          label
        });
      }
    });
    return Array.from(map.values());
  }, [reports]);

  // State Breakdown List
  const stateCounts = reports.reduce((acc, r) => {
    if (r.state) {
      acc[r.state] = (acc[r.state] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const topStates = Object.entries(stateCounts)
    .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))
    .slice(0, 6);

  const maxStateReport = (Number(topStates[0]?.[1]) || 1);

  // Recent High Severity Alert
  const recentIncident = reports.find(r => r.type === 'incident');

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-gray-900 font-sans flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Accessible Skip Link */}
      <a 
        href="#public-live-stream-content" 
        className="sr-only-focusable z-50 p-4 bg-[#141A56] text-white font-bold rounded-xl shadow-2xl fixed top-4 left-4 focus:ring-4 focus:ring-emerald-400"
      >
        Skip to live election feed
      </a>

      {/* 1. TOP OFFICIAL HEADER BAR */}
      <header role="banner" className="bg-[#141A56] text-white border-b border-indigo-900/80 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-16 py-2.5 sm:py-0 flex items-center justify-between gap-3 sm:gap-4">
          {/* Brand & Crest */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-indigo-800 text-white font-black flex items-center justify-center text-lg sm:text-xl shadow-md border border-indigo-600 shrink-0">
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-white" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="font-bold text-base sm:text-lg tracking-tight font-serif text-white leading-tight truncate">
                  iVote
                </h1>
                <span className="inline-block px-1.5 sm:px-2 py-0.5 bg-indigo-950/80 text-indigo-200 text-[9px] sm:text-[10px] font-mono font-bold uppercase rounded-md border border-indigo-800/60 shrink-0">
                  LIVE
                </span>
              </div>
              <p className="hidden sm:block text-[11px] text-indigo-200/80 font-medium truncate">
                Civilian Watch & Real-Time Electoral Transmission Hub
              </p>
            </div>
          </div>

          {/* Right Action & Clock */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Live Clock Ticker */}
            <div className="hidden md:flex items-center gap-2 bg-emerald-950/80 px-3 py-1.5 rounded-xl border border-emerald-800/80 text-xs font-mono text-emerald-200" aria-label="Current West Africa Time">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
              <span>{format(currentTime, 'HH:mm:ss')} WAT</span>
            </div>

            {/* Auth Button */}
            {user ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="hidden lg:inline-block text-xs font-semibold text-emerald-200">
                  Logged in: <strong className="text-white">{user.displayName}</strong>
                </span>
                <Link
                  to="/dashboard"
                  aria-label="Go to authorized user workspace"
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md border border-emerald-500 transition-all uppercase tracking-wider min-h-[40px] sm:min-h-[44px]"
                >
                  <LayoutDashboard className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Workspace</span>
                </Link>
              </div>
            ) : (
              <Link
                to="/login"
                aria-label="Sign in to observer portal"
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-lg shadow-emerald-950/20 border border-emerald-500 transition-all uppercase tracking-wider group min-h-[40px] sm:min-h-[44px]"
              >
                <LogIn className="w-4 h-4 group-hover:translate-x-0.5 transition-transform shrink-0" aria-hidden="true" />
                <span>Sign in</span>
              </Link>
            )}
          </div>
        </div>

        {/* Sub-bar: Public Status Banner */}
        <div className="bg-[#10108c] px-4 py-1.5 sm:py-2 text-xs font-medium text-blue-100 border-t border-indigo-900/80">
          <div className="max-w-7xl mx-auto w-full flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <Radio className="w-3.5 h-3.5 text-[#FC560C] animate-pulse shrink-0" aria-hidden="true" />
              <span className="font-bold text-white uppercase text-[9px] sm:text-xs tracking-wider sm:tracking-widest truncate">
                PUBLIC LIVE TRANSMISSION FEED — 2026 GENERAL ELECTIONS
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-[11px] text-[#FC560C] font-semibold shrink-0">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#FC560C] animate-ping shrink-0" aria-hidden="true" />
                Verified Observer Telemetry
              </span>
              <span className="text-white/30" aria-hidden="true">•</span>
              <span>36 States + FCT Coverage</span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="bg-gradient-to-b from-[#141A56] via-[#101548] to-[#0a0c2e] text-white py-8 sm:py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#6272c0_1px,transparent_1px)] [background-size:16px_16px]" />

        <div className="max-w-7xl mx-auto relative z-10 space-y-5 sm:space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 sm:gap-6">
            <div className="max-w-3xl space-y-2.5 sm:space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-full text-xs font-bold uppercase tracking-widest">
                <Activity className="w-3.5 h-3.5 shrink-0" /> Real-Time Electoral Audit
              </div>
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight font-serif text-white leading-tight">
                Public Live Election Observation & Incident Stream
              </h2>
              <p className="text-emerald-100/90 text-xs sm:text-base font-light max-w-2xl leading-relaxed">
                Direct, unedited observation reports transmitted from accredited field personnel across Nigeria. Access real-time voter turnout, BVAS operational status, and security metrics.
              </p>
            </div>

            {/* Quick Action Box */}
            <div className="bg-white/10 backdrop-blur-md p-4 sm:p-5 rounded-3xl border border-white/20 flex flex-col gap-2.5 sm:gap-3 shrink-0 w-full md:w-80 shadow-xl">
              <div className="flex items-center justify-between text-xs text-emerald-100 font-semibold">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                  Field Deployment Status
                </span>
                <span className="text-emerald-400 font-mono font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                  LIVE
                </span>
              </div>
              <div className="text-xl sm:text-3xl font-extrabold font-serif text-white tracking-tight flex items-baseline gap-2 flex-wrap">
                <span className="text-white font-mono font-black">{onboardedObserversCount.toLocaleString()}</span>
                <span className="text-xs sm:text-sm font-sans font-bold text-white uppercase tracking-wider">Observers Deployed</span>
              </div>
              <p className="text-[11px] text-emerald-200/90 leading-relaxed">
                Accredited civilian monitors active across polling units nationwide in real time.
              </p>
              {!user && (
                <Link
                  to="/login"
                  className="mt-1 w-full text-center py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-all border border-emerald-500 uppercase tracking-wider min-h-[40px] flex items-center justify-center"
                >
                  Submit Report (Observer Login)
                </Link>
              )}
            </div>
          </div>

          {/* FEATURED RACE COUNTDOWN - OSUN STATE GUBERNATORIAL ELECTION */}
          <div className="pt-1 sm:pt-2">
            <OsunCountdown />
          </div>

          {/* KPI CARDS GRID */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 pt-2 sm:pt-4">
            <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-5 rounded-2xl border border-white/15">
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider sm:tracking-widest text-emerald-200 block truncate">Total Reports</span>
              <div className="text-2xl sm:text-3xl font-extrabold font-serif text-white mt-0.5 sm:mt-1">{totalReportsCount}</div>
              <p className="text-[10px] sm:text-[11px] text-emerald-300/80 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" /> <span className="truncate">Synchronized</span>
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-5 rounded-2xl border border-white/15">
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider sm:tracking-widest text-red-200 block truncate">Incidents / Warnings</span>
              <div className="text-2xl sm:text-3xl font-extrabold font-serif text-red-300 mt-0.5 sm:mt-1">{incidentCount + warningCount}</div>
              <p className="text-[10px] sm:text-[11px] text-red-200/80 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" /> <span className="truncate">{incidentCount} High Severity</span>
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-5 rounded-2xl border border-white/15">
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider sm:tracking-widest text-emerald-200 block truncate">Active Observers</span>
              <div className="text-2xl sm:text-3xl font-extrabold font-serif text-white mt-0.5 sm:mt-1">{activeObserversCount.toLocaleString()}</div>
              <p className="text-[10px] sm:text-[11px] text-emerald-300/80 mt-1 flex items-center gap-1">
                <Users className="w-3 h-3 text-emerald-400 shrink-0" /> <span className="truncate">Field Personnel</span>
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md p-3.5 sm:p-5 rounded-2xl border border-[#FC560C]/40 relative overflow-hidden group shadow-lg">
              <div className="absolute top-0 right-0 w-20 h-20 bg-[#FC560C]/15 rounded-full blur-xl pointer-events-none" />
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider sm:tracking-widest text-[#FC560C] block truncate">State Coverage</span>
              <div className="text-2xl sm:text-3xl font-extrabold font-serif text-white mt-0.5 sm:mt-1">{statesReportingCount}</div>
              <p className="text-[10px] sm:text-[11px] text-[#FC560C] font-bold mt-1 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-[#FC560C] shrink-0" /> <span className="truncate">Active Hubs</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. MAIN DASHBOARD CONTENT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6 sm:space-y-10 flex-1 w-full">
        {/* RECENT HIGH SEVERITY ALERT TICKER (If any incident exists) */}
        {recentIncident && (
          <div className="bg-red-950 text-white rounded-3xl p-4 sm:p-7 border-2 border-red-600/80 shadow-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 sm:gap-6 animate-in fade-in">
            <div className="flex items-start gap-3 sm:gap-4 min-w-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-red-600/30 border border-red-500/50 flex items-center justify-center text-red-400 shrink-0 animate-pulse mt-0.5 sm:mt-0">
                <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="space-y-2 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 bg-red-600 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-md shadow-sm">
                    URGENT INCIDENT ALERT
                  </span>
                  <span className="text-xs text-red-200 font-mono font-bold bg-red-900/60 px-2 py-0.5 rounded border border-red-700/50">
                    PU: {recentIncident.pollingUnitId || 'PU-INCIDENT'}
                  </span>
                  {recentIncident.lga && (
                    <span className="text-xs text-red-200 font-bold bg-red-900/60 px-2 py-0.5 rounded border border-red-700/50">
                      LGA: {recentIncident.lga}
                    </span>
                  )}
                  {recentIncident.state && (
                    <span className="text-xs text-red-300 font-semibold">
                      • {recentIncident.state} State
                    </span>
                  )}
                </div>
                
                <div>
                  <h4 className="font-bold text-white text-base sm:text-lg font-serif">
                    {recentIncident.incidents || 'Field Violation / Incident Report'}
                  </h4>
                  {recentIncident.pollingUnitName && recentIncident.pollingUnitName !== recentIncident.pollingUnitId && (
                    <p className="text-xs text-red-300 font-medium">
                      Location: {recentIncident.pollingUnitName} {recentIncident.ward ? `(Ward: ${recentIncident.ward})` : ''}
                    </p>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-red-100 font-medium line-clamp-2 max-w-3xl leading-relaxed bg-black/20 p-2.5 rounded-xl border border-red-800/40">
                  "{recentIncident.details}"
                </p>
              </div>
            </div>

            <Link
              to={user ? "/incidents" : "/login"}
              className="w-full md:w-auto px-5 py-3 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-2xl shadow-lg shadow-red-950/40 transition-all shrink-0 flex items-center justify-center gap-2 border border-red-400 min-h-[44px]"
            >
              <span>Verify Incident Details</span>
              <ChevronRight className="w-4 h-4 shrink-0" />
            </Link>
          </div>
        )}

        {/* 2:1 COLUMN LAYOUT: LIVE FEED VS BREAKDOWN CHARTS */}
        <div id="public-live-stream-content" tabIndex={-1} className="grid grid-cols-1 lg:grid-cols-3 gap-8 outline-none">
          {/* LEFT 2 COLUMNS: LIVE REPORTS STREAM */}
          <section aria-labelledby="live-stream-heading" className="lg:col-span-2 space-y-6">
            {/* Header & Filter Bar */}
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 id="live-stream-heading" className="text-xl font-bold text-gray-900 font-serif flex items-center gap-2">
                    <Radio className="w-5 h-5 text-emerald-600 animate-pulse" aria-hidden="true" />
                    Live Field Observation Stream
                  </h3>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">
                    Real-time observation logs from accredited monitors
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-800 font-bold text-xs rounded-full border border-emerald-100">
                    {filteredReports.length} {filteredReports.length === 1 ? 'Report' : 'Reports'}
                  </span>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                {/* Search */}
                <div className="relative flex-1">
                  <label htmlFor="public-stream-search" className="sr-only">
                    Search field reports by polling unit, LGA, state, or keywords
                  </label>
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                  <input
                    id="public-stream-search"
                    type="text"
                    placeholder="Search polling unit, LGA, state, or keywords..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-xs font-medium min-h-[44px]"
                  />
                </div>

                {/* Type Filter */}
                <div>
                  <label htmlFor="public-type-filter" className="sr-only">
                    Filter by Report Type
                  </label>
                  <select
                    id="public-type-filter"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full sm:w-auto px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 min-h-[44px]"
                  >
                    <option value="all">All Report Types</option>
                    <option value="accreditation">Accreditations</option>
                    <option value="incident">Incidents Only</option>
                    <option value="info">Results / Tallies</option>
                    <option value="normal">Field Observations</option>
                  </select>
                </div>

                {/* State Filter */}
                <div>
                  <label htmlFor="public-state-filter" className="sr-only">
                    Filter by State
                  </label>
                  <select
                    id="public-state-filter"
                    value={stateFilter}
                    onChange={(e) => setStateFilter(e.target.value)}
                    className="w-full sm:w-auto px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 min-h-[44px]"
                  >
                    <option value="all">All States</option>
                    <option value="Osun">Osun</option>
                    <option value="Edo">Edo</option>
                    <option value="Ondo">Ondo</option>
                    <option value="Lagos">Lagos</option>
                    <option value="Kano">Kano</option>
                    <option value="FCT">FCT</option>
                    <option value="Rivers">Rivers</option>
                    <option value="Oyo">Oyo</option>
                    <option value="Kaduna">Kaduna</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Reports List */}
            <div className="space-y-4">
              {loading ? (
                <div className="p-12 text-center bg-white rounded-3xl border border-gray-200 text-gray-400 space-y-3">
                  <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-medium">Connecting to live transmission feed...</p>
                </div>
              ) : filteredReports.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-3xl border border-gray-200 text-gray-500 space-y-2">
                  <FileText className="w-10 h-10 text-gray-300 mx-auto" />
                  <h4 className="font-bold text-gray-800 font-serif text-base">No matching observations</h4>
                  <p className="text-xs text-gray-400">Try clearing your filters or search terms.</p>
                </div>
              ) : (
                filteredReports.map((rpt) => {
                  const isIncident = rpt.type === 'incident';
                  const isWarning = rpt.type === 'warning';
                  const isInfo = rpt.type === 'info';

                  return (
                    <motion.div
                      key={rpt.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`bg-white p-6 rounded-3xl border shadow-sm transition-all hover:shadow-md ${
                        isIncident
                          ? 'border-red-200 bg-red-50/10'
                          : isWarning
                          ? 'border-amber-200 bg-amber-50/10'
                          : 'border-gray-200'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3 mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Severity Badge */}
                          <span className={`px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider rounded-lg ${
                            isIncident
                              ? 'bg-red-100 text-red-700 border border-red-200'
                              : isWarning
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : isInfo
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {rpt.type.toUpperCase()}
                          </span>

                          {/* Polling Unit Tag */}
                          <span className="px-2.5 py-1 bg-gray-100 text-gray-800 font-mono font-bold text-xs rounded-lg flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-emerald-600" />
                            {rpt.pollingUnitId || 'PU-UNASSIGNED'}
                          </span>

                          <span className="text-xs font-bold text-gray-700">
                            {rpt.state} {rpt.lga ? `› ${rpt.lga}` : ''}
                          </span>
                        </div>

                        {/* Relative Timestamp */}
                        <div className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {rpt.timestamp ? (
                            formatDistanceToNow(new Date(rpt.timestamp), { addSuffix: true })
                          ) : (
                            'Just now'
                          )}
                        </div>
                      </div>

                      {/* Polling Unit Name */}
                      {rpt.pollingUnitName && (
                        <h4 className="text-base font-bold text-gray-900 font-serif mb-2">
                          {rpt.pollingUnitName} {rpt.ward ? `— ${rpt.ward}` : ''}
                        </h4>
                      )}

                      {/* Details Narrative */}
                      <p className="text-sm text-gray-700 leading-relaxed font-sans mb-4">
                        {rpt.details}
                      </p>

                      {/* Incident Highlight box */}
                      {rpt.incidents && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-800 font-medium flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                          <span><strong>Flagged Incident:</strong> {rpt.incidents}</span>
                        </div>
                      )}

                      {/* Meta Tags Row */}
                      <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-2 border-t border-gray-100">
                        <div className="flex items-center gap-4 text-gray-500">
                          {rpt.turnout && (
                            <span>Turnout: <strong className="text-gray-800">{rpt.turnout}</strong></span>
                          )}
                          {rpt.security && (
                            <span>Security: <strong className={rpt.security === 'Peaceful' ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>{rpt.security}</strong></span>
                          )}
                          {rpt.accreditation && (
                            <span className="hidden sm:inline">Accreditation: <strong className="text-gray-800">{rpt.accreditation}</strong></span>
                          )}
                        </div>

                        <div className="text-gray-500 text-[11px] font-medium flex items-center gap-1.5 bg-slate-50 border border-slate-200/90 px-2.5 py-1 rounded-full">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="font-semibold text-slate-700">Verified Station Transmission</span>
                          <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">(PU Record)</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </section>

          {/* RIGHT 1 COLUMN: BREAKDOWN CHARTS & STATS */}
          <div className="space-y-6">
            {/* Category Donut Chart Card */}
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-gray-900 font-serif flex items-center gap-2 border-b border-gray-100 pb-3">
                <PieIcon className="w-4 h-4 text-emerald-600" />
                Report Category Distribution
              </h3>

              <div className="h-48 w-full relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-gray-600 pt-2 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                  <span>Normal ({normalCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
                  <span>Incidents ({incidentCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
                  <span>Warnings ({warningCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
                  <span>Info ({infoCount})</span>
                </div>
              </div>
            </div>

            {/* Top Reporting States Progress Bar */}
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-gray-900 font-serif flex items-center gap-2 border-b border-gray-100 pb-3">
                <BarChart3 className="w-4 h-4 text-emerald-600" />
                Top Transmitting States
              </h3>

              <div className="space-y-3">
                {topStates.map(([stName, count]) => {
                  const pct = Math.round(((Number(count) || 0) / (Number(maxStateReport) || 1)) * 100);
                  return (
                    <div key={stName} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold text-gray-700">
                        <span>{stName}</span>
                        <span className="font-mono text-gray-500">{count} reports</span>
                      </div>
                      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Security Situation Breakdown */}
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-gray-900 font-serif flex items-center gap-2 border-b border-gray-100 pb-3">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Security Assessment
              </h3>

              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={securityChartData}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* 4. POLLING UNIT HEATMAP MATRIX SECTION */}
        <section className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900 font-serif flex items-center gap-2">
                <Globe className="w-5 h-5 text-emerald-600" />
                Live Polling Unit Status Heatmap
              </h3>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                Real-time operational status of reporting polling units across electoral wards
              </p>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-bold">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-emerald-500" /> Normal</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-amber-400" /> Caution</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-orange-600" /> Incident</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-red-600" /> Critical</span>
            </div>
          </div>

          {dynamicHeatmapCells.length === 0 ? (
            <div className="py-12 px-4 text-center border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
              <Radio className="w-8 h-8 text-gray-400 mx-auto mb-2 animate-pulse" />
              <p className="text-sm font-bold text-gray-700">Awaiting Live Polling Unit Transmissions</p>
              <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
                As accredited field observers check in and submit observation reports, active polling unit telemetry blocks will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-3">
              {dynamicHeatmapCells.map((cell) => {
                const bg =
                  cell.status === 'normal' ? 'bg-emerald-500 hover:bg-emerald-600' :
                  cell.status === 'warning' ? 'bg-amber-400 hover:bg-amber-500' :
                  cell.status === 'incident' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-red-600 hover:bg-red-700';

                return (
                  <div
                    key={cell.id}
                    className={`${bg} h-14 rounded-2xl text-white p-2 text-center flex flex-col items-center justify-center transition-transform hover:scale-105 cursor-pointer shadow-xs group relative`}
                  >
                    <span className="text-[10px] font-mono font-bold truncate max-w-full">{cell.name}</span>
                    <span className="text-[9px] font-semibold opacity-80 truncate max-w-full">{cell.state}</span>

                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:block z-20 w-36 p-2 bg-gray-900 text-white text-[10px] rounded-xl shadow-xl pointer-events-none text-left">
                      <p className="font-bold">{cell.name}</p>
                      <p className="text-gray-300">{cell.state} — Status: {cell.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* 5. FOOTER */}
      <footer className="bg-[#141A56] text-white border-t border-indigo-900/80 py-8 px-4 sm:px-6 lg:px-8 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left text-xs text-indigo-200/80 font-medium">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-800 text-white font-bold flex items-center justify-center text-base border border-indigo-600">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-white text-sm font-serif">iVote</p>
              <p className="text-[11px] text-indigo-300/70 mt-0.5">Civilian Watch Network & Independent Electoral Transmission</p>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-6">
            <Link to="/login" className="hover:text-white transition-colors">Observer Login</Link>
            <span>•</span>
            <Link to="/login" className="hover:text-white transition-colors">Administrator Portal</Link>
            <span>•</span>
            <span className="text-indigo-300">iVote 2026 Edition</span>
          </div>

          <div className="text-[11px]">
            © 2026 iVote. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Floating quick action button for observers */}
      <ObserverFAB />
    </div>
  );
}
