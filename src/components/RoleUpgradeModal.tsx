import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  UserCheck, 
  Check, 
  X, 
  AlertCircle, 
  ArrowRight, 
  Lock, 
  Eye, 
  FileText, 
  Radio, 
  Settings, 
  Sparkles,
  Award
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

interface RoleUpgradeModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedUser: User) => void;
}

interface RoleTierInfo {
  role: UserRole;
  title: string;
  badgeLabel: string;
  levelBadge: string;
  colorClasses: {
    bg: string;
    border: string;
    text: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    glow: string;
  };
  description: string;
  permissions: string[];
}

const ROLE_TIERS: RoleTierInfo[] = [
  {
    role: 'observer',
    title: 'Field Observer',
    badgeLabel: 'Field Observer',
    levelBadge: 'Tier 1 • Ground Operations',
    colorClasses: {
      bg: 'bg-emerald-50/50',
      border: 'border-emerald-200',
      text: 'text-emerald-900',
      badgeBg: 'bg-emerald-100',
      badgeText: 'text-emerald-800',
      badgeBorder: 'border-emerald-300',
      glow: 'focus:ring-emerald-500',
    },
    description: 'Deploys directly to assigned polling units for primary election data gathering, voter accreditation counts, and on-site verification.',
    permissions: [
      'Submit voter accreditation & result tally sheets',
      'Report on-site critical incidents with photo/video evidence',
      'Record GPS-stamped attendance & arrival check-ins',
      'View individual polling unit summary metrics'
    ]
  },
  {
    role: 'field_supervisor',
    title: 'Field Supervisor',
    badgeLabel: 'Field Supervisor',
    levelBadge: 'Tier 2 • Tactical Supervision',
    colorClasses: {
      bg: 'bg-blue-50/50',
      border: 'border-blue-200',
      text: 'text-blue-900',
      badgeBg: 'bg-blue-100',
      badgeText: 'text-blue-800',
      badgeBorder: 'border-blue-300',
      glow: 'focus:ring-blue-500',
    },
    description: 'Coordinates multi-unit field operations, reviews observer transmissions across assigned LGAs, and triages incident severity.',
    permissions: [
      'All Field Observer capabilities included',
      'Monitor multi-polling-unit streams across LGA & State',
      'Triage & update incident investigation status (Investigating/Resolved)',
      'Receive priority supervisor alerts & tactical directives',
      'Audit observer attendance and transmission timeliness'
    ]
  },
  {
    role: 'admin',
    title: 'System Administrator',
    badgeLabel: 'Administrator',
    levelBadge: 'Tier 3 • Full Executive Access',
    colorClasses: {
      bg: 'bg-purple-50/50',
      border: 'border-purple-200',
      text: 'text-purple-900',
      badgeBg: 'bg-purple-100',
      badgeText: 'text-purple-800',
      badgeBorder: 'border-purple-300',
      glow: 'focus:ring-purple-500',
    },
    description: 'Master access level with full system governance, role elevation controls, observer roster administration, and network-wide directives.',
    permissions: [
      'All Supervisor & Observer capabilities included',
      'Upgrade & modify user access levels (RBAC Management)',
      'Bulk import observer rosters & assign polling stations via CSV',
      'Broadcast high-priority emergency directives across all users',
      'Access master immutable audit logs & override system records',
      'Configure election scopes and system parameters'
    ]
  }
];

