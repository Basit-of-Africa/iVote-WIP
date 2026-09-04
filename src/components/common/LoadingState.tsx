import React from 'react';

export interface LoadingStateProps {
  message?: string;
  rows?: number;
  type?: 'table' | 'cards' | 'spinner';
}

export default function LoadingState({
  message = 'Loading election monitoring data...',
  rows = 4,
  type = 'cards'
}: LoadingStateProps) {
  if (type === 'spinner') {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium text-gray-500">{message}</p>
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-4 divide-y divide-gray-100">
        <div className="h-10 bg-gray-100 rounded-lg animate-pulse mb-3" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="py-3.5 flex items-center justify-between gap-4">
            <div className="w-1/3 h-4 bg-gray-100 rounded animate-pulse" />
            <div className="w-1/4 h-4 bg-gray-100 rounded animate-pulse" />
            <div className="w-1/6 h-4 bg-gray-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3"
        >
          <div className="flex justify-between items-center">
            <div className="w-24 h-3 bg-gray-200 rounded animate-pulse" />
            <div className="w-8 h-8 bg-gray-100 rounded-lg animate-pulse" />
          </div>
          <div className="w-16 h-7 bg-gray-200 rounded animate-pulse" />
          <div className="w-32 h-3 bg-gray-100 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}
