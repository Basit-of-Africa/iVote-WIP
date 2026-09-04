import { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'field_supervisor' | 'supervisor' | 'observer';

export type ElectionLevel = 'governorship' | 'general_federal' | 'presidential' | 'senatorial' | 'house_of_reps';

export interface ElectionScope {
  id: string;
  name: string;
  level: ElectionLevel;
  state?: string;
  year: number;
  isOffCycle?: boolean;
  isActiveDefault?: boolean;
  description?: string;
}

export type CheckInStatus = 'checked_in' | 'en_route' | 'not_checked_in';

export interface User {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  assignedPollingUnitId?: string;
  assignedPollingUnitName?: string;
  phone?: string;
  status?: 'active' | 'inactive' | 'suspended';
  state?: string;
  lga?: string;
  reportsCount?: number;
  lastActive?: string;
  createdAt: string;
  checkInStatus?: CheckInStatus;
  checkInTimestamp?: string;
  checkInLat?: number;
  checkInLng?: number;
  checkInAccuracy?: number;
  checkInNotes?: string;
}

export interface CheckInRecord {
  id: string;
  observerId: string;
  observerName: string;
  observerEmail: string;
  pollingUnitId: string;
  pollingUnitName: string;
  state?: string;
  lga?: string;
  status: CheckInStatus;
  timestamp: string | Timestamp;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  notes?: string;
}

export interface PollingUnit {
  id: string;
  name: string;
  state: string;
  lga: string;
  ward: string;
  totalRegisteredVoters: number;
}

export type ReportType = 'accreditation' | 'incident' | 'result';

export interface Report {
  id: string;
  pollingUnitId: string;
  observerId: string;
  timestamp: string | Timestamp;
  type: ReportType;
  payload: any;
  location?: {
    lat: number;
    lng: number;
  };
  media?: {
    url: string;
    type: string;
    hash?: string;
  }[];
}

export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'pending' | 'investigating' | 'resolved';

export interface Incident {
  id: string;
  reportId: string;
  pollingUnitId: string;
  severity: Severity;
  status: IncidentStatus;
  description: string;
  timestamp: string | Timestamp;
  media?: {
    url: string;
    type: string;
    hash?: string;
  }[];
}

export type NotificationType = 'info' | 'warning' | 'error' | 'success' | 'urgent_directive' | 'admin_update';

export interface Notification {
  id: string;
  userId: string; // Target user or 'admin' / 'supervisor' / 'field_supervisor' / 'observer' / 'all'
  title: string;
  message: string;
  type: NotificationType;
  category?: 'directive' | 'update' | 'incident' | 'system';
  priority?: 'normal' | 'urgent' | 'critical';
  senderName?: string;
  senderRole?: string;
  targetRole?: 'all' | 'observer' | 'supervisor' | 'field_supervisor' | 'admin';
  targetState?: string;
  acknowledgedBy?: string[];
  read: boolean;
  link?: string;
  timestamp: string | Timestamp;
}

export interface AuditLogEntry {
  id: string;
  action: 'DELETE_REPORT' | 'DELETE_INCIDENT' | 'UPDATE_REPORT' | 'UPDATE_INCIDENT_STATUS' | 'BROADCAST_DIRECTIVE' | 'UPGRADE_USER_ROLE';
  targetId: string;
  targetType: 'report' | 'incident' | 'directive' | 'user';
  pollingUnitId?: string;
  summary: string;
  reason?: string;
  deletedBy: string;
  deletedByEmail?: string;
  deletedByName: string;
  deletedByRole?: string;
  timestamp: string | Timestamp;
  snapshot?: any;
}
