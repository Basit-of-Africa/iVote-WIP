import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Report } from '../types';
import { useAuth } from '../context/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  ArrowLeft, 
  Save, 
  History, 
  AlertCircle, 
  FileText, 
  MapPin, 
  Calendar,
  User as UserIcon,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'motion/react';

const editReportSchema = z.object({
  pollingUnitId: z.string().min(1, 'Polling unit is required'),
  type: z.enum(['accreditation', 'incident', 'result']),
  description: z.string().optional(),
  voterTurnout: z.string().optional(),
  results: z.string().optional(),
});

type EditReportForm = z.infer<typeof editReportSchema>;

interface AuditLog {
  id: string;
  updatedBy: string;
  updatedByName: string;
  changes: any;
  timestamp: any;
}

export default function EditReport() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<EditReportForm>({
    resolver: zodResolver(editReportSchema)
  });

  useEffect(() => {
    if (!id || !isAdmin) return;

    const fetchReport = async () => {
      try {
        const snap = await getDoc(doc(db, 'reports', id));
        if (snap.exists()) {
          const data = snap.data() as Report;
          setReport({ id: snap.id, ...data });
          reset({
            pollingUnitId: data.pollingUnitId,
            type: data.type,
            description: data.payload?.description || '',
            voterTurnout: data.payload?.voterTurnout || '',
            results: typeof data.payload?.results === 'object' ? JSON.stringify(data.payload.results) : data.payload?.results || ''
          });
        }
        setLoading(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `reports/${id}`);
      }
    };

    fetchReport();

    // Subscribe to audit logs
    const logsQuery = query(collection(db, `reports/${id}/audit_logs`), orderBy('timestamp', 'desc'));
    const unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
      setAuditLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog)));
    });

    return () => unsubscribeLogs();
  }, [id, isAdmin, reset]);

  const onSubmit = async (data: EditReportForm) => {
    if (!id || !isAdmin || !report) return;
    setIsSaving(true);
    try {
      const updatedPayload = {
        ...report.payload,
        description: data.description,
        voterTurnout: data.voterTurnout,
        results: data.results
      };

      const originalData = { ...report };

      await updateDoc(doc(db, 'reports', id), {
        pollingUnitId: data.pollingUnitId,
        type: data.type,
        payload: updatedPayload,
        updatedAt: serverTimestamp()
      });

      // Add to audit log
      await addDoc(collection(db, `reports/${id}/audit_logs`), {
        updatedBy: auth.currentUser?.uid,
        updatedByName: auth.currentUser?.displayName,
        timestamp: serverTimestamp(),
        changes: {
          before: {
            pollingUnitId: originalData.pollingUnitId,
            type: originalData.type,
            payload: originalData.payload
          },
          after: {
            pollingUnitId: data.pollingUnitId,
            type: data.type,
            payload: updatedPayload
          }
        }
      });

      // If escalated to Incident, notify supervisors
      if (originalData.type !== 'incident' && data.type === 'incident') {
        await addDoc(collection(db, 'notifications'), {
          userId: 'supervisor',
          title: `NEW INCIDENT ESCALATED: ${data.pollingUnitId}`,
          message: `Admin ${auth.currentUser?.displayName} has reclassified a report as an incident.`,
          type: 'warning',
          read: false,
          link: `/reports`, 
          timestamp: serverTimestamp(),
        });
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reports/${id}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAdmin) return <div className="p-20 text-center">Unauthorized Access</div>;
  if (loading) return <div className="flex items-center justify-center min-h-[60vh]">Loading report data...</div>;
  if (!report) return <div className="p-20 text-center">Report not found</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20">
      <div className="flex items-center justify-between">
        <Link to="/reports" className="inline-flex items-center gap-2 text-gray-500 hover:text-emerald-700 transition-colors font-bold group">
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          Back to Reports
        </Link>
        {success && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl font-bold text-sm"
          >
            <CheckCircle2 className="w-4 h-4" /> Changes verified and saved
          </motion.div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm p-10">
            <div className="flex items-center gap-4 mb-10">
              <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-900 border border-gray-100">
                <FileText className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 font-serif tracking-tight">Modify Report</h1>
                <p className="text-gray-400 font-mono text-xs uppercase tracking-widest mt-1">ID: {id}</p>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Polling Unit ID</label>
                    <div className="relative">
                      <MapPin className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                      <input 
                        {...register('pollingUnitId')}
                        className="w-full pl-12 pr-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                      />
                    </div>
                    {errors.pollingUnitId && <p className="text-red-500 text-xs mt-1 px-1 font-bold">{errors.pollingUnitId.message}</p>}
                 </div>

                 <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Report Classification</label>
                    <select 
                      {...register('type')}
                      className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all appearance-none"
                    >
                      <option value="accreditation">Accreditation Data</option>
                      <option value="incident">Critical Incident</option>
                      <option value="result">Official Results</option>
                    </select>
                 </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Content / Description</label>
                <textarea 
                  {...register('description')}
                  rows={4}
                  className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all resize-none"
                  placeholder="Official record details..."
                />
              </div>

              {watch('type') === 'result' && (
                <div className="space-y-2 pt-4">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Result JSON (Raw)</label>
                  <textarea 
                    {...register('results')}
                    rows={6}
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-mono focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all resize-none"
                    placeholder='{"APC": 0, "PDP": 0, ...}'
                  />
                  <p className="text-[10px] text-gray-400 px-1 italic">Note: Modifying results directly requires valid JSON format.</p>
                </div>
              )}

              <div className="pt-6">
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="w-full md:w-auto px-10 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all flex items-center justify-center gap-3 shadow-lg shadow-gray-200 disabled:opacity-50"
                >
                  <Save className="w-5 h-5" />
                  {isSaving ? 'Verifying & Saving...' : 'Confirm Report Amendments'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="space-y-10">
          <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm p-8">
            <h3 className="font-bold text-sm uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
              <UserIcon className="w-4 h-4" /> Original Submitter
            </h3>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500">
                {report.observerId.substring(0, 2)}
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter">Observer UID</p>
                <p className="text-sm font-bold text-gray-900">{report.observerId}</p>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-gray-50 flex items-center gap-4">
              <Calendar className="w-5 h-5 text-gray-300" />
              <div>
                 <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter">Initial Timestamp</p>
                 <p className="text-sm font-bold text-gray-900">
                   {report.timestamp instanceof Object ? format((report.timestamp as any).toDate(), 'PPP p') : 'N/A'}
                 </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm p-8">
            <h3 className="font-bold text-sm uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
              <History className="w-4 h-4" /> Administrative Audit Log
            </h3>
            <div className="space-y-8">
              {auditLogs.length === 0 ? (
                <div className="text-center py-6">
                  <AlertCircle className="w-6 h-6 text-gray-200 mx-auto mb-2" />
                  <p className="text-xs text-gray-400 italic">No historical corrections logged</p>
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="relative pl-6 pb-6 border-l border-gray-50 last:border-0 last:pb-0">
                    <div className="absolute left-[-4px] top-1 w-2 h-2 rounded-full bg-emerald-500" />
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <p className="text-xs font-bold text-gray-900">{log.updatedByName || 'Admin Agent'}</p>
                        <p className="text-[10px] text-gray-400 font-mono">
                          {log.timestamp instanceof Object ? format((log.timestamp as any).toDate(), 'HH:mm') : 'Syncing'}
                        </p>
                      </div>
                      <p className="text-[10px] text-gray-500 leading-tight">
                        Amended report classification and PU record metadata.
                      </p>
                      <p className="text-[9px] text-gray-400 font-mono italic">
                        {log.timestamp instanceof Object ? format((log.timestamp as any).toDate(), 'MMM d, yyyy') : ''}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
