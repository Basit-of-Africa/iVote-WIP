import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, CheckInStatus } from '../types';
import {
  CheckCircle2,
  Clock,
  Navigation,
  MapPin,
  Search,
  Users,
  ExternalLink,
  ShieldCheck,
  Compass,
  FileText,
  Filter,
  BarChart2,
  AlertCircle
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { motion } from 'motion/react';
import ObserverDrawer from './ObserverDrawer';

interface AttendanceDashboardProps {
  compact?: boolean;
}

export default function AttendanceDashboard({ compact = false }: AttendanceDashboardProps) {
  const [observers, setObservers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [selectedObserver, setSelectedObserver] = useState<User | null>(null);

  useEffect(() => {
    const usersQuery = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
      // Sort: Checked in first, then en route, then not checked in
      const sorted = docs.sort((a, b) => {
        const order = { checked_in: 1, en_route: 2, not_checked_in: 3 };
        const scoreA = order[a.checkInStatus || 'not_checked_in'] || 3;
        const scoreB = order[b.checkInStatus || 'not_checked_in'] || 3;
        return scoreA - scoreB;
      });
      setObservers(sorted);
      setLoading(false);
    }, (error) => {
      console.warn('Error fetching observer attendance:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter observers
  const filteredObservers = observers.filter(obs => {
    const matchesSearch =
      (obs.displayName && obs.displayName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (obs.email && obs.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (obs.assignedPollingUnitId && obs.assignedPollingUnitId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (obs.assignedPollingUnitName && obs.assignedPollingUnitName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (obs.state && obs.state.toLowerCase().includes(searchTerm.toLowerCase()));

    const obsStatus = obs.checkInStatus || 'not_checked_in';
    const matchesStatus = statusFilter === 'all' || obsStatus === statusFilter;
    const matchesState = stateFilter === 'all' || obs.state === stateFilter;

    return matchesSearch && matchesStatus && matchesState;
  });

  // Calculate statistics
  const totalCount = observers.length;
  const checkedInCount = observers.filter(o => o.checkInStatus === 'checked_in').length;
  const enRouteCount = observers.filter(o => o.checkInStatus === 'en_route').length;
  const pendingCount = observers.filter(o => !o.checkInStatus || o.checkInStatus === 'not_checked_in').length;
  const geoVerifiedCount = observers.filter(o => o.checkInLat && o.checkInLng).length;

  const checkedInPercentage = totalCount > 0 ? Math.round((checkedInCount / totalCount) * 100) : 0;

  // States list for dropdown
  const statesList = Array.from(new Set(observers.map(o => o.state).filter(Boolean))) as string[];

  return (
    <div className="space-y-6">
      {/* Attendance Metric Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-400 font-bold uppercase tracking-wider">
            <span>Total Observers</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-serif font-extrabold text-gray-900">{totalCount}</div>
          <div className="text-[11px] text-gray-500 font-medium">Field Roster Roster</div>
        </div>

        <div className="bg-emerald-50/60 p-5 rounded-3xl border border-emerald-200/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-emerald-700 font-bold uppercase tracking-wider">
            <span>Checked In (On Site)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-serif font-extrabold text-emerald-900">{checkedInCount}</div>
          <div className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
            <span>{checkedInPercentage}% Attendance Rate</span>
          </div>
        </div>

        <div className="bg-amber-50/60 p-5 rounded-3xl border border-amber-200/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-amber-800 font-bold uppercase tracking-wider">
            <span>En Route</span>
            <Navigation className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-3xl font-serif font-extrabold text-amber-900">{enRouteCount}</div>
          <div className="text-[11px] text-amber-800 font-medium">In Transit to Stations</div>
        </div>

        <div className="bg-gray-50 p-5 rounded-3xl border border-gray-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-600 font-bold uppercase tracking-wider">
            <span>Pending Check-in</span>
            <Clock className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-3xl font-serif font-extrabold text-gray-800">{pendingCount}</div>
          <div className="text-[11px] text-gray-500 font-medium">Awaiting Arrival Signal</div>
        </div>
      </div>

      {/* Main Attendance List Card */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 font-serif flex items-center gap-2">
              <Compass className="w-5 h-5 text-emerald-600" />
              Observer Polling Unit Attendance Roster
            </h3>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Live arrival reports, timestamped GPS coordinates, and duty status log
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
              {geoVerifiedCount} GPS Verified
            </span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search observer name, email, PU ID, or station..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="all">All Attendance Statuses</option>
            <option value="checked_in">Checked In (On Site)</option>
            <option value="en_route">En Route</option>
            <option value="not_checked_in">Pending / Not Checked In</option>
          </select>

          {statesList.length > 0 && (
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="all">All States</option>
              {statesList.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          )}
        </div>

        {/* Roster Table */}
        {loading ? (
          <div className="p-12 text-center text-gray-400 space-y-2">
            <div className="w-7 h-7 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-medium">Loading attendance roster...</p>
          </div>
        ) : filteredObservers.length === 0 ? (
          <div className="p-12 text-center text-gray-500 space-y-2 bg-gray-50/50 rounded-2xl">
            <AlertCircle className="w-8 h-8 text-gray-300 mx-auto" />
            <p className="text-sm font-bold text-gray-700">No observers match filters</p>
            <p className="text-xs text-gray-400">Try adjusting your search criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider text-[10px] border-y border-gray-100">
                <tr>
                  <th className="py-3 px-4">Observer</th>
                  <th className="py-3 px-4">Assigned Duty Station</th>
                  <th className="py-3 px-4">Attendance Status</th>
                  <th className="py-3 px-4">Location / GPS</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredObservers.map((obs) => {
                  const statusKey = obs.checkInStatus || 'not_checked_in';
                  const isCheckedIn = statusKey === 'checked_in';
                  const isEnRoute = statusKey === 'en_route';

                  return (
                    <tr key={obs.uid} className="hover:bg-gray-50/80 transition-colors">
                      {/* Observer Info */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900 text-xs">{obs.displayName || 'Field Observer'}</div>
                        <div className="text-gray-400 font-mono text-[11px]">{obs.email}</div>
                      </td>

                      {/* Station Info */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-800 font-serif flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          {obs.assignedPollingUnitId || 'PU-FIELD'}
                        </div>
                        <div className="text-gray-500 text-[11px] line-clamp-1">
                          {obs.assignedPollingUnitName || 'Assigned Polling Unit'} ({obs.state || 'Lagos'})
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                          isCheckedIn
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : isEnRoute
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${
                            isCheckedIn ? 'bg-emerald-600 animate-pulse' : isEnRoute ? 'bg-amber-600' : 'bg-gray-400'
                          }`} />
                          {statusKey.replace('_', ' ')}
                        </span>
                        {obs.checkInTimestamp && (
                          <div className="text-[10px] text-gray-400 mt-0.5 font-medium">
                            {formatDistanceToNow(new Date(obs.checkInTimestamp), { addSuffix: true })}
                          </div>
                        )}
                      </td>

                      {/* GPS info */}
                      <td className="py-3.5 px-4">
                        {obs.checkInLat && obs.checkInLng ? (
                          <div className="space-y-0.5">
                            <a
                              href={`https://www.google.com/maps?q=${obs.checkInLat},${obs.checkInLng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-emerald-700 font-mono font-bold hover:underline"
                            >
                              <span>{obs.checkInLat.toFixed(4)}, {obs.checkInLng.toFixed(4)}</span>
                              <ExternalLink className="w-3 h-3 text-emerald-600" />
                            </a>
                            <div className="text-[10px] text-gray-400">
                              Accuracy: ±{obs.checkInAccuracy || 12}m
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[11px] italic">No GPS signal</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedObserver(obs)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-emerald-50 text-gray-700 hover:text-emerald-800 font-bold rounded-xl border border-gray-200 transition-all text-[11px]"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Observer Details Slide-Over Drawer */}
      <ObserverDrawer
        observer={selectedObserver}
        isOpen={Boolean(selectedObserver)}
        onClose={() => setSelectedObserver(null)}
      />
    </div>
  );
}
