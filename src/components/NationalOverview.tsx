import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Report, Incident, User, Severity, IncidentStatus } from '../types';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Line
} from 'recharts';
import {
  Globe2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Users,
  Activity,
  Filter,
  RefreshCw,
  Zap,
  TrendingUp,
  MapPin,
  Layers,
  BarChart3,
  Building2,
  Radio
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ElectionScopeSelector from './ElectionScopeSelector';
import { format, subHours, isAfter, startOfHour } from 'date-fns';

type TimeRange = '1h' | '6h' | '12h' | '24h' | 'all';
type ViewMode = 'all' | 'incidents' | 'stations';

const NIGERIAN_STATES = [
  'All States (National)',
  'Osun (Off-Cycle Guber)',
  'Lagos',
  'Kano',
  'Rivers',
  'FCT Abuja',
  'Oyo',
  'Enugu',
  'Kaduna',
  'Edo',
  'Plateau',
  'Anambra',
  'Delta',
  'Imo'
];

// Color palette for charts
const COLORS = {
  emerald: '#141A56',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  amber: '#f59e0b',
  red: '#ef4444',
  darkRed: '#991b1b',
  gray: '#6b7280'
};

const SEVERITY_COLORS = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#d97706',
  low: '#2563eb'
};

const STATUS_PIE_COLORS = [
  '#141A56', // Open & Accrediting
  '#3b82f6', // Voting In Progress
  '#8b5cf6', // Counting & Collation
  '#f59e0b', // Delayed / Materials Pending
  '#ef4444'  // Disrupted / Incident
];

interface NationalOverviewProps {
  lastRefreshedAt?: Date;
  refreshTrigger?: number;
  onManualRefreshParent?: () => void;
  secondsRemaining?: number;
  isAutoRefreshEnabled?: boolean;
}

