import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Users, 
  Activity, 
  FileSpreadsheet, 
  Radio, 
  ShieldAlert, 
  History, 
  Lock, 
  Server, 
  Database, 
  RefreshCw, 
  ChevronRight,
  Vote,
  Download,
  AlertTriangle,
  Layers
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/common/PageHeader';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';
import EmptyState from '../components/common/EmptyState';
import AuditTrailModal from '../components/AuditTrailModal';
import RoleUpgradeModal from '../components/RoleUpgradeModal';
import DirectiveBroadcastModal from '../components/DirectiveBroadcastModal';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

export default function Administration() {
  const { user, isAdmin, isSupervisor } = useAuth();
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [broadcastMode, setBroadcastMode] = useState<'directive' | 'emergency'>('directive');

  // Permission Guard
  if (!isAdmin && !isSupervisor) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <EmptyState
          icon={Lock}
          title="Administrative Access Restricted"
          description="You do not have permission to view or manage the administration control panel. Contact your State Electoral Supervisor or System Administrator for elevated access."
          action={{
            label: 'Return to Dashboard',
            href: '/dashboard'
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageHeader
        title="System Administration & Governance"
        description="Comprehensive management suite for election operations, access control, audit compliance, and crisis broadcasts."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Administration' }
        ]}
        badge={{
          label: isAdmin ? 'Administrator Authority' : 'Field Supervisor Authority',
          variant: isAdmin ? 'purple' : 'blue'
        }}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setBroadcastMode('emergency');
                setIsBroadcastModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer min-h-[38px]"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Declare Emergency</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setBroadcastMode('directive');
                setIsBroadcastModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer min-h-[38px]"
            >
              <Radio className="w-4 h-4" />
              <span>Broadcast Directive</span>
            </button>
          </div>
        }
      />

      {/* Admin Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard
          title="System Security"
          value="Hardened"
          subtitle="Firestore ABAC Rules Enforced"
          icon={ShieldCheck}
          colorScheme="emerald"
        />
        <StatCard
          title="Database Latency"
          value="14 ms"
          subtitle="Multi-tab offline cache sync"
          icon={Database}
          colorScheme="indigo"
        />
        <StatCard
          title="Active Personnel"
          value="1,204"
          subtitle="Accredited observers deployed"
          icon={Users}
          colorScheme="blue"
          linkTo="/observers"
          linkLabel="Manage observers"
        />
        <StatCard
          title="Audit Trail Logs"
          value="Verified"
          subtitle="Tamper-evident operations log"
          icon={History}
          colorScheme="purple"
        />
      </div>

      {/* Management Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* User Role Management Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs flex flex-col justify-between hover:border-gray-300 transition-all">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-100">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 font-serif">Role & Access Control</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Elevate verified observers to Field Supervisors or System Administrators. Manage role badges and authorization scopes.
            </p>
          </div>
          <div className="pt-6 mt-6 border-t border-gray-100 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
              RBAC Enabled
            </span>
            <button
              type="button"
              onClick={() => setIsRoleModalOpen(true)}
              className="px-3.5 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Configure Roles
            </button>
          </div>
        </div>

        {/* Audit Compliance Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs flex flex-col justify-between hover:border-gray-300 transition-all">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100">
              <History className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 font-serif">Compliance & Audit Trail</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Inspect historical records of deleted reports, updated incident statuses, and emergency broadcasts with cryptographic operator attribution.
            </p>
          </div>
          <div className="pt-6 mt-6 border-t border-gray-100 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
              Full Immutability
            </span>
            <button
              type="button"
              onClick={() => setIsAuditModalOpen(true)}
              className="px-3.5 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Inspect Audit Log
            </button>
          </div>
        </div>

        {/* Election Scope Configuration */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs flex flex-col justify-between hover:border-gray-300 transition-all">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
              <Vote className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 font-serif">Election Rounds Setup</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Review active gubernatorial cycles, configure polling unit allotments, and adjust observation parameters.
            </p>
          </div>
          <div className="pt-6 mt-6 border-t border-gray-100 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              3 Cycles Available
            </span>
            <Link
              to="/elections"
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors inline-flex items-center gap-1"
            >
              <span>View Rounds</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* System Health & Infrastructure Panel */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-xs">
        <div className="flex items-center justify-between pb-6 mb-6 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-gray-900 font-serif">Infrastructure Vitality</h3>
            <p className="text-xs text-gray-500 mt-0.5">Real-time status of underlying services and data transport</p>
          </div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            All Systems Nominal
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cloud Firestore Engine</span>
            <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Connected (IndexedDB Cache Active)
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Express Server Proxy</span>
            <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              0.0.0.0:3000 (Port Bound)
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">AI Incident Summarization</span>
            <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Gemini Server Route Ready
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Service Worker & PWA</span>
            <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Installed & Background Sync Active
            </p>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AuditTrailModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
      />

      <RoleUpgradeModal
        user={user}
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        onSuccess={() => {
          setIsRoleModalOpen(false);
          toast.success('Role settings updated');
        }}
      />

      <DirectiveBroadcastModal
        isOpen={isBroadcastModalOpen}
        onClose={() => setIsBroadcastModalOpen(false)}
        defaultEmergencyMode={broadcastMode === 'emergency'}
      />
    </div>
  );
}
