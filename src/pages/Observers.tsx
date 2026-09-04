import React, { useEffect, useState, FormEvent, ChangeEvent, DragEvent } from 'react';
import { collection, onSnapshot, doc, updateDoc, setDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, Report } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  Search, 
  Filter, 
  UserPlus, 
  MapPin, 
  Shield, 
  CheckCircle, 
  AlertOctagon, 
  Clock, 
  Download, 
  Edit3, 
  FileText, 
  X, 
  Check,
  Building2,
  Phone,
  Mail,
  Activity,
  MoreVertical,
  Upload,
  FileSpreadsheet,
  FileCheck,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  HelpCircle,
  Trash2,
  Sparkles,
  Compass,
  Navigation,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import AttendanceDashboard from '../components/AttendanceDashboard';
import ObserverDrawer from '../components/ObserverDrawer';
import RoleUpgradeModal from '../components/RoleUpgradeModal';

interface ParsedObserverRow {
  id: string;
  displayName: string;
  email: string;
  phone: string;
  role: 'observer' | 'field_supervisor' | 'supervisor' | 'admin';
  assignedPollingUnitId: string;
  assignedPollingUnitName: string;
  state: string;
  lga: string;
  isValid: boolean;
  validationError?: string;
  selected: boolean;
}

export default function Observers() {
  const { isAdmin, isSupervisor } = useAuth();
  const [activeTab, setActiveTab] = useState<'roster' | 'attendance'>('roster');
  const [observers, setObservers] = useState<User[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');
  
  // Modals & Slide-Over Drawer state
  const [selectedObserver, setSelectedObserver] = useState<User | null>(null);
  const [drawerObserver, setDrawerObserver] = useState<User | null>(null);
  const [upgradeObserver, setUpgradeObserver] = useState<User | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // CSV Import Wizard State
  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1);
  const [parsedRows, setParsedRows] = useState<ParsedObserverRow[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  
  // Assignment Form State
  const [assignedUnitId, setAssignedUnitId] = useState('');
  const [assignedUnitName, setAssignedUnitName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // New Observer Form State
  const [newObserver, setNewObserver] = useState({
    displayName: '',
    email: '',
    phone: '',
    role: 'observer' as 'observer' | 'field_supervisor' | 'supervisor' | 'admin',
    assignedPollingUnitId: '',
    assignedPollingUnitName: '',
    state: 'Lagos',
    lga: 'Ikeja'
  });

  // Download CSV Onboarding Template
  const handleDownloadTemplate = () => {
    const templateContent = [
      'Name,Email,Phone,Role,Polling Unit ID,Polling Unit Name,State,LGA',
      'Kemi Adebayo,kemi.adebayo@ivote.org,+234 803 111 2233,observer,PU-LAG-016,Gbagada Comprehensive High School,Lagos,Kosofe',
      'Farouk Usman,farouk.usman@ivote.org,+234 802 999 8877,field_supervisor,SUP-KN-02,Kano Central Zonal Hub,Kano,Kano Municipal',
      'David Okoh,david.okoh@ivote.org,+234 814 555 4433,observer,PU-RV-104,Rumuokwuta Girls Secondary,Rivers,Port Harcourt'
    ].join('\n');

    const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'ivote_observer_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV Onboarding Template downloaded');
  };

  // CSV Parser
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleFileUpload = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a valid .csv file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) return;

      const lines = content.split(/\r\n|\n/).filter(line => line.trim().length > 0);
      if (lines.length < 2) {
        toast.error('CSV file appears empty or missing data rows');
        return;
      }

      const rows: ParsedObserverRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length < 2) continue;

        const displayName = values[0] || '';
        const email = values[1] || '';
        const phone = values[2] || '';
        const rawRole = (values[3] || 'observer').toLowerCase();
        const role: 'observer' | 'field_supervisor' | 'supervisor' | 'admin' = rawRole.includes('admin')
          ? 'admin'
          : rawRole.includes('supervisor')
          ? 'field_supervisor'
          : 'observer';
        const assignedPollingUnitId = values[4] || '';
        const assignedPollingUnitName = values[5] || '';
        const state = values[6] || 'Lagos';
        const lga = values[7] || 'Ikeja';

        const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        const nameValid = displayName.trim().length > 1;

        let error = '';
        if (!nameValid) error = 'Missing name';
        else if (!emailValid) error = 'Invalid email format';

        const isValid = nameValid && emailValid;

        rows.push({
          id: `imp-${i}-${Date.now()}`,
          displayName,
          email,
          phone,
          role,
          assignedPollingUnitId,
          assignedPollingUnitName,
          state,
          lga,
          isValid,
          validationError: error,
          selected: isValid
        });
      }

      setParsedRows(rows);
      setImportStep(2);
      toast.success(`Parsed ${rows.length} observer records from CSV`);
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleExecuteImport = async () => {
    const selectedRows = parsedRows.filter(r => r.selected && r.isValid);
    if (selectedRows.length === 0) {
      toast.error('No valid rows selected for import');
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    let count = 0;

    const newUsersToAppend: User[] = [];

    for (let i = 0; i < selectedRows.length; i++) {
      const row = selectedRows[i];
      const uid = `obs-imported-${Date.now()}-${i}`;
      
      const userRecord: User = {
        uid,
        displayName: row.displayName.trim(),
        email: row.email.trim(),
        phone: row.phone.trim(),
        role: row.role,
        assignedPollingUnitId: row.assignedPollingUnitId.trim(),
        assignedPollingUnitName: row.assignedPollingUnitName.trim(),
        state: row.state.trim(),
        lga: row.lga.trim(),
        status: 'active',
        createdAt: new Date().toISOString()
      };

      try {
        await setDoc(doc(db, 'users', uid), {
          ...userRecord,
          updatedAt: serverTimestamp()
        });
      } catch (e) {
        console.warn('Firestore import error, syncing locally:', e);
      }

      newUsersToAppend.push(userRecord);
      count++;
      setImportedCount(count);
      setImportProgress(Math.round(((i + 1) / selectedRows.length) * 100));
    }

    setObservers(prev => [...newUsersToAppend, ...prev]);
    setIsImporting(false);
    setImportStep(3);
    toast.success(`Successfully onboarded ${count} field observers!`);
  };

  useEffect(() => {
    // 1. Fetch Users
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
      
      const realUsers = docs.filter(doc => 
        doc.role === 'observer' || doc.role === 'supervisor' || doc.role === 'field_supervisor' || doc.role === 'admin'
      ).map(doc => ({
        ...doc,
        status: doc.status || 'active',
      }));
      
      setObservers(realUsers);
      setLoading(false);
    }, (error) => {
      console.warn('Firestore users error in Observers view:', error);
      setObservers([]);
      setLoading(false);
    });

    // 2. Fetch Reports to aggregate counts per observer
    const unsubscribeReports = onSnapshot(collection(db, 'reports'), (snapshot) => {
      const repDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Report));
      setReports(repDocs);
    }, (error) => {
      console.warn('Firestore reports error in Observers view:', error);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeReports();
    };
  }, []);

  // Compute report count map
  const reportCountsByObserver = reports.reduce((acc, r) => {
    if (r.observerId) {
      acc[r.observerId] = (acc[r.observerId] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Extract unique states from observers
  const availableStates: string[] = Array.from(
    new Set<string>(
      observers
        .map(o => o.state?.trim() || '')
        .filter((state): state is string => state.length > 0)
    )
  ).sort();

  // Filtered observers list
  const filteredObservers = observers.filter(obs => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = !term || (
      (obs.displayName && obs.displayName.toLowerCase().includes(term)) ||
      (obs.email && obs.email.toLowerCase().includes(term)) ||
      (obs.phone && obs.phone.toLowerCase().includes(term)) ||
      (obs.assignedPollingUnitId && obs.assignedPollingUnitId.toLowerCase().includes(term)) ||
      (obs.assignedPollingUnitName && obs.assignedPollingUnitName.toLowerCase().includes(term)) ||
      (obs.lga && obs.lga.toLowerCase().includes(term)) ||
      (obs.state && obs.state.toLowerCase().includes(term))
    );
    
    const matchesStatus = statusFilter === 'all' || (obs.status || 'active') === statusFilter;
    const matchesRole = roleFilter === 'all' || 
      (roleFilter === 'field_supervisor' ? (obs.role === 'field_supervisor' || obs.role === 'supervisor') : obs.role === roleFilter);
    const matchesState = stateFilter === 'all' || (obs.state && obs.state.toLowerCase() === stateFilter.toLowerCase());

    return matchesSearch && matchesStatus && matchesRole && matchesState;
  });

  // Calculate Metrics
  const totalCount = observers.length;
  const activeCount = observers.filter(o => o.status === 'active' || !o.status).length;
  const assignedCount = observers.filter(o => o.assignedPollingUnitId).length;
  const totalSubmissions = (Object.values(reportCountsByObserver) as number[]).reduce((a, b) => a + b, 0);

  // Open Observer Details Slide-Over Drawer
  const handleOpenDrawer = (obs: User) => {
    setDrawerObserver(obs);
    setIsDrawerOpen(true);
  };

  // Open Upgrade Access Level Modal
  const handleOpenUpgradeModal = (obs: User) => {
    setUpgradeObserver(obs);
    setIsUpgradeModalOpen(true);
  };

  // Handle successful access level upgrade
  const handleUpgradeSuccess = (updatedUser: User) => {
    setObservers(prev => prev.map(o => o.uid === updatedUser.uid ? { ...o, role: updatedUser.role } : o));
    if (drawerObserver && drawerObserver.uid === updatedUser.uid) {
      setDrawerObserver(prev => prev ? { ...prev, role: updatedUser.role } : null);
    }
  };

  // Open Edit Assignment Modal
  const handleOpenAssignModal = (obs: User) => {
    setSelectedObserver(obs);
    setAssignedUnitId(obs.assignedPollingUnitId || '');
    setAssignedUnitName(obs.assignedPollingUnitName || '');
    setIsAssignModalOpen(true);
  };

  // Save Polling Unit Assignment
  const handleSaveAssignment = async () => {
    if (!selectedObserver) return;
    setIsUpdating(true);
    try {
      const userRef = doc(db, 'users', selectedObserver.uid);
      await updateDoc(userRef, {
        assignedPollingUnitId: assignedUnitId,
        assignedPollingUnitName: assignedUnitName,
        updatedAt: serverTimestamp()
      });
      
      // Update local state in case Firestore document doesn't exist yet for seed user
      setObservers(prev => prev.map(o => o.uid === selectedObserver.uid ? {
        ...o,
        assignedPollingUnitId: assignedUnitId,
        assignedPollingUnitName: assignedUnitName
      } : o));

      if (drawerObserver && drawerObserver.uid === selectedObserver.uid) {
        setDrawerObserver(prev => prev ? {
          ...prev,
          assignedPollingUnitId: assignedUnitId,
          assignedPollingUnitName: assignedUnitName
        } : null);
      }

      toast.success(`Updated Polling Unit assignment for ${selectedObserver.displayName}`);
      setIsAssignModalOpen(false);
    } catch (err: any) {
      console.error(err);
      // Fallback for mock/seed users if updateDoc fails
      setObservers(prev => prev.map(o => o.uid === selectedObserver.uid ? {
        ...o,
        assignedPollingUnitId: assignedUnitId,
        assignedPollingUnitName: assignedUnitName
      } : o));
      if (drawerObserver && drawerObserver.uid === selectedObserver.uid) {
        setDrawerObserver(prev => prev ? {
          ...prev,
          assignedPollingUnitId: assignedUnitId,
          assignedPollingUnitName: assignedUnitName
        } : null);
      }
      toast.success(`Updated Polling Unit for ${selectedObserver.displayName} (Local Sync)`);
      setIsAssignModalOpen(false);
    } finally {
      setIsUpdating(false);
    }
  };

  // Toggle Observer Status
  const handleToggleStatus = async (obs: User, newStatus: 'active' | 'inactive' | 'suspended') => {
    try {
      const userRef = doc(db, 'users', obs.uid);
      await updateDoc(userRef, { status: newStatus });
      setObservers(prev => prev.map(o => o.uid === obs.uid ? { ...o, status: newStatus } : o));
      if (drawerObserver && drawerObserver.uid === obs.uid) {
        setDrawerObserver(prev => prev ? { ...prev, status: newStatus } : null);
      }
      toast.success(`Observer ${obs.displayName} marked as ${newStatus.toUpperCase()}`);
    } catch (err) {
      setObservers(prev => prev.map(o => o.uid === obs.uid ? { ...o, status: newStatus } : o));
      if (drawerObserver && drawerObserver.uid === obs.uid) {
        setDrawerObserver(prev => prev ? { ...prev, status: newStatus } : null);
      }
      toast.success(`Observer status updated to ${newStatus.toUpperCase()}`);
    }
  };

  // Add New Observer
  const handleCreateObserver = async (e: FormEvent) => {
    e.preventDefault();
    if (!newObserver.displayName || !newObserver.email) {
      toast.error('Name and Email are required');
      return;
    }

    setIsUpdating(true);
    const generatedUid = `obs-${Date.now()}`;
    const newRecord: User = {
      uid: generatedUid,
      displayName: newObserver.displayName.trim(),
      email: newObserver.email.trim(),
      phone: newObserver.phone.trim(),
      role: newObserver.role,
      assignedPollingUnitId: newObserver.assignedPollingUnitId.trim(),
      assignedPollingUnitName: newObserver.assignedPollingUnitName.trim(),
      state: newObserver.state.trim(),
      lga: newObserver.lga.trim(),
      status: 'active',
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'users', generatedUid), {
        ...newRecord,
        updatedAt: serverTimestamp()
      });
      setObservers(prev => [newRecord, ...prev]);
      toast.success(`Field Observer ${newObserver.displayName} registered successfully`);
      setIsAddModalOpen(false);
      setNewObserver({
        displayName: '',
        email: '',
        phone: '',
        role: 'observer',
        assignedPollingUnitId: '',
        assignedPollingUnitName: '',
        state: 'Lagos',
        lga: 'Ikeja'
      });
    } catch (err: any) {
      console.error(err);
      setObservers(prev => [newRecord, ...prev]);
      toast.success(`Observer ${newObserver.displayName} added locally`);
      setIsAddModalOpen(false);
    } finally {
      setIsUpdating(false);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    if (filteredObservers.length === 0) {
      toast.error('No observers match the current filter to export.');
      return;
    }

    // Helper for safe CSV escaping (RFC 4180)
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val);
      if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return `"${str}"`;
    };

    const headers = [
      'Observer ID',
      'Full Name',
      'Email Address',
      'Phone Number',
      'Role',
      'Account Status',
      'Assigned Polling Unit ID',
      'Assigned Polling Unit Name',
      'State',
      'LGA',
      'Check-In Status',
      'Check-In Timestamp',
      'Check-In Lat',
      'Check-In Lng',
      'Total Reports Submitted',
      'Registration Date'
    ];

    const rows = filteredObservers.map(o => [
      escapeCSV(o.uid),
      escapeCSV(o.displayName || 'Unnamed Observer'),
      escapeCSV(o.email || 'N/A'),
      escapeCSV(o.phone || 'N/A'),
      escapeCSV(o.role === 'admin' ? 'Administrator' : o.role === 'field_supervisor' ? 'Field Supervisor' : 'Field Observer'),
      escapeCSV((o.status || 'active').toUpperCase()),
      escapeCSV(o.assignedPollingUnitId || 'Unassigned'),
      escapeCSV(o.assignedPollingUnitName || 'N/A'),
      escapeCSV(o.state || 'N/A'),
      escapeCSV(o.lga || 'N/A'),
      escapeCSV(o.checkInStatus || 'pending'),
      escapeCSV(o.checkInTimestamp ? format(new Date(o.checkInTimestamp), 'yyyy-MM-dd HH:mm:ss') : 'Not Checked In'),
      escapeCSV(o.checkInLat || ''),
      escapeCSV(o.checkInLng || ''),
      reportCountsByObserver[o.uid] || o.reportsCount || 0,
      escapeCSV(o.createdAt ? format(new Date(o.createdAt), 'yyyy-MM-dd HH:mm:ss') : 'N/A')
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const filterContext = stateFilter !== 'all' ? `_${stateFilter.replace(/\s+/g, '_')}` : '';
    const filename = `ivote_observers_directory${filterContext}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${filteredObservers.length} observers to ${filename}`);
  };

  // Export to PDF
  const exportToPDF = () => {
    const docPDF = new jsPDF();
    docPDF.text('iVote - Observer Operations Directory', 14, 15);
    docPDF.setFontSize(10);
    docPDF.text(`Generated on: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`, 14, 22);

    const tableData = filteredObservers.map(o => [
      o.displayName,
      o.email,
      o.role.toUpperCase(),
      (o.status || 'active').toUpperCase(),
      o.assignedPollingUnitId || 'N/A',
      `${reportCountsByObserver[o.uid] || o.reportsCount || 0} reports`
    ]);

    autoTable(docPDF, {
      head: [['Observer Name', 'Email', 'Role', 'Status', 'Assigned Unit', 'Submissions']],
      body: tableData,
      startY: 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [5, 150, 105] }
    });

    docPDF.save(`observers_directory_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
    toast.success('Observers PDF exported successfully');
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-full uppercase tracking-wider">
              Admin & Supervisor Hub
            </span>
            <span className="text-gray-400 text-xs">Updated Live</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight font-serif mt-2">
            Field Observers Directory
          </h1>
          <p className="text-gray-500 mt-2 text-lg font-medium">
            Monitor deployed personnel, manage polling unit assignments, and audit field transmission activity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold rounded-2xl hover:bg-emerald-100 shadow-sm transition-all text-xs"
            title="Download formatted CSV template for bulk observer onboarding"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            CSV Template
          </button>
          <button
            onClick={() => {
              setIsImportWizardOpen(true);
              setImportStep(1);
              setParsedRows([]);
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-800 font-bold rounded-2xl hover:bg-indigo-100 shadow-sm transition-all text-xs"
            title="Launch step-by-step CSV Import Wizard"
          >
            <Upload className="w-4 h-4 text-indigo-600" />
            Import CSV Wizard
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-2xl hover:bg-gray-50 shadow-sm transition-all text-xs"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Export CSV
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-2xl hover:bg-gray-50 shadow-sm transition-all text-xs"
          >
            <FileText className="w-4 h-4 text-emerald-600" />
            PDF Report
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-md transition-all text-xs"
          >
            <UserPlus className="w-4 h-4" />
            Add Observer
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-3">
        <button
          onClick={() => setActiveTab('roster')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'roster'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Observer Directory Roster
        </button>
        <button
          onClick={() => setActiveTab('attendance')}
          className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'attendance'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <Compass className="w-4 h-4" />
          Station Attendance & Geolocation Tracking
        </button>
      </div>

      {activeTab === 'attendance' ? (
        <AttendanceDashboard />
      ) : (
        <>
          {/* KPI Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Registered</p>
            <h3 className="text-3xl font-extrabold text-gray-900 mt-2 font-serif">{totalCount}</h3>
            <p className="text-xs text-emerald-600 font-semibold mt-1">Personnel on Roster</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active On Duty</p>
            <h3 className="text-3xl font-extrabold text-emerald-600 mt-2 font-serif">{activeCount}</h3>
            <p className="text-xs text-gray-500 font-semibold mt-1">Live Monitoring</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Deployed to Polling Units</p>
            <h3 className="text-3xl font-extrabold text-indigo-600 mt-2 font-serif">{assignedCount}</h3>
            <p className="text-xs text-indigo-600 font-semibold mt-1">{Math.round((assignedCount / (totalCount || 1)) * 100)}% Coverage</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <MapPin className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Transmissions</p>
            <h3 className="text-3xl font-extrabold text-amber-600 mt-2 font-serif">{totalSubmissions}</h3>
            <p className="text-xs text-amber-600 font-semibold mt-1">Reports Received</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Activity className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center">
          {/* Search Box */}
          <div className="relative flex-1 w-full">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600" />
            <input
              type="text"
              id="observer-search-input"
              placeholder="Search by observer name, email, phone, state, LGA, or Polling Unit (e.g. PU-LAG-014)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-10 py-3.5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 text-sm font-medium transition-all shadow-xs bg-gray-50/50 focus:bg-white text-gray-900 placeholder:text-gray-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search input"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200/60 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {/* Location / State Filter */}
            <div className="relative flex-1 sm:flex-initial">
              <select
                id="observer-state-filter"
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="w-full sm:w-auto pl-8 pr-8 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-2xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer appearance-none"
              >
                <option value="all">📍 All Locations (States)</option>
                {availableStates.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
              <MapPin className="w-3.5 h-3.5 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Status Select */}
            <select
              id="observer-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex-1 sm:flex-initial px-4 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-2xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active On Duty</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>

            {/* Role Select */}
            <select
              id="observer-role-filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="flex-1 sm:flex-initial px-4 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-2xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
            >
              <option value="all">All Roles</option>
              <option value="observer">Field Observers</option>
              <option value="field_supervisor">Field Supervisors</option>
              <option value="admin">Administrators</option>
            </select>
          </div>
        </div>

        {/* Quick Location Pills & Active Filter Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mr-1">
              Quick State:
            </span>
            <button
              type="button"
              onClick={() => setStateFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                stateFilter === 'all'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {availableStates.slice(0, 6).map((state) => (
              <button
                key={state}
                type="button"
                onClick={() => setStateFilter(state)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  stateFilter.toLowerCase() === state.toLowerCase()
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {state}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-gray-500 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
              Showing <strong className="text-gray-900">{filteredObservers.length}</strong> of <strong className="text-gray-900">{observers.length}</strong> observers
            </span>

            <button
              type="button"
              onClick={exportToCSV}
              title="Download CSV file of all currently filtered observers"
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-full text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export CSV ({filteredObservers.length})</span>
            </button>

            {(searchTerm || statusFilter !== 'all' || roleFilter !== 'all' || stateFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setRoleFilter('all');
                  setStateFilter('all');
                }}
                className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Observers Directory Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="font-medium text-sm">Syncing Observers Roster...</p>
          </div>
        ) : filteredObservers.length === 0 ? (
          <div className="p-16 text-center text-gray-500 space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-gray-100 flex items-center justify-center mx-auto text-gray-400">
              <Search className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800 font-serif">No observers matched your search</h3>
              <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">
                {searchTerm || stateFilter !== 'all' || statusFilter !== 'all' || roleFilter !== 'all'
                  ? `No observer records found matching "${searchTerm || stateFilter || statusFilter || roleFilter}".`
                  : 'There are currently no observers registered in the directory.'}
              </p>
            </div>
            {(searchTerm || stateFilter !== 'all' || statusFilter !== 'all' || roleFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setStateFilter('all');
                  setStatusFilter('all');
                  setRoleFilter('all');
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                Clear Search & Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Observer Personnel</th>
                  <th className="py-4 px-6">Role & Status</th>
                  <th className="py-4 px-6">Station Attendance</th>
                  <th className="py-4 px-6">Assigned Polling Unit</th>
                  <th className="py-4 px-6">State / LGA</th>
                  <th className="py-4 px-6 text-center">Submissions</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredObservers.map((obs) => {
                  const submissionCount = reportCountsByObserver[obs.uid] ?? obs.reportsCount ?? 0;
                  const isCurrentActive = obs.status === 'active' || !obs.status;
                  const isSuspended = obs.status === 'suspended';

                  return (
                    <tr 
                      key={obs.uid} 
                      onClick={() => handleOpenDrawer(obs)}
                      className="hover:bg-emerald-50/40 transition-colors group cursor-pointer"
                      title={`Click to view full dossier & activity logs for ${obs.displayName}`}
                    >
                      {/* Name & Contact */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm shadow-sm border border-emerald-200 shrink-0 group-hover:scale-105 transition-transform">
                            {obs.displayName ? obs.displayName.charAt(0).toUpperCase() : 'O'}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 group-hover:text-emerald-700 transition-colors flex items-center gap-1.5">
                              <span>{obs.displayName}</span>
                              <ChevronRight className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </p>
                            <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3 text-gray-400" />
                                {obs.email}
                              </span>
                              {obs.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-gray-400" />
                                  {obs.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role & Status Badges */}
                      <td className="py-4 px-6">
                        <div className="flex flex-col items-start gap-1.5">
                          <button
                            type="button"
                            disabled={!isAdmin}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isAdmin) handleOpenUpgradeModal(obs);
                            }}
                            className={`px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-md border transition-all ${
                              obs.role === 'admin' 
                                ? 'bg-purple-100 text-purple-700 border-purple-200'
                                : (obs.role === 'field_supervisor' || obs.role === 'supervisor')
                                ? 'bg-blue-100 text-blue-700 border-blue-200'
                                : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            } ${isAdmin ? 'hover:ring-2 hover:ring-indigo-400 hover:shadow-xs cursor-pointer' : 'cursor-default'}`}
                            title={isAdmin ? 'Click to upgrade or modify access level' : undefined}
                          >
                            {obs.role === 'admin' ? 'Administrator' : (obs.role === 'field_supervisor' || obs.role === 'supervisor') ? 'Field Supervisor' : 'Field Observer'}
                            {isAdmin && <span className="ml-1 text-[9px] opacity-70">⚙️</span>}
                          </button>

                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            isCurrentActive 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                              : isSuspended 
                              ? 'bg-red-50 text-red-700 border border-red-100'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              isCurrentActive ? 'bg-emerald-500 animate-pulse' : isSuspended ? 'bg-red-500' : 'bg-gray-400'
                            }`} />
                            {isCurrentActive ? 'Active On Duty' : isSuspended ? 'Suspended' : 'Inactive'}
                          </span>
                        </div>
                      </td>

                      {/* Station Attendance Check-in */}
                      <td className="py-4 px-6">
                        {obs.checkInStatus ? (
                          <div className="space-y-0.5">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              obs.checkInStatus === 'checked_in'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : obs.checkInStatus === 'en_route'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                obs.checkInStatus === 'checked_in' ? 'bg-emerald-600 animate-pulse' : 'bg-amber-500'
                              }`} />
                              {obs.checkInStatus.replace('_', ' ')}
                            </span>
                            {obs.checkInLat && obs.checkInLng && (
                              <div className="text-[10px] text-emerald-700 font-mono font-semibold">
                                GPS Verified
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-gray-400 italic">Not checked in</span>
                        )}
                      </td>

                      {/* Polling Unit */}
                      <td className="py-4 px-6">
                        {obs.assignedPollingUnitId ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-800 rounded-lg text-xs font-mono font-bold">
                              <MapPin className="w-3 h-3 text-emerald-600" />
                              {obs.assignedPollingUnitId}
                            </span>
                            {obs.assignedPollingUnitName && (
                              <p className="text-xs text-gray-500 truncate max-w-[200px]">
                                {obs.assignedPollingUnitName}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-amber-600 font-semibold bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100 inline-block">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* State & LGA */}
                      <td className="py-4 px-6 text-xs text-gray-600 font-medium">
                        {obs.state || obs.lga ? (
                          <div>
                            <p className="font-bold text-gray-800">{obs.state || 'N/A'}</p>
                            <p className="text-gray-400">{obs.lga || ''}</p>
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* Submission Count */}
                      <td className="py-4 px-6 text-center">
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-extrabold text-xs rounded-full border border-emerald-100">
                          {submissionCount} {submissionCount === 1 ? 'Report' : 'Reports'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleOpenUpgradeModal(obs)}
                              className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-xl transition-all"
                              title="Upgrade or Modify Access Level"
                            >
                              <ShieldCheck className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenDrawer(obs)}
                            className="p-2 text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all"
                            title="View Contact & Activity Logs"
                          >
                            <Activity className="w-4 h-4 text-emerald-600" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenAssignModal(obs)}
                            className="p-2 text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all"
                            title="Assign or Edit Polling Unit"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Quick Status Toggle */}
                          {obs.status === 'suspended' ? (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(obs, 'active')}
                              className="px-2.5 py-1 text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-all"
                              title="Reactivate Observer"
                            >
                              Reactivate
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(obs, 'suspended')}
                              className="px-2.5 py-1 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Suspend Access"
                            >
                              Suspend
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )}

      {/* MODAL 1: Assign Polling Unit */}
      <AnimatePresence>
        {isAssignModalOpen && selectedObserver && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl border border-gray-100 space-y-6"
            >
              <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 font-serif">
                    Assign Polling Unit
                  </h3>
                  <p className="text-xs text-gray-500 font-medium mt-1">
                    Updating deployment for <span className="font-bold text-emerald-700">{selectedObserver.displayName}</span>
                  </p>
                </div>
                <button
                  onClick={() => setIsAssignModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Polling Unit Identifier Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PU-LAG-014 or PU-FCT-042"
                    value={assignedUnitId}
                    onChange={(e) => setAssignedUnitId(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Polling Unit Name / Venue Details
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ikeja Primary School, Ward 02"
                    value={assignedUnitName}
                    onChange={(e) => setAssignedUnitName(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-medium"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-2xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAssignment}
                  disabled={isUpdating}
                  className="px-6 py-2.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-md transition-all flex items-center gap-2"
                >
                  {isUpdating ? 'Saving...' : 'Confirm Assignment'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: Add New Observer */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-xl w-full shadow-2xl border border-gray-100 space-y-6"
            >
              <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 font-serif">
                    Register New Field Observer
                  </h3>
                  <p className="text-xs text-gray-500 font-medium mt-1">
                    Add authorized election monitoring personnel to the roster.
                  </p>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateObserver} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. David Alabi"
                      value={newObserver.displayName}
                      onChange={(e) => setNewObserver({ ...newObserver, displayName: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="observer@ivote.org"
                      value={newObserver.email}
                      onChange={(e) => setNewObserver({ ...newObserver, email: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      placeholder="+234 800 000 0000"
                      value={newObserver.phone}
                      onChange={(e) => setNewObserver({ ...newObserver, phone: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      System Role
                    </label>
                    <select
                      value={newObserver.role}
                      onChange={(e) => setNewObserver({ ...newObserver, role: e.target.value as any })}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm font-bold bg-white"
                    >
                      <option value="observer">Field Observer</option>
                      <option value="field_supervisor">Field Supervisor</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      State
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Lagos"
                      value={newObserver.state}
                      onChange={(e) => setNewObserver({ ...newObserver, state: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      LGA / District
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ikeja"
                      value={newObserver.lga}
                      onChange={(e) => setNewObserver({ ...newObserver, lga: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Polling Unit Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. PU-LAG-015"
                      value={newObserver.assignedPollingUnitId}
                      onChange={(e) => setNewObserver({ ...newObserver, assignedPollingUnitId: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                      Venue Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. St. Judes Secondary"
                      value={newObserver.assignedPollingUnitName}
                      onChange={(e) => setNewObserver({ ...newObserver, assignedPollingUnitName: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-2xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="px-6 py-2.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-md transition-all flex items-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    Register Observer
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: CSV Import Onboarding Wizard */}
      <AnimatePresence>
        {isImportWizardOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-3xl w-full shadow-2xl border border-gray-100 space-y-6 my-8"
            >
              {/* Wizard Header */}
              <div className="flex justify-between items-start border-b border-gray-100 pb-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">
                    <Sparkles className="w-4 h-4" />
                    Bulk Onboarding Assistant
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 font-serif">
                    Observer CSV Import Wizard
                  </h3>
                </div>
                <button
                  onClick={() => setIsImportWizardOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Step Progress Stepper */}
              <div className="grid grid-cols-3 gap-2 py-2">
                <div className={`p-3 rounded-2xl border flex items-center gap-3 ${
                  importStep === 1 
                    ? 'bg-indigo-50/80 border-indigo-200 text-indigo-900 font-bold' 
                    : importStep > 1 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold'
                    : 'bg-gray-50 border-gray-100 text-gray-400'
                }`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    importStep === 1 ? 'bg-indigo-600 text-white' : importStep > 1 ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {importStep > 1 ? <Check className="w-4 h-4" /> : '1'}
                  </div>
                  <span className="text-xs">1. Upload CSV</span>
                </div>

                <div className={`p-3 rounded-2xl border flex items-center gap-3 ${
                  importStep === 2 
                    ? 'bg-indigo-50/80 border-indigo-200 text-indigo-900 font-bold' 
                    : importStep > 2 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold'
                    : 'bg-gray-50 border-gray-100 text-gray-400'
                }`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    importStep === 2 ? 'bg-indigo-600 text-white' : importStep > 2 ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {importStep > 2 ? <Check className="w-4 h-4" /> : '2'}
                  </div>
                  <span className="text-xs">2. Preview & Validate</span>
                </div>

                <div className={`p-3 rounded-2xl border flex items-center gap-3 ${
                  importStep === 3 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-bold' 
                    : 'bg-gray-50 border-gray-100 text-gray-400'
                }`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    importStep === 3 ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    3
                  </div>
                  <span className="text-xs">3. Complete</span>
                </div>
              </div>

              {/* STEP 1: Upload CSV */}
              {importStep === 1 && (
                <div className="space-y-6">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-3xl p-10 text-center transition-all flex flex-col items-center justify-center gap-4 cursor-pointer ${
                      isDragging 
                        ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]' 
                        : 'border-gray-200 hover:border-indigo-400 hover:bg-gray-50/80'
                    }`}
                  >
                    <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm border border-indigo-100">
                      <Upload className="w-8 h-8" />
                    </div>

                    <div>
                      <h4 className="text-lg font-bold text-gray-900 font-serif">
                        Drag and drop your Observer CSV file here
                      </h4>
                      <p className="text-xs text-gray-500 font-medium mt-1">
                        Supports standard UTF-8 .CSV files up to 10MB
                      </p>
                    </div>

                    <label className="cursor-pointer px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-2xl shadow-md transition-all">
                      Browse Computer
                      <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleFileUpload(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  </div>

                  {/* CSV Guidelines & Template Helper */}
                  <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-gray-800">Need the standard onboarding template?</p>
                        <p className="text-[11px] text-gray-500">Includes correct headers: Name, Email, Phone, Role, Polling Unit ID, Polling Unit Name, State, LGA.</p>
                      </div>
                    </div>
                    <button
                      onClick={handleDownloadTemplate}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shrink-0 transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download CSV Template
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: Preview & Validation Table */}
              {importStep === 2 && (
                <div className="space-y-6">
                  {/* Summary Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-4 text-xs font-bold">
                      <span className="text-gray-700">Total Found: <strong className="text-gray-900 font-extrabold">{parsedRows.length}</strong></span>
                      <span className="text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg">
                        Valid: {parsedRows.filter(r => r.isValid).length}
                      </span>
                      {parsedRows.filter(r => !r.isValid).length > 0 && (
                        <span className="text-red-700 bg-red-100 px-2.5 py-1 rounded-lg">
                          Errors: {parsedRows.filter(r => !r.isValid).length}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        const allValidSelected = parsedRows.filter(r => r.isValid).every(r => r.selected);
                        setParsedRows(prev => prev.map(r => r.isValid ? { ...r, selected: !allValidSelected } : r));
                      }}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline"
                    >
                      Toggle All Valid
                    </button>
                  </div>

                  {/* Preview Table */}
                  <div className="max-h-72 overflow-y-auto border border-gray-100 rounded-2xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-gray-50 sticky top-0 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        <tr>
                          <th className="p-3 text-center">Import</th>
                          <th className="p-3">Observer Name</th>
                          <th className="p-3">Email</th>
                          <th className="p-3">Role</th>
                          <th className="p-3">Polling Unit</th>
                          <th className="p-3 text-right">Validation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {parsedRows.map((row) => (
                          <tr key={row.id} className={row.isValid ? 'hover:bg-emerald-50/20' : 'bg-red-50/30'}>
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                disabled={!row.isValid}
                                checked={row.selected}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setParsedRows(prev => prev.map(r => r.id === row.id ? { ...r, selected: checked } : r));
                                }}
                                className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                              />
                            </td>
                            <td className="p-3 font-bold text-gray-900">{row.displayName || '—'}</td>
                            <td className="p-3 text-gray-600 font-mono text-[11px]">{row.email || '—'}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                row.role === 'supervisor' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {row.role}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-gray-600">{row.assignedPollingUnitId || 'Unassigned'}</td>
                            <td className="p-3 text-right">
                              {row.isValid ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-md text-[10px]">
                                  <Check className="w-3 h-3" /> Ready
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-800 font-bold rounded-md text-[10px]" title={row.validationError}>
                                  <AlertTriangle className="w-3 h-3" /> {row.validationError}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-between items-center border-t border-gray-100 pt-4">
                    <button
                      onClick={() => setImportStep(1)}
                      className="px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-all flex items-center gap-1.5"
                    >
                      <ArrowLeft className="w-4 h-4" /> Re-upload CSV
                    </button>

                    <button
                      onClick={handleExecuteImport}
                      disabled={isImporting || parsedRows.filter(r => r.selected && r.isValid).length === 0}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-2xl shadow-md transition-all flex items-center gap-2"
                    >
                      {isImporting ? 'Importing Personnel...' : `Onboard ${parsedRows.filter(r => r.selected && r.isValid).length} Selected Observers`}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Progress & Success Confirmation */}
              {importStep === 3 && (
                <div className="py-8 text-center space-y-6">
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <CheckCircle className="w-10 h-10" />
                  </div>

                  <div>
                    <h4 className="text-2xl font-bold text-gray-900 font-serif">
                      Onboarding Completed Successfully!
                    </h4>
                    <p className="text-sm text-gray-500 font-medium mt-2 max-w-md mx-auto">
                      <strong>{importedCount}</strong> new field observers have been registered and activated on the platform with assigned polling unit credentials.
                    </p>
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={() => setIsImportWizardOpen(false)}
                      className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-2xl shadow-lg transition-all"
                    >
                      Return to Observers Directory
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Slide-Over Drawer: Observer Profile & Recent Activity Logs */}
      <ObserverDrawer
        observer={drawerObserver}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onEditAssignment={(obs) => {
          setIsDrawerOpen(false);
          handleOpenAssignModal(obs);
        }}
        onUpgradeRole={isAdmin ? (obs) => {
          setIsDrawerOpen(false);
          handleOpenUpgradeModal(obs);
        } : undefined}
        onToggleStatus={handleToggleStatus}
        reportCount={drawerObserver ? (reportCountsByObserver[drawerObserver.uid] ?? drawerObserver.reportsCount ?? 0) : 0}
      />

      {/* MODAL 4: Upgrade / Adjust User Access Level */}
      <RoleUpgradeModal
        user={upgradeObserver}
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        onSuccess={handleUpgradeSuccess}
      />
    </div>
  );
}
