import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot, where, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Report, Incident } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  cacheFetchedReports, 
  getCachedReports, 
  cacheFetchedIncidents, 
  getCachedIncidents 
} from '../lib/offlineStorage';
import { Link } from 'react-router-dom';
import DangerButton from '../components/DangerButton';
import { 
  BarChart, 
  Bar, 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  PieChart, 
  Pie,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  ArrowUpRight,
  TrendingUp,
  MapPin,
  ShieldAlert,
  User,
  PlusCircle,
  Activity,
  Zap,
  Download,
  FileSpreadsheet,
  Siren
} from 'lucide-react';
import { formatDistanceToNow, subDays, startOfDay, isSameDay, format } from 'date-fns';
import { motion } from 'motion/react';
import CheckInCard from '../components/CheckInCard';
import AttendanceDashboard from '../components/AttendanceDashboard';
import NationalOverview from '../components/NationalOverview';
import IncidentHistory from '../components/IncidentHistory';
import OsunCountdown from '../components/OsunCountdown';
import DirectiveBroadcastModal from '../components/DirectiveBroadcastModal';
import HQDirectivesFeed from '../components/HQDirectivesFeed';
import AutoRefreshControl from '../components/AutoRefreshControl';
import PushNotificationPrompt from '../components/PushNotificationPrompt';
import { toast } from 'sonner';
import { 
  Radio, 
  Megaphone 
} from 'lucide-react';

