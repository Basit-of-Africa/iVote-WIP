import React, { useState } from 'react';
import { Siren, ShieldAlert } from 'lucide-react';
import DangerAlertModal from './DangerAlertModal';

interface DangerButtonProps {
  variant?: 'header' | 'card' | 'compact';
  className?: string;
  label?: string;
}

export default function DangerButton({ variant = 'header', className = '', label }: DangerButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={`group relative inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-red-900/40 hover:shadow-red-900/60 transition-all duration-200 border border-red-400/50 active:scale-95 ${className}`}
        title="Press in case of immediate danger or security threat"
      >
        <span className="w-2 h-2 rounded-full bg-white animate-ping shrink-0" />
        <Siren className="w-4 h-4 text-white group-hover:rotate-12 transition-transform shrink-0" />
        <span className="font-black text-xs whitespace-nowrap">{label || 'SOS'}</span>
      </button>

      <DangerAlertModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}