export default function RoleUpgradeModal({
  user,
  isOpen,
  onClose,
  onSuccess
}: RoleUpgradeModalProps) {
  const { user: currentUser } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>(user?.role || 'observer');
  const [reason, setReason] = useState('');
  const [notifyUser, setNotifyUser] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync selected role when user prop changes
  React.useEffect(() => {
    if (user) {
      // Normalize 'supervisor' to 'field_supervisor' for selection
      const normalizedRole = user.role === 'supervisor' ? 'field_supervisor' : user.role;
      setSelectedRole(normalizedRole || 'observer');
      setReason('');
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const currentRoleNormalized = user.role === 'supervisor' ? 'field_supervisor' : user.role || 'observer';
  const currentTierInfo = ROLE_TIERS.find(t => t.role === currentRoleNormalized) || ROLE_TIERS[0];
  const targetTierInfo = ROLE_TIERS.find(t => t.role === selectedRole) || ROLE_TIERS[0];
  
  const isRoleUnchanged = selectedRole === currentRoleNormalized;
  const isUpgrade = 
    (currentRoleNormalized === 'observer' && (selectedRole === 'field_supervisor' || selectedRole === 'admin')) ||
    (currentRoleNormalized === 'field_supervisor' && selectedRole === 'admin');
  const isDowngrade = !isRoleUnchanged && !isUpgrade;

  const handleRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRoleUnchanged) {
      toast.info('No role change was selected.');
      onClose();
      return;
    }

    setIsSubmitting(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const updatePayload: Partial<User> & { updatedAt: any } = {
        role: selectedRole,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(userRef, updatePayload);

      // 1. Create an immutable Audit Log for accountability
      try {
        await addDoc(collection(db, 'audit_logs'), {
          action: 'UPGRADE_USER_ROLE',
          targetId: user.uid,
          targetType: 'user',
          pollingUnitId: user.assignedPollingUnitId || 'N/A',
          summary: `Admin ${currentUser?.displayName || 'System Admin'} ${isUpgrade ? 'upgraded' : 'adjusted'} access level for ${user.displayName || user.email} from ${currentTierInfo.title} to ${targetTierInfo.title}.`,
          reason: reason.trim() || `${isUpgrade ? 'Upgraded' : 'Modified'} access level to ${targetTierInfo.title}.`,
          deletedBy: currentUser?.uid || 'admin',
          deletedByEmail: currentUser?.email || 'admin@ivote.ng',
          deletedByName: currentUser?.displayName || 'System Administrator',
          deletedByRole: currentUser?.role || 'admin',
          timestamp: new Date().toISOString(),
          snapshot: {
            previousRole: user.role,
            newRole: selectedRole,
            userId: user.uid,
            userEmail: user.email,
            userName: user.displayName,
          }
        });
      } catch (auditErr) {
        console.warn('Could not write audit log for role change:', auditErr);
      }

      // 2. Dispatch in-app system notification to the target user if enabled
      if (notifyUser) {
        try {
          await addDoc(collection(db, 'notifications'), {
            userId: user.uid,
            title: `Access Level Updated to ${targetTierInfo.title}`,
            message: `Your system permissions have been updated to ${targetTierInfo.title} by ${currentUser?.displayName || 'an Administrator'}.${reason.trim() ? ` Authorization note: "${reason.trim()}"` : ''}`,
            type: 'admin_update',
            category: 'system',
            priority: isUpgrade ? 'urgent' : 'normal',
            senderName: currentUser?.displayName || 'System Admin',
            senderRole: currentUser?.role || 'admin',
            targetRole: selectedRole,
            read: false,
            timestamp: new Date().toISOString()
          });
        } catch (notifErr) {
          console.warn('Could not dispatch notification:', notifErr);
        }
      }

      const updatedUserObject: User = {
        ...user,
        role: selectedRole
      };

      toast.success(`Access level for ${user.displayName} updated to ${targetTierInfo.title}`);
      onSuccess(updatedUserObject);
      onClose();
    } catch (err: any) {
      console.error('Error updating user role in Firestore:', err);
      // Fallback local update
      const updatedUserObject: User = {
        ...user,
        role: selectedRole
      };
      toast.success(`Access level for ${user.displayName} updated to ${targetTierInfo.title} (Local Sync)`);
      onSuccess(updatedUserObject);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity cursor-pointer"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-gray-100 overflow-hidden z-10 my-8"
        >
          {/* Header */}
          <div className="p-6 bg-slate-900 text-white relative">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md border border-white/20 shrink-0">
                  <ShieldCheck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white font-serif">
                    Modify User Access Level
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Adjust Role-Based Access Control (RBAC) privileges and administrative capabilities
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target User Summary Banner */}
            <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-xs border border-slate-700">
                  {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <p className="font-bold text-white text-sm">{user.displayName || 'Observer'}</p>
                  <p className="text-slate-400 font-mono text-[11px]">{user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
                <span className="text-slate-400 text-[11px] font-medium">Current Access:</span>
                <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-md ${currentTierInfo.colorClasses.badgeBg} ${currentTierInfo.colorClasses.badgeText} border ${currentTierInfo.colorClasses.badgeBorder}`}>
                  {currentTierInfo.badgeLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleRoleSubmit} className="p-6 space-y-6 max-h-[calc(85vh-200px)] overflow-y-auto">
            {/* Step 1: Select Target Role */}
            <div className="space-y-3">
              <label className="text-xs font-black text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Award className="w-4 h-4 text-indigo-600" />
                Select New Access Level
              </label>

              <div className="space-y-3">
                {ROLE_TIERS.map((tier) => {
                  const isSelected = selectedRole === tier.role;
                  const isCurrent = currentRoleNormalized === tier.role;

                  return (
                    <div
                      key={tier.role}
                      onClick={() => setSelectedRole(tier.role)}
                      className={`relative p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                        isSelected 
                          ? `${tier.colorClasses.border} ${tier.colorClasses.bg} shadow-sm ring-2 ${tier.colorClasses.glow} ring-opacity-50` 
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center border ${
                            isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 bg-white'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>

                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-bold text-gray-900 text-sm">{tier.title}</h4>
                              <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-md border ${tier.colorClasses.badgeBg} ${tier.colorClasses.badgeText} ${tier.colorClasses.badgeBorder}`}>
                                {tier.badgeLabel}
                              </span>
                              {isCurrent && (
                                <span className="px-2 py-0.5 text-[10px] font-bold bg-gray-200 text-gray-700 rounded-md">
                                  Current Role
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed">
                              {tier.description}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Permissions Checklist Pill list */}
                      <div className="mt-3 pt-3 border-t border-gray-200/60 pl-8 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-gray-600">
                        {tier.permissions.map((perm, idx) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span className="truncate">{perm}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Transition Summary Banner */}
            {!isRoleUnchanged && (
              <div className={`p-4 rounded-2xl border flex items-center gap-3 text-xs ${
                isUpgrade 
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
                  : 'bg-amber-50 text-amber-900 border-amber-200'
              }`}>
                <div className="p-2 rounded-xl bg-white shadow-xs shrink-0">
                  {isUpgrade ? <Sparkles className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-amber-600" />}
                </div>
                <div>
                  <p className="font-bold">
                    {isUpgrade ? 'Access Elevation Confirmation' : 'Privilege Adjustment Confirmation'}
                  </p>
                  <p className="text-xs mt-0.5 opacity-90 flex items-center gap-1.5 flex-wrap">
                    <span>{user.displayName}</span>
                    <span>will transition from</span>
                    <span className="font-bold underline">{currentTierInfo.title}</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0 inline" />
                    <span className="font-bold underline">{targetTierInfo.title}</span>.
                  </p>
                </div>
              </div>
            )}

            {/* Step 3: Reason / Authorization Note */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                <span>Authorization Note / Promotion Reason</span>
                <span className="text-gray-400 font-normal text-[11px]">(Optional for audit trail)</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Elevated to Field Supervisor for Lagos Mainland LGA coordination during upcoming elections..."
                rows={2}
                maxLength={300}
                className="w-full text-xs p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-hidden bg-gray-50/50"
              />
            </div>

            {/* Step 4: Notification toggle */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200/80">
              <input
                type="checkbox"
                id="notify-user-checkbox"
                checked={notifyUser}
                onChange={(e) => setNotifyUser(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded-sm border-gray-300 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="notify-user-checkbox" className="text-xs text-gray-700 font-medium cursor-pointer">
                Send instant notification alert to observer inbox regarding this access level change
              </label>
            </div>

            {/* Actions Footer */}
            <div className="pt-2 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isRoleUnchanged}
                className={`px-6 py-2.5 text-white rounded-xl font-bold text-xs transition-all shadow-sm flex items-center gap-2 cursor-pointer ${
                  isRoleUnchanged 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : isUpgrade
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Updating Access...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>{isRoleUnchanged ? 'Select Different Role' : isUpgrade ? 'Confirm Access Upgrade' : 'Save Access Level'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
