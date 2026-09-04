import React from 'react';
import { LucideIcon, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  badge?: {
    text: string;
    variant?: 'emerald' | 'amber' | 'red' | 'blue' | 'purple' | 'gray';
  };
  linkTo?: string;
  linkLabel?: string;
  colorScheme?: 'indigo' | 'emerald' | 'amber' | 'red' | 'purple' | 'blue';
}

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
  linkTo,
  linkLabel = 'View details',
  colorScheme = 'indigo'
}: StatCardProps) {
  const getSchemeStyles = () => {
    switch (colorScheme) {
      case 'emerald':
        return {
          iconBg: 'bg-emerald-50 text-emerald-700 border-emerald-100',
          accent: 'hover:border-emerald-200'
        };
      case 'amber':
        return {
          iconBg: 'bg-amber-50 text-amber-700 border-amber-100',
          accent: 'hover:border-amber-200'
        };
      case 'red':
        return {
          iconBg: 'bg-red-50 text-red-700 border-red-100',
          accent: 'hover:border-red-200'
        };
      case 'purple':
        return {
          iconBg: 'bg-purple-50 text-purple-700 border-purple-100',
          accent: 'hover:border-purple-200'
        };
      case 'blue':
        return {
          iconBg: 'bg-blue-50 text-blue-700 border-blue-100',
          accent: 'hover:border-blue-200'
        };
      default:
        return {
          iconBg: 'bg-slate-50 text-slate-700 border-slate-200',
          accent: 'hover:border-slate-300'
        };
    }
  };

  const getBadgeStyles = (variant?: string) => {
    switch (variant) {
      case 'emerald':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'amber':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'red':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'blue':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'purple':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const scheme = getSchemeStyles();

  return (
    <div
      className={`bg-white rounded-2xl border border-gray-200/90 p-5 sm:p-6 shadow-xs transition-all duration-200 flex flex-col justify-between ${scheme.accent}`}
    >
      <div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {title}
          </span>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${scheme.iconBg}`}>
            <Icon className="w-4 h-4" aria-hidden="true" />
          </div>
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <div className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight tabular-nums">
            {value}
          </div>
          {badge && (
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${getBadgeStyles(badge.variant)}`}>
              {badge.text}
            </span>
          )}
        </div>

        {subtitle && (
          <p className="text-xs text-gray-500 font-medium mt-1.5 leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {linkTo && (
        <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between">
          <Link
            to={linkTo}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 group transition-colors"
          >
            <span>{linkLabel}</span>
            <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
