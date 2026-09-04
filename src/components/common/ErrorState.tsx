import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export default function ErrorState({
  title = 'Data loading error',
  message,
  onRetry
}: ErrorStateProps) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/50 p-6 text-center flex flex-col items-center justify-center">
      <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center mb-3">
        <AlertCircle className="w-5 h-5" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-bold text-red-900 mb-1">{title}</h3>
      <p className="text-xs text-red-700 max-w-md mb-4 leading-relaxed">
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white border border-red-200 text-red-800 hover:bg-red-50 text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Try again</span>
        </button>
      )}
    </div>
  );
}
