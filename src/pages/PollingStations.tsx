import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  MapPin, 
  Search, 
  Filter, 
  Users, 
  ShieldCheck, 
  AlertTriangle, 
  PlusCircle, 
  ExternalLink, 
  CheckCircle2,
  XCircle,
  FileText
} from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/common/PageHeader';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';
import EmptyState from '../components/common/EmptyState';
import { OSUN_STATE_LGAS } from '../constants/elections';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface PollingStationItem {
  id: string;
  name: string;
  lga: string;
  ward: string;
  state: string;
  registeredVoters: number;
  observerAssigned: boolean;
  assignedObserverName?: string;
  hasIncident: boolean;
  incidentCount?: number;
  status: 'active' | 'pending' | 'reported';
}

const DEFAULT_POLLING_STATIONS: PollingStationItem[] = [
  {
    id: 'PU-29-01-001',
    name: 'Town Hall Square, Ward 01',
    lga: 'Osogbo',
    ward: 'Ataoja A',
    state: 'Osun',
    registeredVoters: 750,
    observerAssigned: true,
    assignedObserverName: 'Adewale Adeleke',
    hasIncident: false,
    status: 'reported'
  },
  {
    id: 'PU-29-01-002',
    name: 'Community Grammar School, Main Gate',
    lga: 'Osogbo',
    ward: 'Ataoja B',
    state: 'Osun',
    registeredVoters: 920,
    observerAssigned: true,
    assignedObserverName: 'Folake Balogun',
    hasIncident: true,
    incidentCount: 1,
    status: 'active'
  },
  {
    id: 'PU-29-02-004',
    name: 'Primary Health Care Centre Open Field',
    lga: 'Ife Central',
    ward: 'Ilare I',
    state: 'Osun',
    registeredVoters: 640,
    observerAssigned: true,
    assignedObserverName: 'Chinedu Eze',
    hasIncident: false,
    status: 'reported'
  },
  {
    id: 'PU-29-02-008',
    name: 'St. Peter Anglican School Compound',
    lga: 'Ife Central',
    ward: 'Moore',
    state: 'Osun',
    registeredVoters: 810,
    observerAssigned: false,
    hasIncident: false,
    status: 'pending'
  },
  {
    id: 'PU-29-03-012',
    name: 'Court Hall Premises, Ede South',
    lga: 'Ede South',
    ward: 'Babanla',
    state: 'Osun',
    registeredVoters: 580,
    observerAssigned: true,
    assignedObserverName: 'Ibrahim Sanni',
    hasIncident: false,
    status: 'active'
  },
  {
    id: 'PU-29-04-003',
    name: 'Ansar-Ud-Deen Primary School',
    lga: 'Ede North',
    ward: 'Abogunde',
    state: 'Osun',
    registeredVoters: 690,
    observerAssigned: false,
    hasIncident: true,
    incidentCount: 2,
    status: 'active'
  },
  {
    id: 'PU-29-05-001',
    name: 'African Church Primary School',
    lga: 'Ilesa East',
    ward: 'Bolorunduro',
    state: 'Osun',
    registeredVoters: 840,
    observerAssigned: true,
    assignedObserverName: 'Bisi Ogundipe',
    hasIncident: false,
    status: 'reported'
  },
  {
    id: 'PU-29-06-005',
    name: 'Old Motor Park Pavillion',
    lga: 'Iwo',
    ward: 'Gidigbo I',
    state: 'Osun',
    registeredVoters: 715,
    observerAssigned: true,
    assignedObserverName: 'Kazeem Olatunji',
    hasIncident: false,
    status: 'active'
  },
  {
    id: 'PU-29-07-002',
    name: 'Methodist Primary School',
    lga: 'Ejigbo',
    ward: 'Elejigbo C',
    state: 'Osun',
    registeredVoters: 620,
    observerAssigned: false,
    hasIncident: false,
    status: 'pending'
  },
  {
    id: 'PU-29-08-001',
    name: 'St. John Catholic School Hall',
    lga: 'Orolu',
    ward: 'Ifon Ward 1',
    state: 'Osun',
    registeredVoters: 540,
    observerAssigned: true,
    assignedObserverName: 'Tunde Bakare',
    hasIncident: false,
    status: 'reported'
  }
];

