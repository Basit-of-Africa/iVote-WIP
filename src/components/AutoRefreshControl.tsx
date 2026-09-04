import React from 'react';
import { RefreshCw, Play, Pause, Clock, CheckCircle2, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

interface AutoRefreshControlProps {
  secondsRemaining: number;
  totalInterval?: number;
  isAutoRefreshEnabled: boolean;
  onToggleAutoRefresh: () => void;
  onManualRefresh: () => void;
  isRefreshing: boolean;
  lastRefreshedAt: Date;
  compact?: boolean;
  className?: string;
}

export default function AutoRefreshControl({
  secondsRemaining,
  totalInterval = 60,
  isAutoRefreshEnabled,
  onToggleAutoRefresh,
  onManualRefresh,
  isRefreshing,
  lastRefreshedAt,
  compact = false,
  className = ''
}: AutoRefreshControlProps) {
  // SVG circular timer calculations
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const progressFraction = Math.max(0, Math.min(1, (totalInterval - secondsRemaining) / totalInterval));
  const strokeDashoffset = circumference - progressFraction * circumference;

  if (compact) {
    return (
      <div className={`flex items-center gap-2 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-gray-200/80 shadow-xs text-xs ${className}`}>
        <div className="relative flex items-center justify-center w-5 h-5">
          <svg className="w-5 h-5 -rotate-90" viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r={radius}
              className="stroke-gray-100"
              strokeWidth="2.5"
              fill="transparent"
            />
            {isAutoRefreshEnabled && (
              <circle
                cx="12"
                cy="12"
                r={radius}
                className="stroke-emerald-500 transition-all duration-1000 ease-linear"
                strokeWidth="2.5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            )}
          </svg>
          <span className="absolute text-[8px] font-extrabold font-mono text-gray-700">
            {isAutoRefreshEnabled ? secondsRemaining : '||'}
          </span>
        </div>

        <span className="text-[11px] font-bold text-gray-700">
          {isAutoRefreshEnabled ? `${secondsRemaining}s` : 'Paused'}
        </span>

        <button
          onClick={onManualRefresh}
          disabled={isRefreshing}
          title="Refresh statistics now"
          className="p-1 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
        </button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 sm:gap-3 bg-white p-1.5 rounded-2xl border border-gray-200/80 shadow-xs flex-wrap ${className}`}>
      {/* Live Pulse Status & Countdown */}
      <div className="flex items-center gap-2.5 px-3.5 py-2 bg-emerald-50/80 border border-emerald-100 rounded-xl text-xs font-bold text-emerald-900">
        {/* Circular Progress Ring */}
        <div className="relative flex items-center justify-center w-5 h-5 shrink-0">
          <svg className="w-5 h-5 -rotate-90" viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r={radius}
              className="stroke-emerald-200"
              strokeWidth="2.5"
              fill="transparent"
            />
            {isAutoRefreshEnabled && (
              <circle
                cx="12"
                cy="12"
                r={radius}
                className="stroke-emerald-600 transition-all duration-1000 ease-linear"
                strokeWidth="2.5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            )}
          </svg>
          <span className="absolute text-[8px] font-extrabold font-mono text-emerald-800">
            {isAutoRefreshEnabled ? secondsRemaining : '||'}
          </span>
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 leading-none">
            <div className={`w-1.5 h-1.5 rounded-full ${isAutoRefreshEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
            <span className="text-[11px] font-extrabold text-emerald-950">
              {isAutoRefreshEnabled ? `Auto-Refresh (${secondsRemaining}s)` : 'Auto-Refresh Paused'}
            </span>
          </div>
          <span className="text-[9px] font-mono text-emerald-700/80 mt-0.5">
            Updated {format(lastRefreshedAt, 'HH:mm:ss')}
          </span>
        </div>
      </div>

      {/* Action Controls: Pause/Play & Manual Trigger */}
      <div className="flex items-center gap-1">
        {/* Toggle Auto-refresh */}
        <button
          onClick={onToggleAutoRefresh}
          className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border ${
            isAutoRefreshEnabled
              ? 'text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 border-gray-200/60'
              : 'text-emerald-700 bg-emerald-100/70 border-emerald-200 hover:bg-emerald-200'
          }`}
          title={isAutoRefreshEnabled ? 'Pause 60s auto-refresh' : 'Resume 60s auto-refresh'}
        >
          {isAutoRefreshEnabled ? (
            <Pause className="w-3.5 h-3.5" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
        </button>

        {/* Manual Refresh Now */}
        <button
          onClick={onManualRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 hover:bg-gray-800 active:bg-black text-white text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50 shadow-xs"
          title="Manually refresh statistics immediately"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline font-mono">
            {isRefreshing ? 'Syncing...' : 'Refresh'}
          </span>
        </button>
      </div>
    </div>
  );
}
