import React, { useState } from 'react';
import { AVAILABLE_ELECTIONS, ELECTION_LEVEL_LABELS } from '../constants/elections';
import { ElectionScope, ElectionLevel } from '../types';
import { Vote, ChevronDown, Check, Sparkles, Building2, Globe2, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ElectionScopeSelectorProps {
  currentScopeId?: string;
  onSelectScope?: (scope: ElectionScope) => void;
  compact?: boolean;
}

export default function ElectionScopeSelector({
  currentScopeId = 'osun-guber-offcycle',
  onSelectScope,
  compact = false
}: ElectionScopeSelectorProps) {
  const [selectedId, setSelectedId] = useState(currentScopeId);
  const [isOpen, setIsOpen] = useState(false);

  const activeScope = AVAILABLE_ELECTIONS.find(e => e.id === selectedId) || AVAILABLE_ELECTIONS[0];
  const levelMeta = ELECTION_LEVEL_LABELS[activeScope.level];

  const handleSelect = (scope: ElectionScope) => {
    setSelectedId(scope.id);
    if (onSelectScope) onSelectScope(scope);
    setIsOpen(false);
  };

  if (compact) {
    return (
      <div className="relative inline-block text-left">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-900/90 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all border border-emerald-500/30 shadow-sm cursor-pointer"
        >
          <Vote className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
          <span className="truncate max-w-[200px]">{activeScope.name}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-emerald-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              className="absolute right-0 mt-2 w-80 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700/80 p-2 z-[80] overflow-hidden"
            >
              <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between text-[10px] uppercase tracking-wider font-extrabold text-emerald-400">
                <span>Select Election Scope</span>
                <span>General & Off-Cycle</span>
              </div>
              <div className="py-1 space-y-1 max-h-72 overflow-y-auto custom-scrollbar">
                {AVAILABLE_ELECTIONS.map((scope) => {
                  const isSelected = scope.id === activeScope.id;
                  const meta = ELECTION_LEVEL_LABELS[scope.level];
                  return (
                    <button
                      key={scope.id}
                      onClick={() => handleSelect(scope)}
                      className={`w-full text-left p-2.5 rounded-xl text-xs transition-all flex items-start gap-2.5 ${
                        isSelected ? 'bg-emerald-600/30 border border-emerald-500/50 text-white' : 'hover:bg-slate-800/80 text-slate-300'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${scope.isOffCycle ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        <Vote className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="font-bold truncate text-white">{scope.name}</p>
                          {scope.isOffCycle && (
                            <span className="px-1.5 py-0.5 bg-red-500/20 text-red-300 text-[9px] font-black uppercase rounded">Off-Cycle</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{scope.description}</p>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-1" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white p-6 rounded-[32px] border border-emerald-500/30 shadow-xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-widest rounded-xl border border-emerald-500/30 inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Active Election Scope
            </span>
            {activeScope.isOffCycle && (
              <span className="px-3 py-1 bg-red-500/20 text-red-300 text-[10px] font-black uppercase tracking-widest rounded-xl border border-red-500/30">
                Off-Cycle Osun State
              </span>
            )}
          </div>
          <h3 className="text-xl sm:text-2xl font-bold font-serif text-white tracking-tight flex items-center gap-2.5">
            {activeScope.name}
          </h3>
          <p className="text-slate-300 text-xs max-w-2xl font-medium leading-relaxed">
            {activeScope.description}
          </p>
        </div>

        {/* Level Switcher Badges */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {AVAILABLE_ELECTIONS.map((scope) => {
            const isSelected = scope.id === activeScope.id;
            const meta = ELECTION_LEVEL_LABELS[scope.level];
            return (
              <button
                key={scope.id}
                onClick={() => handleSelect(scope)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/30 scale-105'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
                }`}
              >
                <Vote className="w-3.5 h-3.5" />
                <span>{meta?.short || scope.name}</span>
                {scope.isOffCycle && <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