export default function NationalOverview({
  lastRefreshedAt,
  refreshTrigger,
  onManualRefreshParent,
  secondsRemaining,
  isAutoRefreshEnabled
}: NationalOverviewProps = {}) {
  const [reports, setReports] = useState<Report[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [observers, setObservers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [selectedState, setSelectedState] = useState<string>('All States (National)');
  const [activeView, setActiveView] = useState<ViewMode>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [internalLastRefreshed, setInternalLastRefreshed] = useState<Date>(new Date());

  // Real-time Firestore Listeners
  useEffect(() => {
    let unsubscribeReports: () => void;
    let unsubscribeIncidents: () => void;
    let unsubscribeUsers: () => void;

    try {
      // 1. Reports stream
      const reportsQ = query(collection(db, 'reports'), orderBy('timestamp', 'desc'), limit(300));
      unsubscribeReports = onSnapshot(
        reportsQ,
        (snapshot) => {
          const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
          setReports(docs);
        },
        (error) => {
          console.warn('Reports stream fallback:', error);
          handleFirestoreError(error, OperationType.GET, 'reports');
        }
      );

      // 2. Incidents stream
      const incidentsQ = query(collection(db, 'incidents'), orderBy('timestamp', 'desc'), limit(200));
      unsubscribeIncidents = onSnapshot(
        incidentsQ,
        (snapshot) => {
          const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Incident));
          setIncidents(docs);
          setLoading(false);
        },
        (error) => {
          console.warn('Incidents stream fallback:', error);
          setLoading(false);
        }
      );

      // 3. Observers / Users stream
      const usersQ = query(collection(db, 'users'));
      unsubscribeUsers = onSnapshot(
        usersQ,
        (snapshot) => {
          const docs = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
          setObservers(docs);
        },
        (error) => console.warn('Users stream error:', error)
      );
    } catch (err) {
      console.warn('Firestore initial listen error:', err);
      setLoading(false);
    }

    return () => {
      if (unsubscribeReports) unsubscribeReports();
      if (unsubscribeIncidents) unsubscribeIncidents();
      if (unsubscribeUsers) unsubscribeUsers();
    };
  }, []);

  useEffect(() => {
    if (refreshTrigger) {
      setIsRefreshing(true);
      setInternalLastRefreshed(new Date());
      const timer = setTimeout(() => {
        setIsRefreshing(false);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [refreshTrigger]);

  const handleManualRefresh = () => {
    if (onManualRefreshParent) {
      onManualRefreshParent();
    } else {
      setIsRefreshing(true);
      setInternalLastRefreshed(new Date());
      setTimeout(() => {
        setIsRefreshing(false);
      }, 600);
    }
  };

  // Filter Firestore Data based on Time Range & Selected State
  const filteredData = useMemo(() => {
    const now = lastRefreshedAt || internalLastRefreshed || new Date();
    let cutoff = new Date(0); // All time

    if (timeRange === '1h') cutoff = subHours(now, 1);
    else if (timeRange === '6h') cutoff = subHours(now, 6);
    else if (timeRange === '12h') cutoff = subHours(now, 12);
    else if (timeRange === '24h') cutoff = subHours(now, 24);

    const filteredReports = reports.filter(r => {
      const rDate = r.timestamp ? new Date(typeof r.timestamp === 'string' ? r.timestamp : (r.timestamp as any).seconds * 1000) : new Date();
      const timeOk = timeRange === 'all' || isAfter(rDate, cutoff);
      const stateOk = selectedState === 'All States (National)' || (r.payload?.state === selectedState || r.payload?.lga?.toLowerCase().includes(selectedState.toLowerCase()));
      return timeOk && stateOk;
    });

    const filteredIncidents = incidents.filter(i => {
      const iDate = i.timestamp ? new Date(typeof i.timestamp === 'string' ? i.timestamp : (i.timestamp as any).seconds * 1000) : new Date();
      return timeRange === 'all' || isAfter(iDate, cutoff);
    });

    const filteredObservers = observers.filter(o => {
      return selectedState === 'All States (National)' || o.state === selectedState;
    });

    return {
      reports: filteredReports,
      incidents: filteredIncidents,
      observers: filteredObservers
    };
  }, [reports, incidents, observers, timeRange, selectedState]);

  // 1. Prepare Hourly Incident Trends Data for Recharts AreaChart purely from real incidents
  const incidentTrendsData = useMemo(() => {
    // Standard election day hours timeline (08:00 to 18:00)
    const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
    
    const hourlyMap: Record<string, { critical: number; high: number; medium: number; low: number; total: number }> = {};
    
    hours.forEach((hr) => {
      hourlyMap[hr] = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        total: 0
      };
    });

    // Aggregate real Firestore incidents into hourly buckets
    filteredData.incidents.forEach(inc => {
      if (!inc.timestamp) return;
      const d = new Date(typeof inc.timestamp === 'string' ? inc.timestamp : (inc.timestamp as any).seconds * 1000);
      const hourStr = format(d, 'HH:00');
      
      if (hourlyMap[hourStr]) {
        const sev = inc.severity || 'medium';
        if (sev === 'critical') hourlyMap[hourStr].critical += 1;
        else if (sev === 'high') hourlyMap[hourStr].high += 1;
        else if (sev === 'medium') hourlyMap[hourStr].medium += 1;
        else hourlyMap[hourStr].low += 1;

        hourlyMap[hourStr].total += 1;
      }
    });

    return hours.map(hr => ({
      time: hr,
      Critical: hourlyMap[hr].critical,
      High: hourlyMap[hr].high,
      Medium: hourlyMap[hr].medium,
      Low: hourlyMap[hr].low,
      Total: hourlyMap[hr].total
    }));
  }, [filteredData.incidents]);

  // 2. Prepare Polling Station Operational Status Distribution (Donut / PieChart) from real reports
  const pollingStationStatusData = useMemo(() => {
    const openAccrediting = filteredData.reports.filter(r => r.type === 'accreditation' || (r.payload?.accreditation && r.payload.accreditation !== 'Delayed')).length;
    const votingInProgress = filteredData.reports.filter(r => r.type === 'normal' || (r.payload?.turnout && r.type !== 'incident')).length;
    const countingCollation = filteredData.reports.filter(r => r.type === 'result').length;
    const delayedMaterials = filteredData.reports.filter(r => r.payload?.materials === 'Incomplete' || r.payload?.accreditation === 'Delayed').length;
    const disruptedIncident = filteredData.incidents.length;

    const totalSum = openAccrediting + votingInProgress + countingCollation + delayedMaterials + disruptedIncident;

    if (totalSum === 0) {
      return [
        { name: 'Awaiting Station Reports', value: 1, color: '#e2e8f0' }
      ];
    }

    return [
      { name: 'Open & Accrediting', value: openAccrediting, color: '#141A56' },
      { name: 'Voting In Progress', value: votingInProgress, color: '#3b82f6' },
      { name: 'Counting & Collation', value: countingCollation, color: '#8b5cf6' },
      { name: 'Delayed / Materials Pending', value: delayedMaterials, color: '#f59e0b' },
      { name: 'Disrupted / Incident', value: disruptedIncident, color: '#ef4444' }
    ].filter(item => item.value > 0);
  }, [filteredData.reports, filteredData.incidents]);

  // 3. Prepare State / Regional Report Volume Comparison (BarChart)
  const stateReportComparisonData = useMemo(() => {
    const topStates = ['Lagos', 'Kano', 'Rivers', 'FCT Abuja', 'Oyo', 'Enugu', 'Kaduna', 'Edo', 'Osun'];

    return topStates.map((st) => {
      const realAcc = filteredData.reports.filter(r => r.type === 'accreditation' && (r.payload?.state === st || r.payload?.lga?.toLowerCase().includes(st.toLowerCase()))).length;
      const realInc = filteredData.reports.filter(r => r.type === 'incident' && (r.payload?.state === st || r.payload?.lga?.toLowerCase().includes(st.toLowerCase()))).length;
      const realRes = filteredData.reports.filter(r => r.type === 'result' && (r.payload?.state === st || r.payload?.lga?.toLowerCase().includes(st.toLowerCase()))).length;

      return {
        state: st,
        Accreditation: realAcc,
        Incidents: realInc,
        Results: realRes,
        Total: realAcc + realInc + realRes
      };
    });
  }, [filteredData.reports]);

  // 4. Prepare Incident Severity & Resolution Pipeline Data (ComposedChart)
  const incidentResolutionData = useMemo(() => {
    const categories = ['BVAS Failure', 'Voter Intimidation', 'Late Opening', 'Ballot Snatching', 'Logistics Delay', 'Crowd Surge'];

    return categories.map((cat) => {
      const matching = filteredData.incidents.filter(i => {
        const text = ((i.title || '') + ' ' + (i.description || '') + ' ' + (i.type || '')).toLowerCase();
        const catWords = cat.toLowerCase().split(' ');
        return catWords.some(w => text.includes(w));
      });
      const resolved = matching.filter(i => i.status === 'resolved').length;
      const investigating = matching.filter(i => i.status === 'investigating').length;
      const pending = matching.filter(i => !i.status || i.status === 'pending').length;
      const total = resolved + investigating + pending;
      const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

      return {
        category: cat,
        Resolved: resolved,
        Investigating: investigating,
        Pending: pending,
        ResolutionRate: resolutionRate
      };
    });
  }, [filteredData.incidents]);

  // Totals & Metrics
  const totalReportsCount = filteredData.reports.length;
  const totalIncidentsCount = filteredData.incidents.length;
  const criticalIncidentsCount = filteredData.incidents.filter(i => i.severity === 'critical').length;
  const checkedInObserversCount = filteredData.observers.filter(o => o.checkInStatus === 'checked_in').length;
  const totalObserversCount = filteredData.observers.length;
  const attendanceRatePct = totalObserversCount > 0 ? Math.round((checkedInObserversCount / totalObserversCount) * 100) : 0;
  const reportingStationsCount = new Set(filteredData.reports.map(r => r.pollingUnitId || r.payload?.pollingUnitId).filter(Boolean)).size;

  return (
    <div className="space-y-6">
      {/* Active Election Scope Banner (Osun Off-Cycle & 2027 General Elections) */}
      <ElectionScopeSelector />

      {/* Top Header & Filter Controls Bar */}
      <div className="bg-white rounded-3xl p-6 border border-emerald-100 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/20">
              <Globe2 className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-gray-900 font-serif tracking-tight">
                  National Election Telemetry Overview
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <Radio className="w-3 h-3 text-emerald-600 animate-ping" />
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                Real-time election observation streams, incident trends, and polling unit operational status
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200/60 rounded-xl text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                {secondsRemaining !== undefined && isAutoRefreshEnabled !== false
                  ? `Auto-Refresh in ${secondsRemaining}s`
                  : 'Auto-Refresh (60s)'}
              </span>
            </div>

            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="px-3 py-2 bg-gray-50 hover:bg-emerald-50 text-gray-700 hover:text-emerald-800 border border-gray-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Refresh National Statistics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
              <span className="hidden sm:inline">Refresh Telemetry</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-gray-50/70 p-3 rounded-2xl border border-gray-200/80 text-xs">
          {/* Time Range Selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mr-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-gray-500" /> Time:
            </span>
            {(['1h', '6h', '12h', '24h', 'all'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-xl font-bold uppercase transition-all text-[11px] ${
                  timeRange === range
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-gray-600 hover:bg-gray-200 border border-gray-200'
                }`}
              >
                {range === 'all' ? 'All Day' : range}
              </button>
            ))}
          </div>

          {/* State / Zone Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 font-bold uppercase tracking-widest text-[10px] flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" /> State:
            </span>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-xs"
            >
              {NIGERIAN_STATES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-xs space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-gray-500 font-bold uppercase tracking-wider">
            <span>Reporting Stations</span>
            <Building2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-serif font-extrabold text-gray-900">{reportingStationsCount}</span>
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> Transmitting
            </span>
          </div>
          <div className="text-[11px] text-gray-500 font-medium">Active Polling Stations Online</div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-xs space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-gray-500 font-bold uppercase tracking-wider">
            <span>Live Field Reports</span>
            <BarChart3 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-serif font-extrabold text-blue-900">{totalReportsCount}</span>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md">Realtime</span>
          </div>
          <div className="text-[11px] text-gray-500 font-medium">Accreditation, Incidents & Results</div>
        </div>

        {/* Metric 3 */}
        <div className="bg-amber-50/50 p-5 rounded-3xl border border-amber-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-amber-800 font-bold uppercase tracking-wider">
            <span>Incident Rate</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-serif font-extrabold text-amber-900">{totalIncidentsCount}</span>
            <span className="text-xs font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-md">
              {criticalIncidentsCount} Critical
            </span>
          </div>
          <div className="text-[11px] text-amber-800 font-medium">Flagged Field Disruption Alerts</div>
        </div>

        {/* Metric 4 */}
        <div className="bg-emerald-50/50 p-5 rounded-3xl border border-emerald-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-emerald-800 font-bold uppercase tracking-wider">
            <span>Observer Station Check-In</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-serif font-extrabold text-emerald-900">{attendanceRatePct}%</span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-md">
              {checkedInObserversCount} On Site
            </span>
          </div>
          <div className="text-[11px] text-emerald-700 font-medium">Verified GPS Attendance</div>
        </div>
      </div>

      {/* Main Charts Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 1: Real-Time Incident Trends Over Time (Area Chart) */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-3xl border border-gray-200 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h3 className="font-bold text-gray-900 font-serif text-base flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-600" />
                Hourly Incident Trends & Severity Breakdown
              </h3>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                Distribution of field incident severity levels over key voting hours
              </p>
            </div>
            <span className="px-2.5 py-1 bg-red-50 text-red-700 text-[10px] font-bold rounded-full border border-red-200">
              {filteredData.incidents.length} Recorded
            </span>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={incidentTrendsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCritical" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={SEVERITY_COLORS.critical} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={SEVERITY_COLORS.critical} stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorHigh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={SEVERITY_COLORS.high} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={SEVERITY_COLORS.high} stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorMedium" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={SEVERITY_COLORS.medium} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={SEVERITY_COLORS.medium} stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorLow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={SEVERITY_COLORS.low} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={SEVERITY_COLORS.low} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '16px',
                    color: '#fff',
                    border: 'none',
                    fontSize: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
                  }}
                  itemStyle={{ color: '#f8fafc', padding: '2px 0' }}
                  labelStyle={{ fontWeight: 'bold', color: '#38bdf8', marginBottom: '4px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Area type="monotone" dataKey="Critical" stackId="1" stroke={SEVERITY_COLORS.critical} fill="url(#colorCritical)" />
                <Area type="monotone" dataKey="High" stackId="1" stroke={SEVERITY_COLORS.high} fill="url(#colorHigh)" />
                <Area type="monotone" dataKey="Medium" stackId="1" stroke={SEVERITY_COLORS.medium} fill="url(#colorMedium)" />
                <Area type="monotone" dataKey="Low" stackId="1" stroke={SEVERITY_COLORS.low} fill="url(#colorLow)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* CHART 2: Polling Station Operational Status Distribution (Donut Chart) */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-3xl border border-gray-200 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h3 className="font-bold text-gray-900 font-serif text-base flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-600" />
                Polling Station Operational Status Distribution
              </h3>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                Proportion of active polling units across election stages
              </p>
            </div>
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-200">
              National Sample
            </span>
          </div>

          <div className="h-72 w-full pt-2 flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pollingStationStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pollingStationStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '16px',
                    color: '#fff',
                    border: 'none',
                    fontSize: '12px'
                  }}
                  formatter={(val: number) => [`${val.toLocaleString()} Stations`, 'Count']}
                />
                <Legend
                  layout="vertical"
                  verticalAlign="middle"
                  align="right"
                  wrapperStyle={{ fontSize: '11px', paddingLeft: '10px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Secondary Charts Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 3: State / Regional Report Volume Comparison (BarChart) */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white p-6 rounded-3xl border border-gray-200 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h3 className="font-bold text-gray-900 font-serif text-base flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                State & Zone Report Volume Comparison
              </h3>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                Accreditation, Incidents, and Result submissions by key States
              </p>
            </div>
            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-full border border-blue-200">
              Top 8 States
            </span>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stateReportComparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="state" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '16px',
                    color: '#fff',
                    border: 'none',
                    fontSize: '12px'
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="Accreditation" fill="#141A56" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Incidents" fill="#ef4444" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Results" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* CHART 4: Incident Category Resolution Pipeline (ComposedChart) */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-6 rounded-3xl border border-gray-200 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h3 className="font-bold text-gray-900 font-serif text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-purple-600" />
                Incident Resolution & Triage Pipeline
              </h3>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                Resolved vs Investigating vs Pending incidents with resolution % line
              </p>
            </div>
            <span className="px-2.5 py-1 bg-purple-50 text-purple-700 text-[10px] font-bold rounded-full border border-purple-200">
              Escalation Matrix
            </span>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={incidentResolutionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="category" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#8b5cf6' }} tickLine={false} domain={[0, 100]} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '16px',
                    color: '#fff',
                    border: 'none',
                    fontSize: '12px'
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar yAxisId="left" dataKey="Resolved" fill="#141A56" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar yAxisId="left" dataKey="Investigating" fill="#f59e0b" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar yAxisId="left" dataKey="Pending" fill="#ef4444" stackId="a" radius={[6, 6, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="ResolutionRate" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: '#8b5cf6' }} name="Resolution %" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
