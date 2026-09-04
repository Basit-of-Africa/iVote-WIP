import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Download, 
  FileSpreadsheet, 
  ShieldAlert, 
  Users, 
  Layers, 
  CheckCircle2, 
  Filter, 
  Calendar, 
  Vote, 
  ArrowRight,
  Database,
  Sparkles,
  Info
} from 'lucide-react';
import { Report } from '../types';
import { 
  exportIncidentReportsCSV, 
  exportAccreditationReportsCSV, 
  exportMasterReportsCSV,
  filterReportsForExport,
  ObserverInfo,
  IncidentMeta
} from '../lib/reportExport';
import { toast } from 'sonner';

interface DownloadReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  allReports: Report[];
  filteredReports: Report[];
  currentFilterType: string;
  searchTerm?: string;
  observerMap?: Record<string, ObserverInfo>;
  incidentMap?: Record<string, IncidentMeta>;
}

export default function DownloadReportsModal({
  isOpen,
  onClose,
  allReports,
  filteredReports,
  currentFilterType,
  searchTerm = '',
  observerMap = {},
  incidentMap = {}
}: DownloadReportsModalProps) {
  const [dataScope, setDataScope] = useState<'all' | 'filtered'>('all');
  const [dateRange, setDateRange] = useState<'all' | 'today' | '24h' | '7d'>('all');
  const [electionLevel, setElectionLevel] = useState<string>('all');
  const [exportingType, setExportingType] = useState<string | null>(null);

  // Determine base dataset based on scope
  const baseReports = useMemo(() => {
    return dataScope === 'filtered' ? filteredReports : allReports;
  }, [dataScope, filteredReports, allReports]);

  // Apply modal filters (dateRange, electionLevel)
  const scopedReports = useMemo(() => {
    return filterReportsForExport(baseReports, {
      dateRange,
      electionLevel
    });
  }, [baseReports, dateRange, electionLevel]);

  // Count breakdowns
  const incidentCount = useMemo(() => {
    return scopedReports.filter(r => r.type === 'incident').length;
  }, [scopedReports]);

  const accreditationCount = useMemo(() => {
    return scopedReports.filter(r => r.type === 'accreditation').length;
  }, [scopedReports]);

  const resultCount = useMemo(() => {
    return scopedReports.filter(r => r.type === 'result').length;
  }, [scopedReports]);

  const totalCount = scopedReports.length;

  if (!isOpen) return null;

  const handleExport = (type: 'incident' | 'accreditation' | 'master') => {
    setExportingType(type);
    try {
      const options = {
        dateRange,
        electionLevel,
        observerMap,
        incidentMap
      };

      if (type === 'incident') {
        if (incidentCount === 0) {
          toast.error('No incident reports found matching selected filters');
          return;
        }
        const res = exportIncidentReportsCSV(baseReports, {
          ...options,
          customFilenamePrefix: dataScope === 'filtered' ? 'ivote_filtered_incidents' : 'ivote_incidents_dataset'
        });
        toast.success(`Exported ${res.count} Incident Reports to ${res.filename}`);
      } else if (type === 'accreditation') {
        if (accreditationCount === 0) {
          toast.error('No accreditation reports found matching selected filters');
          return;
        }
        const res = exportAccreditationReportsCSV(baseReports, {
          ...options,
          customFilenamePrefix: dataScope === 'filtered' ? 'ivote_filtered_accreditations' : 'ivote_accreditation_dataset'
        });
        toast.success(`Exported ${res.count} Accreditation Records to ${res.filename}`);
      } else if (type === 'master') {
        if (totalCount === 0) {
          toast.error('No reports found matching selected filters');
          return;
        }
        const res = exportMasterReportsCSV(baseReports, {
          ...options,
          customFilenamePrefix: dataScope === 'filtered' ? 'ivote_filtered_master_reports' : 'ivote_master_reports'
        });
        toast.success(`Exported ${res.count} Unified Reports to ${res.filename}`);
      }
    } catch (err: any) {
      console.error('Export failure:', err);
      toast.error('Failed to export dataset: ' + (err.message || 'Unknown error'));
    } finally {
      setExportingType(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-in fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="bg-white rounded-[32px] sm:rounded-[40px] shadow-2xl border border-gray-100 w-full max-w-4xl overflow-hidden my-auto max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-6 sm:p-8 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold font-serif">Download Reports</h2>
                <span className="text-[10px] uppercase font-bold tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                  CSV Export
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Export structured incident telemetry and voter accreditation metrics for analytical modeling and audits
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 text-slate-400 hover:text-white rounded-2xl hover:bg-slate-800 transition-colors"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1">
          {/* Controls & Filter Bar */}
          <div className="p-5 bg-gray-50 rounded-3xl border border-gray-200/80 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-700 uppercase tracking-wider">
                <Filter className="w-4 h-4 text-emerald-600" />
                <span>Export Scope & Filter Configuration</span>
              </div>
              <div className="text-xs text-gray-500 font-medium">
                Target pool: <strong className="text-gray-900 font-mono">{scopedReports.length}</strong> reports matching criteria
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Scope Selector */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Dataset Source Scope
                </label>
                <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-2xl border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setDataScope('all')}
                    className={`py-2 px-2 text-xs font-bold rounded-xl transition-all ${
                      dataScope === 'all'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    All Stored ({allReports.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDataScope('filtered')}
                    className={`py-2 px-2 text-xs font-bold rounded-xl transition-all ${
                      dataScope === 'filtered'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Current View ({filteredReports.length})
                  </button>
                </div>
              </div>

              {/* Date Range Selector */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Timeframe Filter
                </label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as any)}
                  className="w-full bg-white border border-gray-200 rounded-2xl py-2.5 px-3.5 text-xs font-bold text-gray-800 outline-none focus:border-emerald-500"
                >
                  <option value="all">All Timestamps</option>
                  <option value="today">Today Only</option>
                  <option value="24h">Past 24 Hours</option>
                  <option value="7d">Past 7 Days</option>
                </select>
              </div>

              {/* Election Contest Level */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  Election Level
                </label>
                <select
                  value={electionLevel}
                  onChange={(e) => setElectionLevel(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-2xl py-2.5 px-3.5 text-xs font-bold text-gray-800 outline-none focus:border-emerald-500"
                >
                  <option value="all">All Election Levels</option>
                  <option value="governorship">Governorship</option>
                  <option value="general_federal">General Federal</option>
                  <option value="presidential">Presidential</option>
                  <option value="senatorial">Senatorial</option>
                  <option value="house_of_reps">House of Reps</option>
                </select>
              </div>
            </div>

            {dataScope === 'filtered' && (searchTerm || currentFilterType !== 'all') && (
              <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50/80 px-3 py-2 rounded-xl border border-emerald-200">
                <Info className="w-4 h-4 shrink-0" />
                <span>
                  Using active dashboard filters: <strong>Type: {currentFilterType}</strong> {searchTerm ? `| Search: "${searchTerm}"` : ''}
                </span>
              </div>
            )}
          </div>

          {/* Three Primary Structured Export Cards */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" />
              <span>Structured Export Formats</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Incident Reports Dataset */}
              <div className="p-6 rounded-3xl border-2 border-red-200 bg-red-50/30 flex flex-col justify-between hover:border-red-300 transition-all">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center font-bold">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-bold text-red-800 bg-red-100/80 border border-red-200 px-3 py-1 rounded-full uppercase tracking-wider">
                      Incident Telemetry
                    </span>
                  </div>

                  <div>
                    <h4 className="text-base font-bold text-gray-900">Incident Reports CSV</h4>
                    <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                      Electoral violence, BVAS equipment failures, ballot tampering, vote buying, logistics delay, security deployment notices, and resolution status.
                    </p>
                  </div>

                  {/* Field Highlights */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {['Severity', 'Category', 'Security Alerted', 'Resolution', 'PU Coordinates', 'WAT Timestamps', 'Photos'].map((tag) => (
                      <span key={tag} className="text-[10px] font-semibold bg-white border border-red-200 text-red-800 px-2 py-0.5 rounded-lg">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-6 mt-4 border-t border-red-100 flex items-center justify-between gap-3">
                  <div className="text-xs font-mono font-bold text-red-900">
                    {incidentCount} Incident {incidentCount === 1 ? 'Record' : 'Records'}
                  </div>
                  <button
                    onClick={() => handleExport('incident')}
                    disabled={incidentCount === 0 || exportingType === 'incident'}
                    className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Incidents CSV</span>
                  </button>
                </div>
              </div>

              {/* Card 2: Accreditation & Turnout Dataset */}
              <div className="p-6 rounded-3xl border-2 border-emerald-200 bg-emerald-50/30 flex flex-col justify-between hover:border-emerald-300 transition-all">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                      <Users className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100/80 border border-emerald-200 px-3 py-1 rounded-full uppercase tracking-wider">
                      Turnout & BVAS
                    </span>
                  </div>

                  <div>
                    <h4 className="text-base font-bold text-gray-900">Accreditation & Turnout CSV</h4>
                    <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                      Biometric voter accreditation tallies, BVAS machine health (Functioning, Slow, Malfunctioning), queue size categorizations, and observer crowd notes.
                    </p>
                  </div>

                  {/* Field Highlights */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {['BVAS Count', 'Device Health', 'Queue Size', 'PU Coordinates', 'Observer Ref', 'WAT Timestamps'].map((tag) => (
                      <span key={tag} className="text-[10px] font-semibold bg-white border border-emerald-200 text-emerald-800 px-2 py-0.5 rounded-lg">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-6 mt-4 border-t border-emerald-100 flex items-center justify-between gap-3">
                  <div className="text-xs font-mono font-bold text-emerald-900">
                    {accreditationCount} Accreditation {accreditationCount === 1 ? 'Record' : 'Records'}
                  </div>
                  <button
                    onClick={() => handleExport('accreditation')}
                    disabled={accreditationCount === 0 || exportingType === 'accreditation'}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Accreditation CSV</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Card 3: Master Comprehensive Electoral Dataset (Full Width) */}
            <div className="p-6 rounded-3xl border-2 border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-300 transition-all">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 text-emerald-400 flex items-center justify-center font-bold shrink-0">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-gray-900">Master Electoral Reports Dataset (Unified CSV)</h4>
                    <span className="text-[10px] font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded-full uppercase">
                      All-in-One
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 max-w-2xl leading-relaxed">
                    Unified multi-dimensional dataset containing all field observations: Incident classifications, BVAS accreditation metrics, and Form EC8A vote tallies in a synchronized schema ready for Python pandas, R, Excel, or SQL ingestion.
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs font-mono text-gray-500">
                    <span>Incidents: <strong className="text-red-700">{incidentCount}</strong></span>
                    <span>•</span>
                    <span>Accreditations: <strong className="text-emerald-700">{accreditationCount}</strong></span>
                    <span>•</span>
                    <span>Results: <strong className="text-blue-700">{resultCount}</strong></span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex items-center justify-end">
                <button
                  onClick={() => handleExport('master')}
                  disabled={totalCount === 0 || exportingType === 'master'}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-2xl text-xs font-bold transition-all shadow-sm cursor-pointer border border-slate-800"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Download Master CSV ({totalCount})</span>
                </button>
              </div>
            </div>
          </div>

          {/* Specifications & Compliance Footnote */}
          <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/80 flex items-start gap-3 text-xs text-emerald-950">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Analysis-Ready Formatting Specifications:</p>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                • <strong>RFC 4180 Escaping:</strong> Double-quotes internal commas and line-breaks.<br />
                • <strong>UTF-8 BOM:</strong> Opens cleanly in Microsoft Excel without character encoding distortion.<br />
                • <strong>Dual Timestamps:</strong> Contains synchronized UTC ISO timestamps and Local Nigeria West Africa Time (WAT: UTC+1).<br />
                • <strong>Numeric Cleanliness:</strong> Unquoted voter totals for direct aggregation via SUM/PIVOT.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between shrink-0">
          <p className="text-xs text-gray-500">
            iVote Election Monitoring Telemetry • Export System
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