export default function PollingStations() {
  const [stations, setStations] = useState<PollingStationItem[]>(DEFAULT_POLLING_STATIONS);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLGA, setSelectedLGA] = useState<string>('all');
  const [coverageFilter, setCoverageFilter] = useState<'all' | 'covered' | 'unassigned'>('all');
  const [incidentFilter, setIncidentFilter] = useState<'all' | 'incident' | 'clean'>('all');

  const filteredStations = stations.filter((station) => {
    const matchesSearch = 
      station.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      station.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      station.lga.toLowerCase().includes(searchTerm.toLowerCase()) ||
      station.ward.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesLGA = selectedLGA === 'all' || station.lga === selectedLGA;
    const matchesCoverage = 
      coverageFilter === 'all' || 
      (coverageFilter === 'covered' && station.observerAssigned) ||
      (coverageFilter === 'unassigned' && !station.observerAssigned);

    const matchesIncident = 
      incidentFilter === 'all' || 
      (incidentFilter === 'incident' && station.hasIncident) ||
      (incidentFilter === 'clean' && !station.hasIncident);

    return matchesSearch && matchesLGA && matchesCoverage && matchesIncident;
  });

  const totalUnits = stations.length;
  const coveredUnits = stations.filter(s => s.observerAssigned).length;
  const incidentUnits = stations.filter(s => s.hasIncident).length;
  const totalRegisteredVoters = stations.reduce((sum, s) => sum + s.registeredVoters, 0);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageHeader
        title="Polling Stations"
        description="Comprehensive registry of polling units, observer field assignments, and localized voting status across Osun State."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Polling Stations' }
        ]}
        badge={{
          label: `${coveredUnits}/${totalUnits} Stations Covered`,
          variant: 'emerald'
        }}
        actions={
          <Link
            to="/report"
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors min-h-[38px]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Submit Station Report</span>
          </Link>
        }
      />

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard
          title="Monitored Stations"
          value={totalUnits}
          subtitle="Directory catalog for active cycle"
          icon={Building2}
          colorScheme="indigo"
        />
        <StatCard
          title="Observer Coverage"
          value={`${Math.round((coveredUnits / totalUnits) * 100)}%`}
          subtitle={`${coveredUnits} assigned stations`}
          icon={ShieldCheck}
          colorScheme="emerald"
        />
        <StatCard
          title="Flagged Stations"
          value={incidentUnits}
          subtitle="Stations with recorded incidents"
          icon={AlertTriangle}
          colorScheme="red"
          badge={{ text: `${incidentUnits} alert`, variant: 'red' }}
        />
        <StatCard
          title="Registered Voters"
          value={totalRegisteredVoters.toLocaleString()}
          subtitle="Total in active monitoring buffer"
          icon={Users}
          colorScheme="blue"
        />
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by PU Code, Name, Ward, LGA..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* LGA Select */}
            <select
              aria-label="Filter by Local Government Area"
              value={selectedLGA}
              onChange={(e) => setSelectedLGA(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:bg-white focus:outline-none cursor-pointer"
            >
              <option value="all">All LGAs (Osun)</option>
              {OSUN_STATE_LGAS.map((lga) => (
                <option key={lga} value={lga}>{lga}</option>
              ))}
            </select>

            {/* Coverage filter */}
            <select
              aria-label="Filter by Observer Coverage"
              value={coverageFilter}
              onChange={(e) => setCoverageFilter(e.target.value as any)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:bg-white focus:outline-none cursor-pointer"
            >
              <option value="all">All Coverage</option>
              <option value="covered">Observer Assigned</option>
              <option value="unassigned">Unassigned</option>
            </select>

            {/* Incident filter */}
            <select
              aria-label="Filter by Incident Status"
              value={incidentFilter}
              onChange={(e) => setIncidentFilter(e.target.value as any)}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:bg-white focus:outline-none cursor-pointer"
            >
              <option value="all">All Incident Status</option>
              <option value="incident">Has Open Incident</option>
              <option value="clean">Clear (No Incidents)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stations Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
        {filteredStations.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Building2}
              title="No polling stations found"
              description="No stations match your active filters. Try broadening your LGA selection or search query."
              action={{
                label: 'Clear Filters',
                onClick: () => {
                  setSearchTerm('');
                  setSelectedLGA('all');
                  setCoverageFilter('all');
                  setIncidentFilter('all');
                }
              }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4 sm:px-6">Polling Unit</th>
                  <th className="py-3.5 px-4">Location (LGA / Ward)</th>
                  <th className="py-3.5 px-4 text-center">Voters</th>
                  <th className="py-3.5 px-4">Observer Status</th>
                  <th className="py-3.5 px-4 text-center">Security</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs sm:text-sm">
                {filteredStations.map((station) => (
                  <tr key={station.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-4 px-4 sm:px-6">
                      <div className="font-bold text-gray-900">{station.name}</div>
                      <div className="text-xs text-gray-500 font-mono mt-0.5">{station.id}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-medium text-gray-900">{station.lga}</div>
                      <div className="text-xs text-gray-500">{station.ward}</div>
                    </td>
                    <td className="py-4 px-4 text-center font-semibold text-gray-700 tabular-nums">
                      {station.registeredVoters.toLocaleString()}
                    </td>
                    <td className="py-4 px-4">
                      {station.observerAssigned ? (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="truncate max-w-[140px]">{station.assignedObserverName || 'Assigned'}</span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                          <XCircle className="w-3.5 h-3.5 text-gray-400" />
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {station.hasIncident ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                          {station.incidentCount || 1} Alert
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          Normal
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <Link
                        to={`/report?pollingUnitId=${encodeURIComponent(station.id)}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg border border-emerald-200 transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5 text-emerald-600" />
                        <span>File Report</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
