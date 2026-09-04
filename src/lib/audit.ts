import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';
import { AuditLogEntry } from '../types';

export async function logAuditEvent(params: {
  action: AuditLogEntry['action'];
  targetId: string;
  targetType: AuditLogEntry['targetType'];
  pollingUnitId?: string;
  summary: string;
  reason?: string;
  snapshot?: any;
}) {
  try {
    const user = auth.currentUser;
    await addDoc(collection(db, 'audit_logs'), {
      action: params.action,
      targetId: params.targetId,
      targetType: params.targetType,
      pollingUnitId: params.pollingUnitId || '',
      summary: params.summary || '',
      reason: params.reason || 'Administrative verification / test cleanup',
      deletedBy: user?.uid || 'system_admin',
      deletedByEmail: user?.email || 'admin@ivote.ng',
      deletedByName: user?.displayName || 'System Administrator',
      deletedByRole: 'admin',
      timestamp: serverTimestamp(),
      snapshot: params.snapshot || null,
    });
  } catch (error) {
    console.warn('Failed to record audit trail log in Firestore:', error);
  }
}
