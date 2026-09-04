import React, { useEffect, useState, useMemo } from 'react';
import { APIProvider, Map, Marker, InfoWindow } from '@vis.gl/react-google-maps';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Report } from '../types';
import { AlertTriangle, MapPin, Clock, ShieldAlert, Flame, FileText, Truck, Users, ClipboardCheck, Filter, Eye, EyeOff, Layers, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';

const env = (import.meta as any).env || {};
const cleanKey = (val?: string) => val ? val.replace(/^["']|["']$/g, '').trim() : '';

const GOOGLE_MAPS_API_KEY = cleanKey(env.VITE_GOOGLE_MAPS_API_KEY) || cleanKey(process.env.VITE_GOOGLE_MAPS_API_KEY) || '';

export interface CategoryConfig {
  id: string;
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  icon: React.ElementType;
  description: string;
}

export const CATEGORIES: Record<string, CategoryConfig> = {
  violence: {
    id: 'violence',
    label: 'Violence & Security',
    color: '#DC2626',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    borderColor: 'border-red-300',
    icon: Flame,
    description: 'Assaults, harassment, intimidation, or physical disruptions',
  },
  ballot: {
    id: 'ballot',
    label: 'Ballot & Voting Issues',
    color: '#9333EA',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-300',
    icon: FileText,
    description: 'Ballot box snatching, vote buying, or paper shortages',
  },
  logistics: {
    id: 'logistics',
    label: 'Logistics & Tech Delays',
    color: '#D97706',
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-300',
    icon: Truck,
    description: 'BVAS failure, late arrival of INEC officials or materials',
  },
  general: {
    id: 'general',
    label: 'General Incidents',
    color: '#EA580C',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-300',
    icon: ShieldAlert,
    description: 'Uncategorized or general field irregularities',
  },
  accreditation: {
    id: 'accreditation',
    label: 'Accreditation Logs',
    color: '#141A56',
    bgColor: 'bg-emerald-100',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-300',
    icon: Users,
    description: 'Voter headcount logs & routine check-ins',
  },
  result: {
    id: 'result',
    label: 'Result Uploads',
    color: '#2563EB',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-300',
    icon: ClipboardCheck,
    description: 'Polling unit result declarations & tally sheets',
  },
};

export function getReportCategory(report: Report): string {
  if (report.type === 'accreditation') return 'accreditation';
  if (report.type === 'result') return 'result';

  const desc = (report.payload?.description || '').toLowerCase();
  const cat = (report.payload?.category || '').toLowerCase();
  const sev = (report.payload?.severity || '').toLowerCase();

  if (cat === 'violence' || desc.includes('violenc') || desc.includes('fight') || desc.includes('thug') || desc.includes('gun') || desc.includes('attack') || desc.includes('harass') || sev === 'critical') {
    return 'violence';
  }
  if (cat === 'ballot' || desc.includes('ballot') || desc.includes('snatch') || desc.includes('buying') || desc.includes('vote buy') || desc.includes('stuffed')) {
    return 'ballot';
  }
  if (cat === 'logistics' || desc.includes('bvas') || desc.includes('delay') || desc.includes('machine') || desc.includes('late') || desc.includes('material') || desc.includes('transport')) {
    return 'logistics';
  }
  return 'general';
}

const markerIconCache: Record<string, string> = {};

function getMarkerIcon(color: string) {
  if (markerIconCache[color]) return markerIconCache[color];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40">
    <path fill="${color}" stroke="#FFFFFF" stroke-width="2" d="M15 0C6.716 0 0 6.716 0 15c0 11.25 15 25 15 25s15-13.75 15-25C30 6.716 23.284 0 15 0z"/>
    <circle cx="15" cy="15" r="5.5" fill="#FFFFFF"/>
  </svg>`;
  const iconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  markerIconCache[color] = iconUrl;
  return iconUrl;
}

export default function MapPage() {
  const { user, isAdmin, isSupervisor } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [activeCategories, setActiveCategories] = useState<Record<string, boolean>>({
    violence: true,
    ballot: true,
    logistics: true,
    general: true,
    accreditation: true,
    result: true,
  });
  const [isLegendExpanded, setIsLegendExpanded] = useState<boolean>(true);

  useEffect(() => {
    if (!user) return;

    // Observers only see their own markers to comply with security rules
    const reportsBaseQuery = collection(db, 'reports');
    const q = (!isAdmin && !isSupervisor)
      ? query(reportsBaseQuery, where('observerId', '==', user.uid))
      : query(reportsBaseQuery);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs
        .map(doc => {
          const data = doc.data() as Report;
          let lat = data.location?.lat;
          let lng = data.location?.lng;

          // Parse numeric coordinates if stored as strings
          if (typeof lat === 'string') lat = parseFloat(lat);
          if (typeof lng === 'string') lng = parseFloat(lng);

          // If no GPS coordinates stored, assign regional fallback coordinates based on pollingUnitId hash
          if ((!lat || !lng || isNaN(lat) || isNaN(lng))) {
            const hash = (data.pollingUnitId || data.id || '').split('').reduce((a, b) => a + b.charCodeAt(0), 0);
            const defaultCenters = [
              { lat: 9.0765, lng: 7.3986 }, // Abuja
              { lat: 6.5244, lng: 3.3792 }, // Lagos
              { lat: 12.0022, lng: 8.5920 }, // Kano
              { lat: 4.8156, lng: 7.0498 }, // Port Harcourt
              { lat: 6.4584, lng: 7.5464 }, // Enugu
              { lat: 10.5105, lng: 7.4165 }, // Kaduna
            ];
            const chosen = defaultCenters[hash % defaultCenters.length];
            // Add tiny jitter
            lat = chosen.lat + ((hash % 10) - 5) * 0.01;
            lng = chosen.lng + ((hash % 7) - 3) * 0.01;
          }

          return {
            id: doc.id,
            ...data,
            location: { lat, lng }
          } as Report;
        });
      setReports(docs);
    });

    return () => unsubscribe();
  }, [user, isAdmin, isSupervisor]);

  // Compute reports with categories
  const categorizedReports = useMemo(() => {
    return reports.map(r => ({
      ...r,
      categoryKey: getReportCategory(r)
    }));
  }, [reports]);

  // Filtered reports based on legend toggles
  const visibleReports = useMemo(() => {
    return categorizedReports.filter(r => activeCategories[r.categoryKey] !== false);
  }, [categorizedReports, activeCategories]);

  // Count reports per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      violence: 0,
      ballot: 0,
      logistics: 0,
      general: 0,
      accreditation: 0,
      result: 0,
    };
    categorizedReports.forEach(r => {
      if (counts[r.categoryKey] !== undefined) {
        counts[r.categoryKey]++;
      }
    });
    return counts;
  }, [categorizedReports]);

  const toggleCategory = (catKey: string) => {
    setActiveCategories(prev => ({
      ...prev,
      [catKey]: !prev[catKey]
    }));
  };

  const toggleAllCategories = (enable: boolean) => {
    const next: Record<string, boolean> = {};
    Object.keys(CATEGORIES).forEach(k => {
      next[k] = enable;
    });
    setActiveCategories(next);
  };

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center p-10">
        <MapPin className="w-20 h-20 text-gray-200 mb-6" />
        <h2 className="text-2xl font-bold text-gray-900 font-serif">Map Key Required</h2>
        <p className="text-gray-500 mt-2 max-w-md mx-auto">
          Please add <code>VITE_GOOGLE_MAPS_API_KEY</code> to your environment variables to enable the interactive field map.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col gap-4">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight font-serif">Tactical Incident Map</h1>
          <p className="text-gray-500 mt-1 text-sm md:text-base font-medium">Real-time geographic visualization & categorized incident markers.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLegendExpanded(!isLegendExpanded)}
            className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl border border-gray-200 shadow-sm text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Layers className="w-4 h-4 text-emerald-600" />
            <span>Map Legend ({visibleReports.length}/{reports.length})</span>
          </button>
        </div>
      </div>

      {/* Main Map Canvas Container */}
      <div className="flex-1 rounded-[32px] md:rounded-[40px] overflow-hidden border-4 md:border-8 border-white shadow-2xl relative">
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
          <Map
            style={{ width: '100%', height: '100%' }}
            defaultCenter={{ lat: 9.0820, lng: 8.6753 }} // Nigeria center
            defaultZoom={6}
            gestureHandling={'greedy'}
            disableDefaultUI={false}
          >
            {visibleReports.map((report) => {
              const cat = CATEGORIES[report.categoryKey] || CATEGORIES.general;
              const iconUrl = getMarkerIcon(cat.color);

              return (
                <Marker
                  key={report.id}
                  position={{ lat: report.location!.lat, lng: report.location!.lng }}
                  icon={iconUrl}
                  onClick={() => setSelectedReport(report)}
                />
              );
            })}

            {selectedReport && (() => {
              const catKey = getReportCategory(selectedReport);
              const cat = CATEGORIES[catKey] || CATEGORIES.general;
              const IconComp = cat.icon;

              return (
                <InfoWindow
                  position={{ lat: selectedReport.location!.lat, lng: selectedReport.location!.lng }}
                  onCloseClick={() => setSelectedReport(null)}
                >
                  <div className="p-3 min-w-[220px] max-w-[300px]">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${cat.bgColor} ${cat.textColor}`}>
                        <IconComp className="w-3 h-3" />
                        {cat.label}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono font-bold">#{selectedReport.pollingUnitId}</span>
                    </div>

                    <p className="text-xs font-semibold text-gray-900 leading-snug mb-3">
                      {selectedReport.payload?.description || 'No description provided'}
                    </p>

                    {selectedReport.payload?.severity && (
                      <div className="mb-2 flex items-center gap-1.5 text-[10px]">
                        <span className="text-gray-400 font-medium">Severity:</span>
                        <span className={`font-bold uppercase ${
                          selectedReport.payload.severity === 'critical' ? 'text-red-600' :
                          selectedReport.payload.severity === 'high' ? 'text-orange-600' :
                          selectedReport.payload.severity === 'medium' ? 'text-amber-600' : 'text-blue-600'
                        }`}>
                          {selectedReport.payload.severity}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-[10px] text-gray-400 border-t border-gray-100 pt-2">
                      <Clock className="w-3 h-3 text-gray-400" />
                      {new Date(selectedReport.timestamp as any).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </div>
                </InfoWindow>
              );
            })()}
          </Map>
        </APIProvider>

        {/* Floating Interactive Legend Overlay */}
        <AnimatePresence>
          {isLegendExpanded && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="absolute top-4 right-4 z-10 w-72 md:w-80 bg-white/95 backdrop-blur-md rounded-3xl border border-gray-100 shadow-xl p-4 flex flex-col gap-3 max-h-[calc(100%-32px)] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Incident Categories</h3>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <button
                    onClick={() => toggleAllCategories(true)}
                    className="text-emerald-600 hover:underline font-bold"
                  >
                    All
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={() => toggleAllCategories(false)}
                    className="text-gray-400 hover:underline font-bold"
                  >
                    None
                  </button>
                </div>
              </div>

              {/* Category Badges Grid */}
              <div className="space-y-1.5">
                {Object.values(CATEGORIES).map((cat) => {
                  const isActive = activeCategories[cat.id] !== false;
                  const count = categoryCounts[cat.id] || 0;
                  const IconComponent = cat.icon;

                  return (
                    <button
                      key={cat.id}
                      onClick={() => toggleCategory(cat.id)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-2xl border transition-all text-left group ${
                        isActive
                          ? 'bg-white border-gray-200 shadow-2xs hover:border-gray-300'
                          : 'bg-gray-50/70 border-transparent opacity-50 hover:opacity-80'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-3.5 h-3.5 rounded-full flex-shrink-0 border border-white shadow-2xs"
                          style={{ backgroundColor: cat.color }}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-800 truncate flex items-center gap-1.5">
                            <IconComponent className="w-3 h-3 text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
                            {cat.label}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          count > 0 ? `${cat.bgColor} ${cat.textColor}` : 'bg-gray-100 text-gray-400'
                        }`}>
                          {count}
                        </span>
                        {isActive ? (
                          <Eye className="w-3.5 h-3.5 text-gray-400 group-hover:text-emerald-600" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5 text-gray-300" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
                <span className="flex items-center gap-1">
                  <Info className="w-3 h-3" /> Click category to toggle visibility
                </span>
                <span className="font-bold text-gray-600">{visibleReports.length} visible</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {reports.length === 0 && (
          <div className="absolute bottom-6 left-6 p-5 bg-white/95 backdrop-blur-md rounded-3xl border border-white shadow-xl max-w-xs">
            <h4 className="font-bold text-gray-900 flex items-center gap-2 text-xs">
              <ShieldAlert className="text-emerald-600 w-4 h-4" />
              Limited Geographic Data
            </h4>
            <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
              Most reports currently missing GPS coordinates. Map fallback locations applied for active field markers.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