export default function Dashboard() {
  const { user, isAdmin, isSupervisor } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [isEmergencyBroadcast, setIsEmergencyBroadcast] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [stats, setStats] = useState({
    total: 0,
    incidents: 0,
    accreditation: 0,
    results: 0
  });

  const exportIncidentsCSV = async () => {
    setIsExportingCSV(true);
    try {
      let incidentList: Incident[] = incidents;
      try {
        const qSnap = await getDocs(query(collection(db, 'incidents'), orderBy('timestamp', 'desc')));
        if (!qSnap.empty) {
          incidentList = qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Incident));
        }
      } catch (e) {
        console.warn('Direct incidents fetch fallback to state:', e);
      }

      const reportMap: Record<string, Report> = {};
      reports.forEach(r => { reportMap[r.id] = r; });

      const headers = [
        'Incident ID',
        'Report ID',
        'Polling Unit ID',
        'Severity',
        'Status',
        'Description',
        'Category',
        'Latitude',
        'Longitude',
        'Timestamp'
      ];

      const csvRows = incidentList.map(inc => {
        const matchedReport = reportMap[inc.reportId];
        const category = matchedReport?.payload?.category || 'General Incident';
        const lat = matchedReport?.location?.lat ?? '';
        const lng = matchedReport?.location?.lng ?? '';

        let formattedTime = 'N/A';
        if (inc.timestamp) {
          try {
            const dt = (inc.timestamp as any)?.toDate ? (inc.timestamp as any).toDate() : new Date(inc.timestamp as any);
            formattedTime = format(dt, 'yyyy-MM-dd HH:mm:ss');
          } catch {
            formattedTime = String(inc.timestamp);
          }
        }

        const safeDesc = `"${(inc.description || '').replace(/"/g, '""')}"`;
        const safeCat = `"${category.replace(/"/g, '""')}"`;

        return [
          inc.id,
          inc.reportId || '',
          inc.pollingUnitId || '',
          inc.severity || 'low',
          inc.status || 'pending',
          safeDesc,
          safeCat,
          lat,
          lng,
          formattedTime
        ].join(',');
      });

      const csvContent = [headers.join(','), ...csvRows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `incidents_export_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export incidents CSV:', err);
    } finally {
      setIsExportingCSV(false);
    }
  };

  const refreshElectionStatistics = async (isManual = false) => {
    setIsRefreshing(true);
    try {
      const reportsBaseQuery = collection(db, 'reports');
      const reportsQ = (!isAdmin && !isSupervisor && user)
        ? query(reportsBaseQuery, where('observerId', '==', user.uid), orderBy('timestamp', 'desc'), limit(50))
        : query(reportsBaseQuery, orderBy('timestamp', 'desc'), limit(50));

      const incidentsQ = query(collection(db, 'incidents'), orderBy('timestamp', 'desc'), limit(100));

      const [reportsSnap, incidentsSnap] = await Promise.all([
        getDocs(reportsQ).catch(e => {
          console.warn('Auto-refresh reports query error:', e);
          return null;
        }),
        getDocs(incidentsQ).catch(e => {
          console.warn('Auto-refresh incidents query error:', e);
          return null;
        })
      ]);

      if (reportsSnap && !reportsSnap.empty) {
        const docs = reportsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
        setReports(docs);
        cacheFetchedReports(docs);

        const counts = docs.reduce((acc, curr) => {
          acc[curr.type] = (acc[curr.type] || 0) + 1;
          return acc;
        }, {} as any);

        setStats(prev => ({
          ...prev,
          total: (isAdmin || isSupervisor) ? reportsSnap.size : docs.length,
          incidents: counts.incident || 0,
          accreditation: counts.accreditation || 0,
          results: counts.result || 0
        }));
      }

      if (incidentsSnap && !incidentsSnap.empty) {
        const docs = incidentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Incident));
        setIncidents(docs);
        cacheFetchedIncidents(docs);
      }

      const now = new Date();
      setLastRefreshedAt(now);
      setRefreshTrigger(prev => prev + 1);
      setSecondsRemaining(60);

      if (isManual) {
        toast.success('Election statistics updated', {
          description: `Telemetry synchronized • Next auto-refresh in 60s`,
          duration: 2500
        });
      }
    } catch (err) {
      console.warn('Auto-refresh failed, maintaining active buffer:', err);
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 600);
    }
  };

  // 60-Second Auto-Refresh Interval Timer
  useEffect(() => {
    if (!isAutoRefreshEnabled || !user) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          refreshElectionStatistics(false);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isAutoRefreshEnabled, user, isAdmin, isSupervisor]);

  useEffect(() => {
    if (!user) return;

    // Load initial cached data for offline responsiveness
    const initialCachedReports = getCachedReports();
    const initialCachedIncidents = getCachedIncidents();
    if (initialCachedReports.length > 0) {
      setReports(initialCachedReports);
      const counts = initialCachedReports.reduce((acc, curr) => {
        acc[curr.type] = (acc[curr.type] || 0) + 1;
        return acc;
      }, {} as any);
      setStats({
        total: initialCachedReports.length,
        incidents: counts.incident || 0,
        accreditation: counts.accreditation || 0,
        results: counts.result || 0
      });
    }
    if (initialCachedIncidents.length > 0) {
      setIncidents(initialCachedIncidents);
    }

    // Reports Query: Observers only see their own reports
    const reportsBaseQuery = collection(db, 'reports');
    const reportsQ = (!isAdmin && !isSupervisor) 
      ? query(reportsBaseQuery, where('observerId', '==', user.uid), orderBy('timestamp', 'desc'), limit(50))
      : query(reportsBaseQuery, orderBy('timestamp', 'desc'), limit(50));

    const unsubscribeReports = onSnapshot(reportsQ, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
      setReports(docs);
      cacheFetchedReports(docs);
      
      const counts = docs.reduce((acc, curr) => {
        acc[curr.type] = (acc[curr.type] || 0) + 1;
        return acc;
      }, {} as any);
      
      setStats(prev => ({
        ...prev,
        total: (isAdmin || isSupervisor) ? snapshot.size : docs.length, // Local count for observer, total for others
        incidents: counts.incident || 0,
        accreditation: counts.accreditation || 0,
        results: counts.result || 0
      }));
    }, (error) => {
      console.warn('Firestore reports snapshot failed or offline, using cached reports:', error);
      const cached = getCachedReports();
      if (cached.length > 0) {
        setReports(cached);
      } else {
        handleFirestoreError(error, OperationType.LIST, 'reports');
      }
    });

    const incidentsQ = query(collection(db, 'incidents'), orderBy('timestamp', 'desc'), limit(100));
    const unsubscribeIncidents = onSnapshot(incidentsQ, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Incident));
      setIncidents(docs);
      cacheFetchedIncidents(docs);
    }, (error) => {
      console.warn('Firestore incidents snapshot failed or offline, using cached incidents:', error);
      const cached = getCachedIncidents();
      if (cached.length > 0) {
        setIncidents(cached);
      } else {
        handleFirestoreError(error, OperationType.LIST, 'incidents');
      }
    });

    return () => {
      unsubscribeReports();
      unsubscribeIncidents();
    };
  }, [user, isAdmin, isSupervisor]);

  const severityData = incidents.reduce((acc, curr) => {
    acc[curr.severity] = (acc[curr.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieChartData = [
    { name: 'Low', value: severityData.low || 0, color: '#141A56' },
    { name: 'Medium', value: severityData.medium || 0, color: '#f59e0b' },
    { name: 'High', value: severityData.high || 0, color: '#f97316' },
    { name: 'Critical', value: severityData.critical || 0, color: '#ef4444' },
  ].filter(d => d.value > 0);

  const totalIncidents = pieChartData.reduce((acc, curr) => acc + curr.value, 0);

  // Group by "Region" (simulated by PU ID prefix)
  const regionalPerformance = reports.reduce((acc, curr) => {
    const region = curr.pollingUnitId.split('-')[0] || 'Unknown';
    acc[region] = (acc[region] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const regionalData = Object.entries(regionalPerformance).map(([name, value]) => ({ name, value })).slice(0, 5);

  // Trending Data for Last 7 Days
  const trendData = Array.from({ length: 7 }).map((_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dayIncidents = incidents.filter(inc => {
      if (!inc.timestamp) return false;
      const incDate = (inc.timestamp as any)?.toDate ? (inc.timestamp as any).toDate() : new Date(inc.timestamp);
      return isSameDay(incDate, date);
    });

    return {
      name: format(date, 'MMM dd'),
      low: dayIncidents.filter(inc => inc.severity === 'low').length,
      medium: dayIncidents.filter(inc => inc.severity === 'medium').length,
      high: dayIncidents.filter(inc => inc.severity === 'high').length,
      critical: dayIncidents.filter(inc => inc.severity === 'critical').length,
    };
  });

  const chartData = [
    { name: 'Incidents', value: stats.incidents, color: '#ef4444' },
    { name: 'Accreditation', value: stats.accreditation, color: '#f59e0b' },
    { name: 'Results', value: stats.results, color: '#141A56' },
  ];

  const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 group"
    >
      <div className="flex justify-between items-start">
        <div className={`p-4 rounded-2xl ${color.bg}`}>
          <Icon className={`w-6 h-6 ${color.text}`} />
        </div>
        <div className="flex items-center gap-1 text-emerald-600 text-xs font-bold bg-emerald-50 px-2.5 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
          Live <TrendingUp className="w-3 h-3" />
        </div>
      </div>
      <div className="mt-6">
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
      </div>
    </motion.div>
  );

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight font-serif">
            {isAdmin ? 'Command Center' : isSupervisor ? 'Operations Hub' : 'Field Dashboard'}
          </h1>
          <p className="text-gray-500 mt-2 text-base sm:text-lg font-medium">
            {isAdmin 
              ? 'Administrator overview of the national election process.' 
              : isSupervisor 
              ? 'Supervisory monitoring of regional polling unit status.' 
              : `Welcome back, ${user?.displayName || 'Observer'}. Your field data stream is active.`}
          </p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap" role="toolbar" aria-label="Dashboard actions and quick controls">
          {/* Quick Jump to Incident History */}
          <a 
            href="#incident-history" 
            aria-label="Jump to Incident History section"
            className="flex items-center gap-2 px-5 py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl shadow-xl shadow-red-600/20 transition-all hover:-translate-y-0.5 active:translate-y-0 text-sm cursor-pointer min-h-[44px]"
          >
            <Siren className="w-4 h-4 animate-pulse text-red-100" aria-hidden="true" />
            <span>Incident History</span>
          </a>

          {/* Admin & Supervisor Declare Emergency Button */}
          {(isAdmin || isSupervisor) && (
            <button
              type="button"
              onClick={() => {
                setIsEmergencyBroadcast(true);
                setShowBroadcastModal(true);
              }}
              aria-label="Declare Emergency Alert Broadcast"
              className="flex items-center gap-2 px-5 py-3.5 bg-red-700 hover:bg-red-600 active:bg-red-800 text-white font-black rounded-2xl shadow-xl shadow-red-700/30 transition-all hover:-translate-y-0.5 active:translate-y-0 text-sm cursor-pointer min-h-[44px]"
            >
              <ShieldAlert className="w-4 h-4 animate-pulse text-red-200" aria-hidden="true" />
              <span>Declare Emergency</span>
            </button>
          )}

          {/* Admin & Supervisor Broadcast Directive Button */}
          {(isAdmin || isSupervisor) && (
            <button
              type="button"
              onClick={() => {
                setIsEmergencyBroadcast(false);
                setShowBroadcastModal(true);
              }}
              aria-label="Broadcast Official Directive to Field Observers"
              className="flex items-center gap-2 px-5 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl shadow-xl shadow-emerald-600/25 transition-all hover:-translate-y-0.5 active:translate-y-0 text-sm cursor-pointer min-h-[44px]"
            >
              <Radio className="w-4 h-4 animate-pulse text-emerald-200" aria-hidden="true" />
              <span>Broadcast Directive</span>
            </button>
          )}

          {/* Quick Actions for Observer */}
          {!isAdmin && !isSupervisor && (
            <Link 
              to="/report" 
              aria-label="Submit a new field report"
              className="flex items-center gap-2 px-6 py-3.5 bg-emerald-600 text-white font-bold rounded-2xl shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 transition-all hover:-translate-y-0.5 active:translate-y-0 text-sm min-h-[44px]"
            >
              <PlusCircle className="w-5 h-5" aria-hidden="true" />
              <span>Submit New Report</span>
            </Link>
          )}

          {/* Admin & Supervisor CSV Export Button */}
          {(isAdmin || isSupervisor) && (
            <button
              type="button"
              onClick={exportIncidentsCSV}
              disabled={isExportingCSV}
              aria-label="Export all incident reports as CSV"
              className="flex items-center gap-2 px-5 py-3.5 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-2xl shadow-xl transition-all hover:-translate-y-0.5 active:translate-y-0 text-sm disabled:opacity-50 cursor-pointer min-h-[44px]"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              <span>{isExportingCSV ? 'Generating CSV...' : 'Export Incidents (CSV)'}</span>
            </button>
          )}

          {/* 60-Second Auto-Refresh Control Component */}
          <AutoRefreshControl
            secondsRemaining={secondsRemaining}
            totalInterval={60}
            isAutoRefreshEnabled={isAutoRefreshEnabled}
            onToggleAutoRefresh={() => {
              const nextState = !isAutoRefreshEnabled;
              setIsAutoRefreshEnabled(nextState);
              if (nextState) {
                setSecondsRemaining(60);
                toast.info('Auto-refresh resumed', { description: 'Statistics will refresh every 60 seconds.' });
              } else {
                toast.info('Auto-refresh paused', { description: 'Automatic 60s background sync is paused.' });
              }
            }}
            onManualRefresh={() => refreshElectionStatistics(true)}
            isRefreshing={isRefreshing}
            lastRefreshedAt={lastRefreshedAt}
          />
        </div>
      </div>

      {/* Subtle Synchronizing Top Banner when refreshing */}
      {isRefreshing && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-2xl flex items-center justify-between text-xs text-emerald-900 font-bold"
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Synchronizing live election telemetry across national polling units...</span>
          </div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-700">60s Auto-Cycle</span>
        </motion.div>
      )}

      {/* Web Push Notification Observer Opt-in / Status Banner */}
      <PushNotificationPrompt />

      {/* Osun State Gubernatorial Election Dynamic Countdown */}
      <OsunCountdown />

      {/* HQ Command Directives & Official Updates Feed */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <HQDirectivesFeed onOpenBroadcastModal={() => setShowBroadcastModal(true)} />
      </motion.div>

      {/* Stats Grid - Tailored per role */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
        <StatCard 
          title={isAdmin || isSupervisor ? "Global Reports" : "My Reports"}
          value={stats.total} 
          icon={FileText} 
          color={{ bg: 'bg-indigo-50', text: 'text-indigo-600' }} 
        />
        <StatCard 
          title="Flagged Incidents" 
          value={stats.incidents} 
          icon={AlertCircle} 
          color={{ bg: 'bg-red-50', text: 'text-red-600' }} 
        />
        <StatCard 
          title={isAdmin || isSupervisor ? "Open Cases" : "PU Status"} 
          value={isAdmin || isSupervisor ? incidents.filter(i => i.status !== 'resolved').length : (user as any)?.assignedPollingUnitId || 'Unassigned'} 
          icon={isAdmin || isSupervisor ? Zap : MapPin} 
          color={{ bg: 'bg-amber-50', text: 'text-amber-600' }} 
        />
        <StatCard 
          title="System Vitality" 
          value={isRefreshing ? "Syncing..." : "Active"} 
          icon={Activity} 
          color={{ bg: 'bg-emerald-50', text: 'text-emerald-600' }} 
        />
      </div>

      {/* National Overview Analytics Dashboard (Recharts Visualizations) */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <NationalOverview 
          lastRefreshedAt={lastRefreshedAt}
          refreshTrigger={refreshTrigger}
          secondsRemaining={secondsRemaining}
          isAutoRefreshEnabled={isAutoRefreshEnabled}
          onManualRefreshParent={() => refreshElectionStatistics(true)}
        />
      </motion.div>

      {/* Incident History View - Lists all past SOS alerts triggered by observers with timestamp, location, and reporting observer */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
      >
        <IncidentHistory />
      </motion.div>

      {/* Observer Geolocation Check-in Widget (Visible for Field Observers) */}
      {!isAdmin && !isSupervisor && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <CheckInCard />
        </motion.div>
      )}

      {/* Admin & Supervisor Attendance Dashboard */}
      {(isAdmin || isSupervisor) && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <AttendanceDashboard />
        </motion.div>
      )}

      {/* Admin Data Export Bar */}
      {(isAdmin || isSupervisor) && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 p-8 rounded-[36px] shadow-xl text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-gray-700"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  Data Analytics
                </span>
                <span className="text-xs text-gray-400">{incidents.length} recorded incidents</span>
              </div>
              <h3 className="text-xl font-bold font-serif text-white mt-1">Export Field Incident Logs</h3>
              <p className="text-xs text-gray-300 mt-1 max-w-xl leading-relaxed">
                Download a complete, structured CSV spreadsheet containing incident IDs, polling unit tags, severity ratings, descriptions, GPS coordinates, and timestamps for offline analysis.
              </p>
            </div>
          </div>

          <button
            onClick={exportIncidentsCSV}
            disabled={isExportingCSV}
            className="px-6 py-4 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-extrabold rounded-2xl shadow-lg transition-all hover:scale-105 active:scale-95 text-xs uppercase tracking-wider shrink-0 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            {isExportingCSV ? 'Generating CSV...' : 'Download Incidents (CSV)'}
          </button>
        </motion.div>
      )}

      {/* Unified Trending Chart */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 opacity-50" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2 font-serif text-emerald-950">
              <TrendingUp className="text-emerald-600 w-6 h-6" />
              Incident Severity Trends
            </h3>
            <p className="text-gray-400 text-sm mt-1 font-medium">Daily classification of reported field issues (Last 7 Days)</p>
          </div>
          <div className="flex flex-wrap gap-4">
            {[
              { label: 'Low', color: 'bg-emerald-500' },
              { label: 'Medium', color: 'bg-amber-500' },
              { label: 'High', color: 'bg-orange-500' },
              { label: 'Critical', color: 'bg-red-500' }
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-100">
                <div className={`w-2 h-2 rounded-full ${item.color}`} />
                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} 
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} 
              />
              <Tooltip 
                contentStyle={{ 
                  borderRadius: '24px', 
                  border: '1px solid #f1f5f9', 
                  boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05)',
                  padding: '16px'
                }}
                itemStyle={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase' }}
                labelStyle={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#1e293b' }}
              />
              <Line type="monotone" dataKey="low" stroke="#141A56" strokeWidth={4} dot={{ r: 4, fill: '#141A56', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="medium" stroke="#f59e0b" strokeWidth={4} dot={{ r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="high" stroke="#f97316" strokeWidth={4} dot={{ r: 4, fill: '#f97316', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="critical" stroke="#ef4444" strokeWidth={4} dot={{ r: 4, fill: '#ef4444', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Role-Specific Content */}
        
        {/* Admin View: System Health & Global Analytics */}
        {isAdmin && (
          <>
            <div className="lg:col-span-2 bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm">
               <div className="flex justify-between items-start mb-10">
                 <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2 font-serif">
                   <Activity className="text-emerald-600 w-5 h-5" />
                   System Infrastructure Health
                 </h3>
                 <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-widest">Global Status: Nominal</span>
               </div>
               <div className="grid grid-cols-3 gap-8">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Active Observers</p>
                    <p className="text-2xl font-bold text-gray-900 tabular-nums">1,204</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">DB Throughput</p>
                    <p className="text-2xl font-bold text-gray-900 tabular-nums">14ms</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Network Load</p>
                    <p className="text-2xl font-bold text-gray-900">Low - Stable</p>
                  </div>
               </div>
               <div className="mt-10 h-2.5 bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                 <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: '85%' }}
                   className="h-full bg-emerald-500 rounded-full" 
                 />
               </div>
               <p className="text-[10px] text-gray-400 mt-4 font-medium flex justify-between uppercase tracking-tight">
                 <span>Operational efficiency targeting 99.9% uptime</span>
                 <span>85% capacity utilized</span>
               </p>
            </div>

            <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm relative overflow-hidden group flex flex-col h-full">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2 font-serif text-emerald-950">
                  <ShieldAlert className="text-red-500 w-5 h-5" />
                  Tactical Alert Feed
                </h3>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              </div>
              <div className="space-y-3 relative z-10 flex-1 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                 {incidents.filter(i => i.severity === 'critical' || i.severity === 'high').slice(0, 5).map((incident, idx) => (
                   <motion.div 
                     initial={{ opacity: 0, x: 20 }}
                     animate={{ opacity: 1, x: 0 }}
                     transition={{ delay: idx * 0.1 }}
                     key={incident.id} 
                     className="p-4 bg-red-50/50 rounded-2xl border border-red-100 hover:bg-white hover:shadow-md transition-all cursor-pointer group/item"
                   >
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-[10px] font-bold text-red-700 uppercase tracking-widest">{incident.severity} PRIORITY</p>
                        <p className="text-[9px] font-mono text-gray-400">{(incident.timestamp as any)?.toDate ? formatDistanceToNow((incident.timestamp as any).toDate(), { addSuffix: true }) : 'Now'}</p>
                      </div>
                      <p className="text-xs font-bold text-red-950 line-clamp-2">{incident.description}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <MapPin className="w-3 h-3 text-red-300" />
                        <span className="text-[10px] font-bold text-red-500 uppercase">{incident.pollingUnitId}</span>
                      </div>
                   </motion.div>
                 ))}
                 {incidents.filter(i => i.severity === 'critical' || i.severity === 'high').length === 0 && (
                   <div className="h-full flex flex-col items-center justify-center text-gray-300 py-10 text-center">
                     <ShieldAlert className="w-12 h-12 mb-3 opacity-20" />
                     <p className="text-xs font-bold italic">No high-priority alerts in current buffer</p>
                   </div>
                 )}
              </div>
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                <Zap className="w-32 h-32 text-red-500" />
              </div>
            </div>

            <div className="lg:col-span-2 bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
               <h3 className="text-xl font-bold text-gray-900 mb-8 flex items-center gap-2 font-serif text-indigo-950">
                 <TrendingUp className="text-indigo-600 w-5 h-5" />
                 Transmission Volume
               </h3>
               <div className="h-[250px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={chartData}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                     <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
                     <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={34}>
                       {chartData.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={entry.color} />
                       ))}
                     </Bar>
                   </BarChart>
                 </ResponsiveContainer>
               </div>
            </div>

            <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm flex flex-col justify-center">
              <h3 className="text-xl font-bold text-gray-900 mb-4 font-serif text-center">
                Incident Severity Matrix
              </h3>
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieChartData} innerRadius={45} outerRadius={65} dataKey="value" paddingAngle={5}>
                      {pieChartData.map((entry, index) => <Cell key={`c-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        {/* Supervisor View: Regional Intelligence */}
        {isSupervisor && !isAdmin && (
          <>
            <div className="lg:col-span-2 bg-emerald-950 rounded-[40px] p-10 text-white shadow-2xl relative overflow-hidden">
               <div className="relative z-10 space-y-8">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-3xl font-bold font-serif">Regional Intel Hub</h3>
                      <p className="text-emerald-200 mt-2 font-medium">Monitoring local field dynamics and escalating issues.</p>
                    </div>
                    <Link to="/reports" className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest transition-all">
                      Audit Region
                    </Link>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-8 pt-4">
                     <div className="p-6 bg-emerald-900/50 rounded-[32px] border border-emerald-800/50">
                        <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-4 font-mono">Dominant Zone</h4>
                        <div className="flex items-center gap-4">
                           <div className="text-3xl font-bold font-serif uppercase tracking-tighter truncate">{regionalData[0]?.name || 'Sector A'}</div>
                           <span className="text-[10px] font-bold bg-emerald-500/20 px-2 py-1 rounded-lg border border-emerald-500/30">Stable</span>
                        </div>
                     </div>
                     <div className="p-6 bg-emerald-900/50 rounded-[32px] border border-emerald-800/50">
                        <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-4 font-mono">Urgent Backlog</h4>
                        <div className="flex items-center gap-4">
                           <div className="text-3xl font-bold font-serif">{incidents.filter(i => i.status !== 'resolved').length}</div>
                           <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-2 py-1 rounded-lg border border-amber-500/30">Action Point</span>
                        </div>
                     </div>
                  </div>
               </div>
               <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
            </div>

            <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm h-full flex flex-col">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2 font-serif text-emerald-950">
                    <Activity className="text-emerald-600 w-5 h-5" />
                    Live Regional Alerts
                  </h3>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 rounded-full">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">Active</span>
                  </div>
                </div>
                <div className="space-y-4 flex-1 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                   {incidents.filter(i => i.status !== 'resolved').slice(0, 6).map((incident, idx) => (
                     <motion.div 
                       initial={{ opacity: 0, y: 10 }}
                       animate={{ opacity: 1, y: 0 }}
                       transition={{ delay: idx * 0.05 }}
                       key={incident.id} 
                       className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between hover:bg-white hover:shadow-md transition-all cursor-pointer group"
                     >
                        <div className="max-w-[70%]">
                           <div className="flex items-center gap-2 mb-1">
                             <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${
                               incident.severity === 'critical' ? 'bg-red-100 text-red-700' :
                               incident.severity === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'
                             }`}>{incident.severity}</span>
                             <p className="text-[9px] text-gray-400 font-mono italic">{(incident.timestamp as any)?.toDate ? formatDistanceToNow((incident.timestamp as any).toDate(), { addSuffix: true }) : 'Now'}</p>
                           </div>
                           <p className="text-xs font-bold text-gray-900 line-clamp-1 group-hover:text-emerald-700 transition-colors">{incident.description}</p>
                           <p className="text-[10px] text-gray-400 font-mono mt-1 uppercase tracking-widest">{incident.pollingUnitId}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ring-4 ${
                            incident.severity === 'critical' ? 'bg-red-500 ring-red-50' : 
                            incident.severity === 'high' ? 'bg-orange-500 ring-orange-50' : 'bg-amber-400 ring-amber-50'
                          }`} />
                          <ArrowUpRight className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                     </motion.div>
                   ))}
                   {incidents.filter(i => i.status !== 'resolved').length === 0 && (
                     <div className="text-center py-16">
                        <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
                          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                        </div>
                        <p className="text-sm font-bold text-gray-900 mb-1">Zero Open Alerts</p>
                        <p className="text-xs text-gray-400 font-medium italic">Regional stream is currently stable.</p>
                     </div>
                   )}
                </div>
            </div>

            <div className="lg:col-span-3 bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm">
               <h3 className="text-xl font-bold text-gray-900 mb-8 flex items-center gap-2 font-serif justify-center text-center">
                 Region Performance Analytics
               </h3>
               <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={regionalData} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} width={80} />
                      <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px' }} />
                      <Bar dataKey="value" fill="#065f46" radius={[0, 8, 8, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
               </div>
            </div>
          </>
        )}

        {/* Observer View: Field Status & Guide */}
        {!isAdmin && !isSupervisor && (
          <>
            <div className="lg:col-span-2 space-y-8">
              {/* Field Guide */}
              <div className="bg-emerald-950 rounded-[32px] md:rounded-[48px] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl shadow-emerald-950/40">
                <div className="relative z-10 space-y-6">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-800/30 rounded-xl text-xs font-bold uppercase tracking-widest border border-emerald-700/50 backdrop-blur-md">
                    <User className="w-4 h-4 text-emerald-400" /> Authorized Observer
                  </div>
                  <h2 className="text-4xl md:text-5xl font-bold font-serif italic leading-tight">Field Hub</h2>
                  <p className="text-emerald-100 text-lg max-w-xl leading-relaxed opacity-80">
                    Your real-time transmission stream is active. Ensure all polling results are logged within 15 minutes of completion.
                  </p>
                  <div className="pt-6 flex flex-wrap gap-4">
                    <div className="px-8 py-5 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-sm">
                      <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mb-1 font-mono">My Sector</p>
                      <p className="font-bold text-xl tracking-tight">Zone LW-01</p>
                    </div>
                    <div className="px-8 py-5 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-sm">
                      <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mb-1 font-mono">Transmission Status</p>
                      <p className="font-bold text-xl tracking-tight">Optimal</p>
                    </div>
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3" />
              </div>

              {/* Observer Performance */}
              <div className="grid md:grid-cols-2 gap-8">
                  <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm relative group overflow-hidden">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 font-mono">Submission Accuracy</h3>
                    <div className="flex items-end gap-3">
                       <p className="text-5xl font-bold text-gray-900 font-serif tabular-nums tracking-tighter">98.4<span className="text-2xl font-sans text-gray-400">%</span></p>
                       <span className="text-emerald-600 text-xs font-bold mb-2 flex items-center gap-1">
                         <TrendingUp className="w-3 h-3" /> +2%
                       </span>
                    </div>
                    <div className="w-full bg-gray-50 h-2 rounded-full mt-8 overflow-hidden">
                       <motion.div 
                         initial={{ width: 0 }}
                         animate={{ width: '98.4%' }}
                         className="bg-emerald-500 h-full rounded-full" 
                       />
                    </div>
                  </div>
                  <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 font-mono">Network Latency</h3>
                    <div className="flex items-end gap-3">
                       <p className="text-5xl font-bold text-gray-900 font-serif tabular-nums tracking-tighter">4.2<span className="text-2xl font-sans text-gray-400">ms</span></p>
                       <span className="text-indigo-500 text-xs font-bold mb-2 tracking-widest uppercase">Verified</span>
                    </div>
                    <div className="w-full bg-gray-50 h-2 rounded-full mt-8 overflow-hidden">
                       <motion.div 
                         initial={{ width: 0 }}
                         animate={{ width: '85%' }}
                         className="bg-indigo-500 h-full rounded-full" 
                       />
                    </div>
                  </div>
              </div>
            </div>

            {/* Support Terminal */}
            <div className="bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-6 font-serif">Operational Support</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-10 font-medium italic">
                  Direct encrypted channel to field supervisors is active. Protocol 882 applicable for all disputes.
                </p>
                <div className="space-y-4">
                  <button className="w-full py-5 bg-gray-50 text-gray-700 font-bold rounded-[32px] hover:bg-gray-100 transition-all border border-gray-100 flex items-center justify-center gap-3">
                     View Protocol Guide
                  </button>
                  <button className="w-full py-5 bg-red-50 text-red-600 font-bold rounded-[32px] hover:bg-red-100 transition-all border border-red-100 flex items-center justify-center gap-3 active:scale-[0.98]">
                     Security Alert Link
                  </button>
                </div>
              </div>
              <div className="mt-12 p-8 bg-emerald-50/50 rounded-[32px] border border-emerald-100/50">
                 <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest mb-2 font-mono">Assigned Region Hub</p>
                 <p className="font-bold text-emerald-950 flex items-center gap-2 italic">
                   <MapPin className="w-4 h-4" /> Lagos West Sector
                 </p>
              </div>
            </div>
          </>
        )}

        {/* Unified Activity Section (Personalized per role) */}
        <div className="lg:col-span-3 bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm flex flex-col relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 relative z-10 gap-4">
            <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3 font-serif">
              <Clock className="text-emerald-600 w-6 h-6" />
              {isAdmin || isSupervisor ? 'Global Transmission Feed' : 'My Recent Transmission Log'}
            </h3>
            <Link to="/reports" className="text-emerald-600 font-bold text-sm hover:underline flex items-center gap-1 group">
              Audit Full Stream <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
          
          <div className="flex-1 space-y-6 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar relative z-10">
            {reports.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 py-32">
                <FileText className="w-16 h-16 mb-6 opacity-10" />
                <p className="font-serif italic text-lg">Awaiting data initialization...</p>
              </div>
            ) : (
              reports.map((report, idx) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.05 }}
                  key={report.id} 
                  className="flex gap-6 p-6 rounded-[32px] hover:bg-gray-50 transition-all group cursor-default border border-transparent hover:border-gray-100"
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                    report.type === 'incident' ? 'bg-red-50 text-red-500' : 
                    report.type === 'accreditation' ? 'bg-amber-50 text-amber-500' : 'bg-emerald-50 text-emerald-500'
                  }`}>
                    {report.type === 'incident' ? <AlertCircle className="w-7 h-7" /> : 
                     report.type === 'accreditation' ? <Clock className="w-7 h-7" /> : <CheckCircle2 className="w-7 h-7" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap justify-between items-start gap-2">
                      <h4 className="font-bold text-gray-900 group-hover:text-emerald-800 transition-colors tracking-tight text-lg">
                        POLLING UNIT #{report.pollingUnitId}
                      </h4>
                      <span className="text-[10px] bg-white border border-gray-100 shadow-sm text-gray-500 px-3 py-1.5 rounded-full font-bold uppercase tracking-widest whitespace-nowrap">
                         {(report.timestamp as any)?.toDate ? formatDistanceToNow((report.timestamp as any).toDate(), { addSuffix: true }) : 'Now'}
                      </span>
                    </div>
                    <p className="text-gray-500 mt-2 line-clamp-2 leading-relaxed font-medium">
                      {typeof report.payload === 'string' ? report.payload : 
                       report.payload?.description || JSON.stringify(report.payload).slice(0, 80)}
                    </p>
                    <div className="mt-4 flex items-center gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      <span className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-lg"><MapPin className="w-3.5 h-3.5" /> Region 8A</span>
                      <span className="w-1 h-1 bg-gray-200 rounded-full" />
                      <span className="text-emerald-600">ID: {report.id.slice(0, 8)}</span>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Directive & Administrative Memo Broadcast Modal */}
      <DirectiveBroadcastModal 
        isOpen={showBroadcastModal} 
        onClose={() => setShowBroadcastModal(false)} 
        defaultEmergencyMode={isEmergencyBroadcast}
      />
    </div>
  );
}
