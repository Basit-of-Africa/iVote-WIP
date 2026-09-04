import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, limit, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Incident, Report, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  Siren, 
  ShieldAlert, 
  MapPin, 
  User as UserIcon, 
  Clock, 
  ExternalLink, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  Phone, 
  Download, 
  ChevronRight,
  Compass,
  Sparkles,
  RefreshCw,
  FileSpreadsheet
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export interface EnrichedIncident {
  id: string;
  reportId: string;
  pollingUnitId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'investigating' | 'resolved';
  description: string;
  timestamp: any;
  location?: { lat: number; lng: number; accuracy?: number };
  mapsUrl?: string;
  isSosAlert?: boolean;
  observerName?: string;
  observerPhone?: string;
  observerEmail?: string;
  observerId?: string;
  state?: string;
  lga?: string;
  notes?: string;
}

export default function IncidentHistory() {
  const { user, isAdmin, isSupervisor } = useAuth();
  const [incidents, setIncidents] = useState<EnrichedIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'all_sos' | 'critical' | 'pending' | 'all'>('all_sos');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIncident, setSelectedIncident] = useState<EnrichedIncident | null>(null);

  useEffect(() => {
    let unsubscribeReports: (() => void) | undefined;
    let unsubscribeIncidents: (() => void) | undefined;

    const fetchData = async () => {
      try {
        // Fetch observers/users map for observer details lookup
        const usersMap: Record<string, User> = {};
        try {
          const usersSnap = await getDocs(collection(db, 'users'));
          usersSnap.forEach((uDoc) => {
            usersMap[uDoc.id] = uDoc.data() as User;
          });
        } catch (e) {
          console.warn('Could not fetch users list for incident join:', e);
        }

        // Fetch reports map
        const reportsMap: Record<string, Report> = {};
        let rawIncidents: any[] = [];

        const combineData = () => {
          const enriched: EnrichedIncident[] = rawIncidents.map((inc: any) => {
            const matchedReport = reportsMap[inc.reportId];
            const matchedUser = matchedReport?.observerId ? usersMap[matchedReport.observerId] : undefined;
            
            const payload = matchedReport?.payload || {};
            const isSos = payload?.isDangerSos === true || 
                          inc.description?.includes('DANGER SOS') || 
                          inc.description?.includes('EMERGENCY') ||
                          inc.severity === 'critical';

            const lat = inc.location?.lat || payload?.gpsLocation?.lat || matchedReport?.location?.lat;
            const lng = inc.location?.lng || payload?.gpsLocation?.lng || matchedReport?.location?.lng;
            const accuracy = inc.location?.accuracy || payload?.gpsLocation?.accuracy || 20;

            const mapsUrl = inc.mapsUrl || payload?.mapsUrl || (lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : undefined);

            const observerName = payload?.observerName || matchedUser?.displayName || (matchedReport?.observerId === user?.uid ? user?.displayName : 'Field Observer');
            const observerPhone = payload?.observerPhone || matchedUser?.phone || (matchedReport?.observerId === user?.uid ? user?.phone : undefined);
            const observerEmail = matchedUser?.email || (matchedReport?.observerId === user?.uid ? user?.email : undefined);

            return {
              id: inc.id,
              reportId: inc.reportId || '',
              pollingUnitId: inc.pollingUnitId || payload?.pollingUnitId || 'PU-FIELD',
              severity: inc.severity || payload?.severity || 'high',
              status: inc.status || 'pending',
              description: inc.description || payload?.description || 'Emergency alert reported by field observer',
              timestamp: inc.timestamp || matchedReport?.timestamp || new Date(),
              location: lat && lng ? { lat, lng, accuracy } : undefined,
              mapsUrl,
              isSosAlert: isSos,
              observerName,
              observerPhone,
              observerEmail,
              observerId: matchedReport?.observerId,
              state: payload?.state || matchedUser?.state || 'Lagos',
              lga: payload?.lga || matchedUser?.lga || 'Ikeja',
              notes: payload?.notes || ''
            };
          });

          setIncidents(enriched);
          setLoading(false);
        };

        const reportsQ = query(collection(db, 'reports'), orderBy('timestamp', 'desc'), limit(100));
        
        unsubscribeReports = onSnapshot(reportsQ, (reportsSnap) => {
          reportsSnap.forEach((rDoc) => {
            reportsMap[rDoc.id] = { id: rDoc.id, ...rDoc.data() } as Report;
          });
          combineData();
        }, (err) => console.warn('Reports snapshot error:', err));

        // Fetch incidents stream
        const incidentsQ = query(collection(db, 'incidents'), orderBy('timestamp', 'desc'), limit(100));
        
        unsubscribeIncidents = onSnapshot(incidentsQ, (incidentsSnap) => {
          rawIncidents = incidentsSnap.docs.map(iDoc => ({ id: iDoc.id, ...iDoc.data() }));
          combineData();
        }, (error) => {
          console.warn('Incidents snapshot failed:', error);
          setLoading(false);
        });

      } catch (err) {
        console.error('Error setting up IncidentHistory listeners:', err);
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      if (unsubscribeReports) unsubscribeReports();
      if (unsubscribeIncidents) unsubscribeIncidents();
    };
  }, [user]);

  const handleStatusUpdate = async (incidentId: string, newStatus: 'pending' | 'investigating' | 'resolved') => {
    if (!isAdmin && !isSupervisor) {
      toast.error('Only Supervisors and Admins can update incident status.');
      return;
    }
    try {
      await updateDoc(doc(db, 'incidents', incidentId), { status: newStatus });
      toast.success(`Incident status updated to ${newStatus.toUpperCase()}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `incidents/${incidentId}`);
    }
  };

  const filteredIncidents = incidents.filter((item) => {
    // Filter by tab
    if (filterTab === 'all_sos' && !item.isSosAlert) return false;
    if (filterTab === 'critical' && item.severity !== 'critical') return false;
    if (filterTab === 'pending' && item.status !== 'pending') return false;

    // Search query
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.pollingUnitId.toLowerCase().includes(q) ||
      (item.observerName && item.observerName.toLowerCase().includes(q)) ||
      (item.description && item.description.toLowerCase().includes(q)) ||
      (item.state && item.state.toLowerCase().includes(q)) ||
      (item.lga && item.lga.toLowerCase().includes(q))
    );
  });

  const sosCount = incidents.filter(i => i.isSosAlert).length;
  const criticalCount = incidents.filter(i => i.severity === 'critical').length;
  const pendingCount = incidents.filter(i => i.status === 'pending').length;

  const exportSosCSV = () => {
    const headers = [
      'Incident ID',
      'Reporting Observer',
      'Observer Phone',
      'Polling Unit',
      'State',
      'LGA',
      'Severity',
      'Status',
      'Is SOS Alert',
      'Latitude',
      'Longitude',
      'Google Maps URL',
      'Description',
      'Timestamp'
    ];

    const rows = filteredIncidents.map(i => {
      let formattedTime = 'N/A';
      if (i.timestamp) {
        try {
          const dt = i.timestamp?.toDate ? i.timestamp.toDate() : new Date(i.timestamp);
          formattedTime = format(dt, 'yyyy-MM-dd HH:mm:ss');
        } catch {
          formattedTime = String(i.timestamp);
        }
      }

      return [
        i.id,
        `"${(i.observerName || 'Observer').replace(/"/g, '""')}"`,
        `"${(i.observerPhone || '').replace(/"/g, '""')}"`,
        i.pollingUnitId,
        i.state || '',
        i.lga || '',
        i.severity,
        i.status,
        i.isSosAlert ? 'YES' : 'NO',
        i.location?.lat || '',
        i.location?.lng || '',
        i.mapsUrl || '',
        `"${(i.description || '').replace(/"/g, '""')}"`,
        formattedTime
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `sos_incident_history_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('SOS Incident History exported to CSV');
  };

  return (
    <div id="incident-history" className="bg-white p-6 sm:p-10 rounded-[40px] border border-gray-100 shadow-sm relative overflow-hidden space-y-8">
      {/* Background Accent Decorative element */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-red-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
        <div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-red-50 text-red-700 text-xs font-black uppercase tracking-widest rounded-xl border border-red-100 mb-2">
            <Siren className="w-4 h-4 text-red-600 animate-pulse" />
            Distress & Emergency Audit Feed
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 font-serif tracking-tight flex items-center gap-3">
            Incident History & SOS Log
          </h2>
          <p className="text-gray-500 text-sm mt-1 font-medium">
            Complete audit trail of observer SOS alerts, precise GPS locations, timestamps, and dispatch statuses.
          </p>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="px-4 py-2 bg-red-600 text-white rounded-2xl shadow-lg shadow-red-900/20 flex items-center gap-2.5">
            <Siren className="w-4 h-4" />
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-red-200">Total SOS</p>
              <p className="text-base font-black leading-tight">{sosCount}</p>
            </div>
          </div>

          <div className="px-4 py-2 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-900/20 flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4" />
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-amber-100">Pending</p>
              <p className="text-base font-black leading-tight">{pendingCount}</p>
            </div>
          </div>

          <button
            onClick={exportSosCSV}
            className="flex items-center gap-2 px-4 py-3 bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs rounded-2xl transition-all shadow-md active:scale-95 cursor-pointer"
            title="Export SOS alert history to CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 pt-2 relative z-10">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by observer, polling unit, location, or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-100/80 rounded-2xl overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setFilterTab('all_sos')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              filterTab === 'all_sos'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Siren className="w-3.5 h-3.5" />
            SOS Alerts ({sosCount})
          </button>

          <button
            onClick={() => setFilterTab('critical')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              filterTab === 'critical'
                ? 'bg-red-700 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Critical ({criticalCount})
          </button>

          <button
            onClick={() => setFilterTab('pending')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              filterTab === 'pending'
                ? 'bg-amber-500 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Pending ({pendingCount})
          </button>

          <button
            onClick={() => setFilterTab('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              filterTab === 'all'
                ? 'bg-gray-900 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All Incidents ({incidents.length})
          </button>
        </div>
      </div>

      {/* Incidents List Grid */}
      <div className="relative z-10">
        {loading ? (
          <div className="py-20 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-red-500" />
            <p className="text-sm font-semibold">Syncing Incident & SOS Log from Firestore...</p>
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="py-20 text-center bg-gray-50/60 rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center p-8">
            <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-4">
              <ShieldAlert className="w-8 h-8 opacity-60" />
            </div>
            <h3 className="text-base font-bold text-gray-800 font-serif">No SOS Alerts Found</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-md">
              {searchQuery
                ? `No incident matches your query "${searchQuery}". Try clearing filters.`
                : 'No emergency distress signals or SOS alerts recorded in this view.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {filteredIncidents.map((item) => {
                let formattedTime = 'Just now';
                let formattedDate = '';
                if (item.timestamp) {
                  try {
                    const dt = item.timestamp?.toDate ? item.timestamp.toDate() : new Date(item.timestamp);
                    formattedTime = formatDistanceToNow(dt, { addSuffix: true });
                    formattedDate = format(dt, 'MMM dd, yyyy • hh:mm:ss a');
                  } catch {
                    formattedTime = 'Recent';
                  }
                }

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className={`p-6 rounded-3xl border transition-all duration-200 ${
                      item.isSosAlert
                        ? 'bg-gradient-to-r from-red-50/60 via-rose-50/30 to-white border-red-200/80 hover:border-red-400/80 shadow-sm'
                        : 'bg-white border-gray-100 hover:border-gray-200 shadow-sm'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                      {/* Left Block: Info & Description */}
                      <div className="space-y-4 flex-1">
                        {/* Top Badges Line */}
                        <div className="flex flex-wrap items-center gap-2.5">
                          {item.isSosAlert && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-md shadow-red-900/20">
                              <Siren className="w-3.5 h-3.5 animate-pulse" />
                              EMERGENCY SOS
                            </span>
                          )}

                          <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider ${
                            item.severity === 'critical' ? 'bg-red-100 text-red-800 border border-red-200' :
                            item.severity === 'high' ? 'bg-orange-100 text-orange-800 border border-orange-200' :
                            item.severity === 'medium' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                            'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}>
                            {item.severity} Severity
                          </span>

                          <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider ${
                            item.status === 'resolved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                            item.status === 'investigating' ? 'bg-orange-100 text-orange-800 border border-orange-200' :
                            'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {item.status}
                          </span>

                          <span className="text-[11px] font-bold text-gray-500 bg-gray-100/80 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                            <Clock className="w-3 h-3 text-gray-400" />
                            {formattedTime}
                          </span>
                        </div>

                        {/* Description */}
                        <div>
                          <p className="text-sm sm:text-base font-bold text-gray-900 leading-relaxed font-sans">
                            {item.description}
                          </p>
                          {item.notes && (
                            <p className="text-xs text-red-900/80 bg-red-100/50 p-3 rounded-xl mt-2 border border-red-200/50 italic">
                              <strong>Observer Additional Notes:</strong> "{item.notes}"
                            </p>
                          )}
                        </div>

                        {/* Reporting Observer & Location Tags */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1 text-xs">
                          {/* Observer Card */}
                          <div className="p-3 bg-white/80 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                              <UserIcon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Reporting Observer</p>
                              <p className="font-bold text-gray-900 truncate">{item.observerName || 'Field Observer'}</p>
                              {item.observerPhone && (
                                <p className="text-[10px] text-gray-500 flex items-center gap-1 font-mono">
                                  <Phone className="w-2.5 h-2.5 text-gray-400" /> {item.observerPhone}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Location Card */}
                          <div className="p-3 bg-white/80 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold shrink-0">
                              <MapPin className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Polling Unit</p>
                              <p className="font-extrabold text-gray-900 truncate">#{item.pollingUnitId}</p>
                              <p className="text-[10px] text-gray-500 truncate">{item.lga}, {item.state}</p>
                            </div>
                          </div>

                          {/* GPS Coordinates Card */}
                          <div className="p-3 bg-white/80 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[9px] font-black uppercase text-gray-400 tracking-wider">GPS Coordinates</p>
                              {item.location ? (
                                <p className="font-mono text-[11px] font-bold text-gray-800 truncate">
                                  {item.location.lat.toFixed(5)}°, {item.location.lng.toFixed(5)}°
                                  {item.location.accuracy ? ` (±${item.location.accuracy}m)` : ''}
                                </p>
                              ) : (
                                <p className="text-[11px] text-gray-400 italic">Approx. Field Location</p>
                              )}
                              {formattedDate && (
                                <p className="text-[9px] text-gray-400 mt-0.5">{formattedDate}</p>
                              )}
                            </div>

                            {item.mapsUrl && (
                              <a
                                href={item.mapsUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0 transition-all shadow-xs"
                                title="Open exact location in Google Maps"
                              >
                                <Compass className="w-3 h-3" />
                                Map
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Block: Status Controls for Admin / Supervisor */}
                      {(isAdmin || isSupervisor) && (
                        <div className="flex lg:flex-col items-center lg:items-end justify-end gap-2 pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-gray-100 lg:pl-6 shrink-0">
                          <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 hidden lg:block">Dispatch Action</p>
                          <button
                            onClick={() => handleStatusUpdate(item.id, 'investigating')}
                            disabled={item.status === 'investigating'}
                            className={`w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                              item.status === 'investigating'
                                ? 'bg-orange-100 text-orange-700 border border-orange-200'
                                : 'bg-gray-50 text-gray-600 hover:bg-orange-50 hover:text-orange-700'
                            }`}
                          >
                            Investigate
                          </button>
                          <button
                            onClick={() => handleStatusUpdate(item.id, 'resolved')}
                            disabled={item.status === 'resolved'}
                            className={`w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                              item.status === 'resolved'
                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                : 'bg-gray-50 text-gray-600 hover:bg-emerald-50 hover:text-emerald-700'
                            }`}
                          >
                            Resolve
                          </button>
                          <button
                            onClick={() => handleStatusUpdate(item.id, 'pending')}
                            disabled={item.status === 'pending'}
                            className={`w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                              item.status === 'pending'
                                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                : 'bg-gray-50 text-gray-600 hover:bg-amber-50 hover:text-amber-700'
                            }`}
                          >
                            Reopen
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
