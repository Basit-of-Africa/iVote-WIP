import React, { useState } from 'react';
import { 
  Vote, 
  Calendar, 
  MapPin, 
  Users, 
  CheckCircle2, 
  Clock, 
  Layers, 
  ArrowRight, 
  Search,
  Filter,
  ShieldCheck,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { AVAILABLE_ELECTIONS, ELECTION_LEVEL_LABELS, OSUN_STATE_LGAS } from '../constants/elections';
import { ElectionScope } from '../types';
import PageHeader from '../components/common/PageHeader';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';
import EmptyState from '../components/common/EmptyState';
import { toast } from 'sonner';

interface ElectionRoundMeta extends ElectionScope {
  status: 'active' | 'scheduled' | 'concluded';
  phase: string;
  date: string;
  totalPollingUnits: number;
  coveredUnits: number;
  deployedObservers: number;
  registeredVoters: string;
}

const ELECTION_ROUNDS_DATA: ElectionRoundMeta[] = [
  {
    ...AVAILABLE_ELECTIONS[0], // Osun Gubernatorial
    status: 'active',
    phase: 'voting',
    date: 'Saturday, August 08, 2026',
    totalPollingUnits: 3763,
    coveredUnits: 1204,
    deployedObservers: 1450,
    registeredVoters: '1,955,657'
  },
  {
    ...AVAILABLE_ELECTIONS[1], // 2027 Federal General
    status: 'scheduled',
    phase: 'pre-voting',
    date: 'Saturday, February 20, 2027',
    totalPollingUnits: 176846,
    coveredUnits: 0,
    deployedObservers: 120,
    registeredVoters: '93,469,008'
  },
  {
    ...AVAILABLE_ELECTIONS[2], // 2027 State Governorships
    status: 'scheduled',
    phase: 'pre-voting',
    date: 'Saturday, March 06, 2027',
    totalPollingUnits: 128500,
    coveredUnits: 0,
    deployedObservers: 45,
    registeredVoters: '68,230,000'
  }
];

export default function ElectionRounds() {
  const [selectedElectionId, setSelectedElectionId] = useState<string>(() => {
    return localStorage.getItem('iVote_selected_election') || AVAILABLE_ELECTIONS[0].id;
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'scheduled' | 'concluded'>('all');

  const handleSelectElection = (election: ElectionRoundMeta) => {
    setSelectedElectionId(election.id);
    localStorage.setItem('iVote_selected_election', election.id);
    window.dispatchEvent(new CustomEvent('ivote:election_scope_changed', { detail: election.id }));
    toast.success(`Active election set to ${election.name}`);
  };

  const filteredElections = ELECTION_ROUNDS_DATA.filter((round) => {
    const matchesSearch = round.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (round.state && round.state.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (round.description && round.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || round.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeRound = ELECTION_ROUNDS_DATA.find(r => r.id === selectedElectionId) || ELECTION_ROUNDS_DATA[0];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageHeader
        title="Election Rounds"
        description="Monitor ongoing election cycles, view phase timelines, and configure the active observation scope."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Election Rounds' }
        ]}
        badge={{
          label: `${activeRound.name} (Active Scope)`,
          variant: 'emerald'
        }}
      />

      {/* Overview Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard
          title="Active Election Rounds"
          value={ELECTION_ROUNDS_DATA.filter(r => r.status === 'active').length}
          subtitle="Real-time field monitoring active"
          icon={Vote}
          colorScheme="emerald"
        />
        <StatCard
          title="Total Registered PUs"
          value={activeRound.totalPollingUnits.toLocaleString()}
          subtitle={`Scope: ${activeRound.state || 'National'}`}
          icon={MapPin}
          colorScheme="indigo"
        />
        <StatCard
          title="Deployed Observers"
          value={activeRound.deployedObservers.toLocaleString()}
          subtitle="Accredited field personnel"
          icon={Users}
          colorScheme="blue"
        />
        <StatCard
          title="Current Cycle Phase"
          value="Voting Active"
          subtitle="Accreditation & Ballot Casting"
          icon={Clock}
          colorScheme="amber"
        />
      </div>

      {/* Active Election Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 border border-slate-800 shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                Active Observation Scope
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-serif">{activeRound.name}</h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              {activeRound.description}
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                {activeRound.date}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                {activeRound.state ? `${activeRound.state} (30 LGAs)` : 'National Scope (36 States + FCT)'}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                {activeRound.registeredVoters} Registered Voters
              </span>
            </div>
          </div>

          <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-2 shrink-0">
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PU Coverage</p>
              <p className="text-2xl font-bold text-emerald-400 tabular-nums">
                {Math.round((activeRound.coveredUnits / activeRound.totalPollingUnits) * 100)}%
              </p>
              <p className="text-[11px] text-slate-400">
                {activeRound.coveredUnits.toLocaleString()} of {activeRound.totalPollingUnits.toLocaleString()} units
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search election rounds or states..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'active', 'scheduled', 'concluded'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === status
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Rounds List */}
      <div className="space-y-4">
        {filteredElections.length === 0 ? (
          <EmptyState
            icon={Vote}
            title="No election rounds found"
            description="No election cycles matched your search filters. Try clearing or broadening your criteria."
            action={{
              label: 'Reset Filters',
              onClick: () => {
                setSearchTerm('');
                setStatusFilter('all');
              }
            }}
          />
        ) : (
          filteredElections.map((round) => {
            const isCurrent = round.id === selectedElectionId;
            return (
              <div
                key={round.id}
                className={`bg-white rounded-2xl border transition-all duration-200 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xs ${
                  isCurrent
                    ? 'border-emerald-500 ring-2 ring-emerald-500/10'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="space-y-2 max-w-3xl">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <StatusBadge category="election_phase" value={round.phase} size="sm" />
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                      round.status === 'active' 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {round.status}
                    </span>
                    {isCurrent && (
                      <span className="text-[11px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-md uppercase tracking-wider">
                        Active Scope
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-gray-900 font-serif">{round.name}</h3>
                  <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{round.description}</p>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 pt-1">
                    <span>
                      <strong>Date:</strong> {round.date}
                    </span>
                    <span>•</span>
                    <span>
                      <strong>Level:</strong> {ELECTION_LEVEL_LABELS[round.level]?.short || round.level}
                    </span>
                    <span>•</span>
                    <span>
                      <strong>Polling Units:</strong> {round.totalPollingUnits.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-start md:self-center">
                  {!isCurrent ? (
                    <button
                      type="button"
                      onClick={() => handleSelectElection(round)}
                      className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer min-h-[38px]"
                    >
                      Set as Active Scope
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Current Monitor Target</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
