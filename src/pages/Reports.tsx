import { useEffect, useState, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, addDoc, serverTimestamp, getDocs, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Report } from '../types';
import { useAuth } from '../context/AuthContext';
import { cacheFetchedReports, getCachedReports } from '../lib/offlineStorage';
import { logAuditEvent } from '../lib/audit';
import AuditTrailModal from '../components/AuditTrailModal';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import { 
  FileText, 
  Calendar, 
  MapPin, 
  Search, 
  ChevronRight, 
  Edit2, 
  Download, 
  Table as TableIcon, 
  FileSpreadsheet, 
  Layers, 
  ChevronDown,
  Trash2,
  History,
  Sparkles,
  PlusCircle,
  ShieldCheck,
  Radio,
  CheckCircle2,
  ShieldAlert,
  Users,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  exportIncidentReportsCSV, 
  exportAccreditationReportsCSV, 
  exportMasterReportsCSV,
  ObserverInfo,
  IncidentMeta
} from '../lib/reportExport';
import DownloadReportsModal from '../components/DownloadReportsModal';

export default function Reports() {
  const { user, isAdmin, isSupervisor } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  // Audit Trail & Deletion Modal states
  const [isAuditTrailOpen, setIsAuditTrailOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<Report | null>(null);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isCreatingTest, setIsCreatingTest] = useState(false);

  // Download Reports Modal & Analytical Metadata states
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [observerMap, setObserverMap] = useState<Record<string, ObserverInfo>>({});
  const [incidentMap, setIncidentMap] = useState<Record<string, IncidentMeta>>({});

  // Real-time synchronization for observer details and incident status mappings
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const map: Record<string, ObserverInfo> = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        map[d.id] = { displayName: data.displayName, email: data.email, phone: data.phone };
      });
      setObserverMap(map);
    }, (err) => console.warn('Users listener notice:', err));

    const unsubIncidents = onSnapshot(collection(db, 'incidents'), (snap) => {
      const map: Record<string, IncidentMeta> = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.reportId) {
          map[data.reportId] = { id: d.id, status: data.status };
        }
      });
      setIncidentMap(map);
    }, (err) => console.warn('Incidents listener notice:', err));

    return () => {
      unsubUsers();
      unsubIncidents();
    };
  }, []);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Quick 1-click structured export handlers
  const handleExportIncidents = () => {
    try {
      const target = filteredReports.filter(r => r.type === 'incident');
      if (target.length === 0) {
        toast.error('No incident reports found matching current criteria');
        setShowExportMenu(false);
        return;
      }
      const res = exportIncidentReportsCSV(filteredReports, {
        observerMap,
        incidentMap,
        customFilenamePrefix: 'ivote_incident_reports'
      });
      setShowExportMenu(false);
      toast.success(`Exported ${res.count} Incident Reports to ${res.filename}`);
    } catch (err: any) {
      toast.error('Failed to export incident reports: ' + err.message);
    }
  };

  const handleExportAccreditation = () => {
    try {
      const target = filteredReports.filter(r => r.type === 'accreditation');
      if (target.length === 0) {
        toast.error('No accreditation reports found matching current criteria');
        setShowExportMenu(false);
        return;
      }
      const res = exportAccreditationReportsCSV(filteredReports, {
        observerMap,
        incidentMap,
        customFilenamePrefix: 'ivote_accreditation_reports'
      });
      setShowExportMenu(false);
      toast.success(`Exported ${res.count} Accreditation Records to ${res.filename}`);
    } catch (err: any) {
      toast.error('Failed to export accreditation reports: ' + err.message);
    }
  };

  const handleExportMaster = (exportAll = false) => {
    try {
      const target = exportAll ? reports : filteredReports;
      if (target.length === 0) {
        toast.error('No reports available to export with current filters');
        setShowExportMenu(false);
        return;
      }
      const res = exportMasterReportsCSV(target, {
        observerMap,
        incidentMap,
        customFilenamePrefix: exportAll ? 'ivote_all_master_reports' : 'ivote_filtered_master_reports'
      });
      setShowExportMenu(false);
      toast.success(`Exported ${res.count} Reports to ${res.filename}`);
    } catch (err: any) {
      toast.error('Failed to export master reports: ' + err.message);
    }
  };

  const exportToCSV = (exportAll = false) => {
    handleExportMaster(exportAll);
  };

  const exportToPDF = () => {
    if (filteredReports.length === 0) {
      toast.error('No reports to export in current filter.');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });
    
    doc.setFontSize(16);
    doc.setTextColor(4, 120, 87);
    doc.text('iVote Nigeria - Field Observation Reports Summary', 14, 15);
    
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${format(new Date(), 'MMMM d, yyyy HH:mm:ss')} | Filter: ${filterType.toUpperCase()} | Total: ${filteredReports.length}`, 14, 22);

    const tableData = filteredReports.map(r => {
      const payload = r.payload || {};
      const timeStr = (r.timestamp as any)?.toDate 
        ? format((r.timestamp as any).toDate(), 'MMM d, HH:mm') 
        : 'N/A';

      let details = payload.description || '';
      if (r.type === 'result') {
        const votes = [];
        if (payload.apcVotes) votes.push(`APC: ${payload.apcVotes}`);
        if (payload.pdpVotes) votes.push(`PDP: ${payload.pdpVotes}`);
        if (payload.lpVotes) votes.push(`LP: ${payload.lpVotes}`);
        if (payload.nnppVotes) votes.push(`NNPP: ${payload.nnppVotes}`);
        if (votes.length > 0) details = `${votes.join(', ')} | ${details}`;
      }

      return [
        r.id.substring(0, 8),
        r.pollingUnitId,
        r.type.toUpperCase(),
        timeStr,
        r.observerId ? `OBS-${r.observerId.substring(0, 6)}` : 'N/A',
        details.length > 60 ? details.substring(0, 57) + '...' : details
      ];
    });

    autoTable(doc, {
      head: [['ID', 'Polling Unit', 'Type', 'Timestamp', 'Observer', 'Details / Vote Tally']],
      body: tableData,
      startY: 28,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [4, 120, 87], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    doc.save(`ivote_field_reports_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
    setShowExportMenu(false);
    toast.success('Field Reports summary PDF generated');
  };

  useEffect(() => {
    const cached = getCachedReports();
    if (cached.length > 0) {
      setReports(cached);
      setLoading(false);
    }

    const q = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
      setReports(docs);
      cacheFetchedReports(docs);
      setLoading(false);
    }, (error) => {
      console.warn('Firestore reports snapshot failed or offline, using cached reports:', error);
      const cachedData = getCachedReports();
      if (cachedData.length > 0) {
        setReports(cachedData);
        setLoading(false);
      } else {
        handleFirestoreError(error, OperationType.LIST, 'reports');
      }
    });

    return () => unsubscribe();
  }, []);

  // Admin deletion with Audit Trail logging
  const handleConfirmDeleteReport = async (reason: string) => {
    if (!isAdmin) {
      toast.error('Unauthorized: Only administrators can delete reports.');
      return;
    }
    if (!reportToDelete) return;

    const reportId = reportToDelete.id;
    const puId = reportToDelete.pollingUnitId;
    const summary = reportToDelete.payload?.description || `${reportToDelete.type.toUpperCase()} report for PU #${puId}`;

    try {
      // 1. Log immutable audit trail entry first
      await logAuditEvent({
        action: 'DELETE_REPORT',
        targetId: reportId,
        targetType: 'report',
        pollingUnitId: puId,
        summary,
        reason,
        snapshot: reportToDelete
      });

      // 2. Delete report document
      await deleteDoc(doc(db, 'reports', reportId));

      // 3. If there is a corresponding incident record linked by reportId, delete and audit it as well
      try {
        const incQuery = query(collection(db, 'incidents'), where('reportId', '==', reportId));
        const incSnapshot = await getDocs(incQuery);
        for (const incDoc of incSnapshot.docs) {
          await logAuditEvent({
            action: 'DELETE_INCIDENT',
            targetId: incDoc.id,
            targetType: 'incident',
            pollingUnitId: puId,
            summary: `Cascaded deletion from Report #${reportId}`,
            reason: `Cascade delete: ${reason}`,
            snapshot: incDoc.data()
          });
          await deleteDoc(doc(db, 'incidents', incDoc.id));
        }
      } catch (incErr) {
        console.warn('Incident cascade check warning:', incErr);
      }

      toast.success(`Report #${reportId.substring(0, 8)} deleted and logged to System Audit Trail.`);
      setReportToDelete(null);
    } catch (err: any) {
      console.error('Failed to delete report:', err);
      toast.error('Failed to delete report: ' + (err.message || 'Permission denied'));
    }
  };

  // Quick Test Report Generator for User Testing & Public Feed Verification
  const handleCreateTestReport = async (type: 'accreditation' | 'incident' | 'result') => {
    setIsCreatingTest(true);
    try {
      const puNumbers = ['001', '002', '003', '004', '008', '012'];
      const randomPU = `OS/EJ/04/${puNumbers[Math.floor(Math.random() * puNumbers.length)]}`;
      const now = new Date();

      let payload: any = {
        electionLevel: 'governorship',
        state: 'Osun',
        lga: 'Ejigbo',
        ward: 'Ward 04'
      };

      if (type === 'accreditation') {
        payload = {
          ...payload,
          description: `TEST ACCREDITATION: BVAS verification functioning smoothly at PU ${randomPU}. Voter queue moving steadily with calm observer atmosphere.`,
          voterCount: 350 + Math.floor(Math.random() * 200),
          accreditation: 'Smooth',
          turnout: 'High'
        };
      } else if (type === 'incident') {
        const severities: ('low' | 'medium' | 'high' | 'critical')[] = ['medium', 'high', 'critical'];
        const severity = severities[Math.floor(Math.random() * severities.length)];
        payload = {
          ...payload,
          severity,
          description: `TEST INCIDENT (${severity.toUpperCase()}): Simulated queue disruption and biometric verification delay flagged for testing public feed stream at ${randomPU}.`,
        };
      } else {
        const apc = 140 + Math.floor(Math.random() * 80);
        const pdp = 135 + Math.floor(Math.random() * 80);
        const lp = 45 + Math.floor(Math.random() * 30);
        const nnpp = 12 + Math.floor(Math.random() * 10);
        payload = {
          ...payload,
          apcVotes: apc,
          pdpVotes: pdp,
          lpVotes: lp,
          nnppVotes: nnpp,
          otherVotes: 5,
          voterCount: apc + pdp + lp + nnpp + 5,
          description: `TEST RESULT: Official ballot count verified and transmitted from Polling Station ${randomPU}.`
        };
      }

      const reportData = {
        pollingUnitId: randomPU,
        observerId: user?.uid || 'test_observer',
        timestamp: serverTimestamp(),
        type,
        location: {
          lat: 7.9024 + (Math.random() - 0.5) * 0.05,
          lng: 4.3167 + (Math.random() - 0.5) * 0.05
        },
        payload
      };

      const docRef = await addDoc(collection(db, 'reports'), reportData);

      // If it's an incident, also push to incidents collection
      if (type === 'incident') {
        await addDoc(collection(db, 'incidents'), {
          reportId: docRef.id,
          pollingUnitId: randomPU,
          severity: payload.severity || 'medium',
          status: 'pending',
          description: payload.description,
          timestamp: serverTimestamp()
        });
      }

      setIsTestModalOpen(false);
      toast.success(`Test ${type.toUpperCase()} Report created! It is now live on the Public Feed.`, {
        duration: 5000,
        action: {
          label: 'View Public Feed',
          onClick: () => window.location.href = '/'
        }
      });
    } catch (err: any) {
      console.error('Error creating test report:', err);
      toast.error('Failed to create test report: ' + (err.message || 'Error'));
    } finally {
      setIsCreatingTest(false);
    }
  };

  const filteredReports = reports.filter(report => {
    const matchesSearch = report.pollingUnitId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (report.payload?.description && report.payload.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (report.observerId && report.observerId.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = filterType === 'all' || report.type === filterType;
    return matchesSearch && matchesFilter;
  });

  if (!isAdmin && !isSupervisor) {
    return (
      <div className="max-w-md mx-auto p-12 bg-white rounded-3xl border border-gray-100 shadow-sm text-center my-16">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Access Restricted</h2>
        <p className="text-gray-500 text-sm">Administrative credentials are required to view and export the primary field reports dataset.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      {/* Top Banner Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold text-gray-900 font-serif tracking-tight">Field Reports</h1>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-full border border-emerald-200">
              {reports.length} Total Logs
            </span>
          </div>
          <p className="text-gray-500 font-medium">Live monitoring data stream & verified telemetry across polling stations</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Audit Trail Button */}
          <button
            onClick={() => setIsAuditTrailOpen(true)}
            className="flex items-center gap-2 px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl shadow-sm text-sm font-bold transition-all cursor-pointer border border-slate-700"
            title="Open System Audit Trail to review immutable logs of all deletions and admin mutations"
          >
            <History className="w-4 h-4 text-emerald-400" />
            <span>Audit Trail</span>
          </button>

          {/* Quick Test Generator Button */}
          {isAdmin && (
            <button
              onClick={() => setIsTestModalOpen(true)}
              className="flex items-center gap-2 px-4 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-2xl shadow-xs text-sm font-bold transition-all cursor-pointer"
              title="Generate a test report or incident to test public live feed & deletion flow"
            >
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Test Report Generator</span>
            </button>
          )}

          {/* Search Input */}
          <div className="relative">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search PU ID, notes, observer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-6 py-3 bg-white border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm w-full sm:w-64"
            />
          </div>
          
          {/* Filter Type Dropdown */}
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm outline-none font-bold text-gray-700"
          >
            <option value="all">All Report Types ({reports.length})</option>
            <option value="accreditation">Accreditations</option>
            <option value="incident">Incidents & Irregularities</option>
            <option value="result">Official PU Results</option>
          </select>

          {/* Primary 'Download Reports' Action Button */}
          <button
            onClick={() => setIsDownloadModalOpen(true)}
            className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-sm text-sm font-bold transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 min-h-[44px]"
            title="Open Download Reports Center to export structured Incident and Accreditation CSV datasets"
          >
            <Download className="w-4 h-4" />
            <span>Download Reports</span>
            <span className="ml-0.5 px-2 py-0.5 bg-emerald-700/90 rounded-full text-xs font-mono font-bold">
              {filteredReports.length}
            </span>
          </button>

          {/* More Export Options Dropdown Menu */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1.5 px-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all min-h-[44px] cursor-pointer"
              title="Quick structured export options"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Quick CSV</span>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>
            
            <AnimatePresence>
              {showExportMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-50 overflow-hidden"
                >
                  <div className="px-4 py-2 border-b border-gray-50 text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Structured CSV Exports</span>
                    <span className="text-[10px] font-mono text-emerald-600 font-bold">RFC 4180</span>
                  </div>
                  
                  {/* Export Incidents Only */}
                  <button
                    onClick={handleExportIncidents}
                    className="w-full px-4 py-2.5 text-left hover:bg-red-50 text-xs font-semibold text-gray-700 flex items-center justify-between gap-3 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center font-bold">
                        <ShieldAlert className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-900">Incident Reports CSV</div>
                        <div className="text-[10px] text-gray-500">Severity, Categories & Coordinates</div>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-red-700 bg-red-100/80 px-2 py-0.5 rounded-full">
                      {filteredReports.filter(r => r.type === 'incident').length}
                    </span>
                  </button>

                  {/* Export Accreditation Only */}
                  <button
                    onClick={handleExportAccreditation}
                    className="w-full px-4 py-2.5 text-left hover:bg-emerald-50 text-xs font-semibold text-gray-700 flex items-center justify-between gap-3 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-900">Accreditation Data CSV</div>
                        <div className="text-[10px] text-gray-500">BVAS Health, Turnout & Queues</div>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                      {filteredReports.filter(r => r.type === 'accreditation').length}
                    </span>
                  </button>

                  {/* Export Master Dataset */}
                  <button
                    onClick={() => handleExportMaster(false)}
                    className="w-full px-4 py-2.5 text-left hover:bg-blue-50 text-xs font-semibold text-gray-700 flex items-center justify-between gap-3 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-900">Master Dataset CSV</div>
                        <div className="text-[10px] text-gray-500">Unified Incidents, BVAS & Results</div>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full">
                      {filteredReports.length}
                    </span>
                  </button>

                  <div className="my-1 border-t border-gray-100" />

                  {/* Open Download Reports Center Modal */}
                  <button
                    onClick={() => {
                      setShowExportMenu(false);
                      setIsDownloadModalOpen(true);
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-emerald-50/80 text-xs font-bold text-emerald-800 flex items-center justify-between gap-2.5 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Download className="w-4 h-4 text-emerald-600" />
                      <span>Configure Advanced Export...</span>
                    </div>
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">
                      MODAL
                    </span>
                  </button>

                  <button
                    onClick={exportToPDF}
                    className="w-full px-4 py-2.5 text-left hover:bg-gray-50 text-xs font-semibold text-gray-600 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-amber-600" />
                    <span>Download PDF Summary</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Reports Table Card */}
      <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Report Info</th>
                <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Polling Unit</th>
                <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Time</th>
                <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Status / Type</th>
                <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-gray-400 italic">Syncing live field reports...</td>
                </tr>
              ) : filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-gray-400 italic">
                    No reports found matching your search or filter criteria
                  </td>
                </tr>
              ) : (
                filteredReports.map((report) => (
                  <motion.tr 
                    key={report.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-gray-50/80 transition-colors group"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          report.type === 'incident' ? 'bg-red-50 text-red-500' :
                          report.type === 'result' ? 'bg-emerald-50 text-emerald-500' :
                          'bg-blue-50 text-blue-500'
                        }`}>
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 capitalize">{report.type}</p>
                          <p className="text-[10px] font-mono text-gray-400 uppercase tracking-tight">{report.id.substring(0, 8)}...</p>
                          {report.payload?.description && (
                            <p className="text-xs text-gray-500 line-clamp-1 max-w-xs mt-0.5">
                              {report.payload.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 font-bold text-gray-700">
                        <MapPin className="w-4 h-4 text-gray-300" />
                        {report.pollingUnitId}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar className="w-4 h-4 text-gray-300" />
                        {(report.timestamp as any)?.toDate ? format((report.timestamp as any).toDate(), 'MMM d, HH:mm') : 'N/A'}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter ${
                        report.type === 'incident' ? 'bg-red-100 text-red-700' :
                        report.type === 'result' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {report.type}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isAdmin && (
                          <Link 
                            to={`/reports/${report.id}/edit`}
                            className="p-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-xs"
                            title="Edit Report"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Link>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => setReportToDelete(report)}
                            className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-xs cursor-pointer"
                            title="Delete Report (Admin Only - Logged to Audit Trail)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <Link 
                          to="/incidents"
                          className="p-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-900 hover:text-white transition-all shadow-xs"
                          title="View Incidents Stream"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Test Report Generator Modal */}
      {isTestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-md overflow-hidden"
          >
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-serif">Generate Test Report</h3>
                  <p className="text-xs text-slate-400">Instantly test the Public Live Feed & Deletion Flow</p>
                </div>
              </div>
              <button
                onClick={() => setIsTestModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-500 leading-relaxed">
                Click any template below to publish a realistic test report to Firestore. It will instantly stream to the <strong>Public Live Feed</strong> on the home page. You can then test deleting it as an Admin with the audit trail.
              </p>

              <div className="space-y-2.5">
                <button
                  onClick={() => handleCreateTestReport('accreditation')}
                  disabled={isCreatingTest}
                  className="w-full p-4 rounded-2xl border border-blue-100 bg-blue-50/50 hover:bg-blue-50 text-left transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-black uppercase text-blue-700 tracking-wider">Template 1</span>
                    <h4 className="text-sm font-bold text-gray-900">Accreditation & Voter Turnout Test</h4>
                    <p className="text-xs text-gray-500">BVAS calibration and queue verification log</p>
                  </div>
                  <PlusCircle className="w-5 h-5 text-blue-600 group-hover:scale-110 transition-transform" />
                </button>

                <button
                  onClick={() => handleCreateTestReport('incident')}
                  disabled={isCreatingTest}
                  className="w-full p-4 rounded-2xl border border-red-100 bg-red-50/50 hover:bg-red-50 text-left transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-black uppercase text-red-700 tracking-wider">Template 2</span>
                    <h4 className="text-sm font-bold text-gray-900">Critical Field Incident Test</h4>
                    <p className="text-xs text-gray-500">Flagged irregularity with real-time alert trigger</p>
                  </div>
                  <PlusCircle className="w-5 h-5 text-red-600 group-hover:scale-110 transition-transform" />
                </button>

                <button
                  onClick={() => handleCreateTestReport('result')}
                  disabled={isCreatingTest}
                  className="w-full p-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 hover:bg-emerald-50 text-left transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-black uppercase text-emerald-700 tracking-wider">Template 3</span>
                    <h4 className="text-sm font-bold text-gray-900">Official PU Ballot Result Test</h4>
                    <p className="text-xs text-gray-500">Complete party vote tally transmission</p>
                  </div>
                  <PlusCircle className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition-transform" />
                </button>
              </div>

              {isCreatingTest && (
                <div className="p-3 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  <span>Publishing test report to live database...</span>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal for Reports */}
      <DeleteConfirmationModal
        isOpen={!!reportToDelete}
        onClose={() => setReportToDelete(null)}
        onConfirm={handleConfirmDeleteReport}
        title="Delete Field Report"
        itemDescription={reportToDelete?.payload?.description || `Report ${reportToDelete?.id} of type ${reportToDelete?.type}`}
        itemType="report"
        pollingUnitId={reportToDelete?.pollingUnitId}
      />

      {/* Immutable System Audit Trail Modal */}
      <AuditTrailModal
        isOpen={isAuditTrailOpen}
        onClose={() => setIsAuditTrailOpen(false)}
      />

      {/* Download Reports & Structured Data Export Modal */}
      <DownloadReportsModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
        allReports={reports}
        filteredReports={filteredReports}
        currentFilterType={filterType}
        searchTerm={searchTerm}
        observerMap={observerMap}
        incidentMap={incidentMap}
      />
    </div>
  );
}
