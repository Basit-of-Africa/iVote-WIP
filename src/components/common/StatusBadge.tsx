import React from 'react';

export type BadgeCategory = 
  | 'severity' 
  | 'incident_status' 
  | 'report_type' 
  | 'check_in' 
  | 'role' 
  | 'election_phase'
  | 'verification';

export interface StatusBadgeProps {
  category: BadgeCategory;
  value: string;
  size?: 'sm' | 'md';
  className?: string;
}

export default function StatusBadge({
  category,
  value,
  size = 'md',
  className = ''
}: StatusBadgeProps) {
  const norm = (value || '').toLowerCase().trim();

  let label = value;
  let classes = 'bg-gray-100 text-gray-700 border-gray-200';

  if (category === 'severity') {
    switch (norm) {
      case 'critical':
        label = 'Critical';
        classes = 'bg-red-50 text-red-700 border-red-200 ring-1 ring-red-500/10';
        break;
      case 'high':
        label = 'High';
        classes = 'bg-orange-50 text-orange-700 border-orange-200';
        break;
      case 'medium':
        label = 'Medium';
        classes = 'bg-amber-50 text-amber-700 border-amber-200';
        break;
      case 'low':
      default:
        label = 'Low';
        classes = 'bg-slate-50 text-slate-700 border-slate-200';
        break;
    }
  } else if (category === 'incident_status') {
    switch (norm) {
      case 'resolved':
        label = 'Resolved';
        classes = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        break;
      case 'investigating':
        label = 'Investigating';
        classes = 'bg-blue-50 text-blue-700 border-blue-200';
        break;
      case 'pending':
      default:
        label = 'Pending Review';
        classes = 'bg-amber-50 text-amber-700 border-amber-200';
        break;
    }
  } else if (category === 'report_type') {
    switch (norm) {
      case 'accreditation':
        label = 'Accreditation & BVAS';
        classes = 'bg-blue-50 text-blue-700 border-blue-200';
        break;
      case 'incident':
        label = 'Incident Report';
        classes = 'bg-red-50 text-red-700 border-red-200';
        break;
      case 'result':
        label = 'Election Results';
        classes = 'bg-purple-50 text-purple-700 border-purple-200';
        break;
      default:
        label = value || 'General Report';
        classes = 'bg-gray-50 text-gray-700 border-gray-200';
    }
  } else if (category === 'check_in') {
    switch (norm) {
      case 'checked_in':
        label = 'On-Site / Checked In';
        classes = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        break;
      case 'en_route':
        label = 'En Route';
        classes = 'bg-amber-50 text-amber-700 border-amber-200';
        break;
      case 'not_checked_in':
      default:
        label = 'Not Checked In';
        classes = 'bg-gray-100 text-gray-600 border-gray-200';
        break;
    }
  } else if (category === 'verification') {
    switch (norm) {
      case 'verified':
        label = 'Verified';
        classes = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        break;
      case 'rejected':
        label = 'Flagged / Rejected';
        classes = 'bg-red-50 text-red-700 border-red-200';
        break;
      case 'awaiting_review':
      case 'pending':
      default:
        label = 'Awaiting Review';
        classes = 'bg-amber-50 text-amber-700 border-amber-200';
        break;
    }
  } else if (category === 'election_phase') {
    switch (norm) {
      case 'voting':
        label = 'Voting Active';
        classes = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        break;
      case 'accreditation':
        label = 'Accreditation';
        classes = 'bg-blue-50 text-blue-700 border-blue-200';
        break;
      case 'collation':
        label = 'Collation';
        classes = 'bg-purple-50 text-purple-700 border-purple-200';
        break;
      case 'concluded':
        label = 'Concluded';
        classes = 'bg-gray-100 text-gray-700 border-gray-200';
        break;
      default:
        label = value || 'Scheduled';
        classes = 'bg-slate-50 text-slate-700 border-slate-200';
    }
  } else if (category === 'role') {
    switch (norm) {
      case 'admin':
        label = 'Administrator';
        classes = 'bg-purple-50 text-purple-700 border-purple-200';
        break;
      case 'supervisor':
      case 'field_supervisor':
        label = 'Supervisor';
        classes = 'bg-blue-50 text-blue-700 border-blue-200';
        break;
      case 'observer':
      default:
        label = 'Field Observer';
        classes = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        break;
    }
  }

  const sizeClasses = size === 'sm' 
    ? 'text-[10px] px-2 py-0.5' 
    : 'text-xs px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-md border tracking-tight ${sizeClasses} ${classes} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75 shrink-0" />
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );
}
