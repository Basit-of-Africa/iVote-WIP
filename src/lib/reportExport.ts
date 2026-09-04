import { format } from 'date-fns';
import { Report } from '../types';

export interface ObserverInfo {
  displayName?: string;
  email?: string;
  phone?: string;
}

export interface IncidentMeta {
  id?: string;
  status?: string;
}

export interface ExportOptions {
  dateRange?: 'all' | 'today' | '24h' | '7d';
  electionLevel?: string;
  observerMap?: Record<string, ObserverInfo>;
  incidentMap?: Record<string, IncidentMeta>;
  customFilenamePrefix?: string;
}

export const INCIDENT_CATEGORY_LABELS: Record<string, string> = {
  bvas_failure: 'BVAS Device / Technical Failure',
  violence_intimidation: 'Violence / Physical Intimidation / Political Thuggery',
  ballot_tampering: 'Ballot Box Snatching / Destruction of Materials',
  logistics_delay: 'Late Arrival of Officials / Missing Materials',
  vote_buying: 'Vote Buying / Cash & Commodity Inducement',
  disenfranchisement: 'Voter Suppression / Undue Refusal of Accreditation',
  procedural_irregularity: 'Breach of Electoral Act / Unauthorized Agents',
  other: 'Other Severe Polling Station Disruption'
};

export const BVAS_STATUS_LABELS: Record<string, string> = {
  functioning: 'Fully Functioning',
  intermittent: 'Slow / Intermittent',
  malfunctioning: 'Malfunctioning',
  not_arrived: 'Device Not Delivered'
};

export const QUEUE_SIZE_LABELS: Record<string, string> = {
  short: '< 50 Voters (Short)',
  medium: '50 - 150 Voters (Moderate)',
  large: '150 - 300 Voters (Long)',
  overflowing: '300+ Voters (Massive Turnout)'
};

export const SECURITY_NOTIFIED_LABELS: Record<string, string> = {
  yes: 'Yes (Operatives Alerted)',
  no: 'No (Present but Unalerted)',
  none_present: 'None Stationed at PU'
};

export const STATE_CODE_MAP: Record<string, string> = {
  OS: 'Osun',
  LA: 'Lagos',
  OG: 'Ogun',
  OY: 'Oyo',
  ON: 'Ondo',
  EK: 'Ekiti',
  FC: 'FCT Abuja',
  RV: 'Rivers',
  KD: 'Kaduna',
  KN: 'Kano',
  AN: 'Anambra',
  ED: 'Edo',
  DT: 'Delta'
};

/**
 * Cleanly format and escape strings according to RFC 4180 CSV specifications.
 * Encloses all text in double-quotes and replaces internal quotes with double-quotes.
 */
export function formatCSVCell(value: any): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  return `"${str.replace(/"/g, '""').replace(/\r?\n|\r/g, ' ')}"`;
}

/**
 * Format numeric cells cleanly without quotes for mathematical spreadsheets.
 */
export function formatCSVNumber(value: any): string {
  if (value === null || value === undefined || value === '') return '""';
  const num = Number(value);
  return isNaN(num) ? '""' : String(num);
}

/**
 * Extract Date object safely from Firestore Timestamp or string
 */
export function parseReportDate(timestamp: any): Date | null {
  if (!timestamp) return null;
  try {
    if (typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    if (timestamp instanceof Date) {
      return timestamp;
    }
    const parsed = new Date(timestamp);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

/**
 * Format timestamp into standard UTC and Local Nigerian Time (WAT: UTC+1)
 */
export function formatReportTimestamps(timestamp: any): { utc: string; wat: string } {
  const dt = parseReportDate(timestamp);
  if (!dt) return { utc: 'N/A', wat: 'N/A' };

  try {
    const utcStr = dt.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    // West Africa Time is UTC+1 (Nigeria standard time)
    const watOffsetMs = 60 * 60 * 1000;
    const watDate = new Date(dt.getTime() + watOffsetMs);
    const watStr = format(watDate, 'yyyy-MM-dd HH:mm:ss') + ' WAT';
    return { utc: utcStr, wat: watStr };
  } catch {
    return { utc: String(timestamp), wat: String(timestamp) };
  }
}

/**
 * Parse location details (State, LGA, Ward) from payload or Polling Unit ID
 */
export function resolveLocationDetails(report: Report): { state: string; lga: string; ward: string } {
  const payload = report.payload || {};
  let state = payload.state || '';
  let lga = payload.lga || '';
  let ward = payload.ward || '';

  // Attempt heuristic fallback from PU ID (e.g. OS/EJ/04/001)
  if ((!state || !lga) && report.pollingUnitId) {
    const parts = report.pollingUnitId.split(/[\/\-_]/);
    if (parts.length >= 2) {
      const code = parts[0].toUpperCase();
      if (STATE_CODE_MAP[code] && !state) {
        state = STATE_CODE_MAP[code];
      }
      if (parts[1] && !lga) {
        lga = parts[1];
      }
      if (parts[2] && !ward) {
        ward = `Ward ${parts[2]}`;
      }
    }
  }

  return {
    state: state || 'Osun', // Default monitored off-cycle state if undetermined
    lga: lga || 'Ejigbo',
    ward: ward || 'Ward 01'
  };
}

/**
 * Filters reports according to specified export options (date range, election level)
 */
export function filterReportsForExport(reports: Report[], options?: ExportOptions): Report[] {
  if (!options) return reports;

  const now = new Date();

  return reports.filter((r) => {
    // 1. Election level filter
    if (options.electionLevel && options.electionLevel !== 'all') {
      const level = r.payload?.electionLevel || 'governorship';
      if (level !== options.electionLevel) return false;
    }

    // 2. Date range filter
    if (options.dateRange && options.dateRange !== 'all') {
      const dt = parseReportDate(r.timestamp);
      if (!dt) return false;

      const diffMs = now.getTime() - dt.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      if (options.dateRange === 'today') {
        const isToday = dt.getDate() === now.getDate() &&
                        dt.getMonth() === now.getMonth() &&
                        dt.getFullYear() === now.getFullYear();
        if (!isToday) return false;
      } else if (options.dateRange === '24h') {
        if (diffHours > 24) return false;
      } else if (options.dateRange === '7d') {
        if (diffHours > 24 * 7) return false;
      }
    }

    return true;
  });
}

/**
 * Triggers automatic browser file download with UTF-8 BOM encoding for Excel compatibility
 */
export function triggerCSVDownload(filename: string, csvContent: string) {
  // Prepend UTF-8 Byte Order Mark (\uFEFF) so Excel, Google Sheets, and Numbers properly parse UTF-8 characters
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export 1: Structured Incident Reports Dataset
 * Tailored specifically for electoral violence, BVAS failures, vote-buying, and security analysis.
 */
export function exportIncidentReportsCSV(
  allReports: Report[],
  options: ExportOptions = {}
): { count: number; filename: string } {
  const filtered = filterReportsForExport(allReports, options);
  const incidentReports = filtered.filter((r) => r.type === 'incident');

  const headers = [
    'Report ID',
    'Incident Reference',
    'Polling Unit ID',
    'State',
    'LGA',
    'Ward',
    'Election Contest Level',
    'Incident Severity',
    'Incident Category Key',
    'Incident Category Label',
    'Security Operatives Notified',
    'Investigation Status',
    'Full Incident Description',
    'Observer ID',
    'Observer Display Name',
    'Observer Email',
    'PU Latitude',
    'PU Longitude',
    'Timestamp (UTC)',
    'Timestamp (Local WAT)',
    'Evidence Photos Count',
    'Evidence Photo URLs'
  ];

  const rows = incidentReports.map((r) => {
    const payload = r.payload || {};
    const loc = resolveLocationDetails(r);
    const times = formatReportTimestamps(r.timestamp);
    const observer = options.observerMap?.[r.observerId] || {};
    const incMeta = options.incidentMap?.[r.id] || {};

    const categoryKey = payload.incidentCategory || 'other';
    const categoryLabel = INCIDENT_CATEGORY_LABELS[categoryKey] || categoryKey;

    const securityKey = payload.securityNotified || 'none_present';
    const securityLabel = SECURITY_NOTIFIED_LABELS[securityKey] || securityKey;

    const mediaList = r.media || [];
    const mediaUrls = mediaList.map((m) => m.url).filter(Boolean).join('; ');

    const status = incMeta.status || payload.status || 'pending';

    return [
      formatCSVCell(r.id),
      formatCSVCell(incMeta.id || `INC-${r.id.substring(0, 8).toUpperCase()}`),
      formatCSVCell(r.pollingUnitId),
      formatCSVCell(loc.state),
      formatCSVCell(loc.lga),
      formatCSVCell(loc.ward),
      formatCSVCell(payload.electionLevel || 'governorship'),
      formatCSVCell((payload.severity || 'medium').toUpperCase()),
      formatCSVCell(categoryKey),
      formatCSVCell(categoryLabel),
      formatCSVCell(securityLabel),
      formatCSVCell(status.toUpperCase()),
      formatCSVCell(payload.description || ''),
      formatCSVCell(r.observerId || 'Unassigned'),
      formatCSVCell(observer.displayName || 'Field Observer'),
      formatCSVCell(observer.email || 'N/A'),
      formatCSVCell(r.location?.lat ?? ''),
      formatCSVCell(r.location?.lng ?? ''),
      formatCSVCell(times.utc),
      formatCSVCell(times.wat),
      formatCSVNumber(mediaList.length),
      formatCSVCell(mediaUrls)
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const timestampStr = format(new Date(), 'yyyyMMdd_HHmm');
  const filename = `${options.customFilenamePrefix || 'ivote_incidents_dataset'}_${timestampStr}.csv`;

  triggerCSVDownload(filename, csvContent);
  return { count: incidentReports.length, filename };
}

/**
 * Export 2: Structured Accreditation & Voter Turnout Dataset
 * Tailored specifically for voter turnout, BVAS operational health, queue delays, and flow modeling.
 */
export function exportAccreditationReportsCSV(
  allReports: Report[],
  options: ExportOptions = {}
): { count: number; filename: string } {
  const filtered = filterReportsForExport(allReports, options);
  const accreditationReports = filtered.filter((r) => r.type === 'accreditation');

  const headers = [
    'Report ID',
    'Polling Unit ID',
    'State',
    'LGA',
    'Ward',
    'Election Contest Level',
    'BVAS Accredited Voter Count',
    'BVAS Hardware Status Key',
    'BVAS Hardware Operational Health',
    'Queue Crowd Size Key',
    'Queue Crowd Size Estimate',
    'Observation & Queue Notes',
    'Observer ID',
    'Observer Display Name',
    'Observer Email',
    'PU Latitude',
    'PU Longitude',
    'Timestamp (UTC)',
    'Timestamp (Local WAT)',
    'Evidence Photos Count',
    'Evidence Photo URLs'
  ];

  const rows = accreditationReports.map((r) => {
    const payload = r.payload || {};
    const loc = resolveLocationDetails(r);
    const times = formatReportTimestamps(r.timestamp);
    const observer = options.observerMap?.[r.observerId] || {};

    const bvasKey = payload.bvasStatus || 'functioning';
    const bvasLabel = BVAS_STATUS_LABELS[bvasKey] || bvasKey;

    const queueKey = payload.queueSize || 'medium';
    const queueLabel = QUEUE_SIZE_LABELS[queueKey] || queueKey;

    const voterCount = typeof payload.voterCount === 'number' && !isNaN(payload.voterCount)
      ? payload.voterCount
      : 0;

    const mediaList = r.media || [];
    const mediaUrls = mediaList.map((m) => m.url).filter(Boolean).join('; ');

    return [
      formatCSVCell(r.id),
      formatCSVCell(r.pollingUnitId),
      formatCSVCell(loc.state),
      formatCSVCell(loc.lga),
      formatCSVCell(loc.ward),
      formatCSVCell(payload.electionLevel || 'governorship'),
      formatCSVNumber(voterCount),
      formatCSVCell(bvasKey),
      formatCSVCell(bvasLabel),
      formatCSVCell(queueKey),
      formatCSVCell(queueLabel),
      formatCSVCell(payload.description || ''),
      formatCSVCell(r.observerId || 'Unassigned'),
      formatCSVCell(observer.displayName || 'Field Observer'),
      formatCSVCell(observer.email || 'N/A'),
      formatCSVCell(r.location?.lat ?? ''),
      formatCSVCell(r.location?.lng ?? ''),
      formatCSVCell(times.utc),
      formatCSVCell(times.wat),
      formatCSVNumber(mediaList.length),
      formatCSVCell(mediaUrls)
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const timestampStr = format(new Date(), 'yyyyMMdd_HHmm');
  const filename = `${options.customFilenamePrefix || 'ivote_accreditation_turnout_dataset'}_${timestampStr}.csv`;

  triggerCSVDownload(filename, csvContent);
  return { count: accreditationReports.length, filename };
}

/**
 * Export 3: Master Comprehensive Electoral Dataset
 * Comprehensive multi-dimensional extract containing both Incident and Accreditation fields,
 * plus Official Ballot Result tallies.
 */
export function exportMasterReportsCSV(
  allReports: Report[],
  options: ExportOptions = {}
): { count: number; filename: string } {
  const filtered = filterReportsForExport(allReports, options);

  const headers = [
    'Report ID',
    'Report Type',
    'Polling Unit ID',
    'State',
    'LGA',
    'Ward',
    'Election Level',
    'Timestamp (UTC)',
    'Timestamp (Local WAT)',
    'Observer ID',
    'Observer Name',
    'Observer Email',
    'Accredited Voters (BVAS)',
    'BVAS Hardware Health',
    'Queue Size Estimate',
    'Incident Severity',
    'Incident Category',
    'Security Personnel Alerted',
    'Incident Status',
    'APC Votes',
    'PDP Votes',
    'LP Votes',
    'NNPP Votes',
    'Other Votes',
    'Total Form EC8A Votes',
    'Observation Details / Notes',
    'Latitude',
    'Longitude',
    'Evidence Attachments Count',
    'Evidence URLs'
  ];

  const rows = filtered.map((r) => {
    const payload = r.payload || {};
    const loc = resolveLocationDetails(r);
    const times = formatReportTimestamps(r.timestamp);
    const observer = options.observerMap?.[r.observerId] || {};
    const incMeta = options.incidentMap?.[r.id] || {};

    const bvasLabel = payload.bvasStatus ? (BVAS_STATUS_LABELS[payload.bvasStatus] || payload.bvasStatus) : '';
    const queueLabel = payload.queueSize ? (QUEUE_SIZE_LABELS[payload.queueSize] || payload.queueSize) : '';
    const incCatLabel = payload.incidentCategory ? (INCIDENT_CATEGORY_LABELS[payload.incidentCategory] || payload.incidentCategory) : '';
    const secLabel = payload.securityNotified ? (SECURITY_NOTIFIED_LABELS[payload.securityNotified] || payload.securityNotified) : '';
    const incStatus = r.type === 'incident' ? (incMeta.status || payload.status || 'pending').toUpperCase() : '';

    const mediaList = r.media || [];
    const mediaUrls = mediaList.map((m) => m.url).filter(Boolean).join('; ');

    return [
      formatCSVCell(r.id),
      formatCSVCell(r.type.toUpperCase()),
      formatCSVCell(r.pollingUnitId),
      formatCSVCell(loc.state),
      formatCSVCell(loc.lga),
      formatCSVCell(loc.ward),
      formatCSVCell(payload.electionLevel || 'governorship'),
      formatCSVCell(times.utc),
      formatCSVCell(times.wat),
      formatCSVCell(r.observerId || 'Unassigned'),
      formatCSVCell(observer.displayName || 'Field Observer'),
      formatCSVCell(observer.email || 'N/A'),
      r.type === 'accreditation' ? formatCSVNumber(payload.voterCount ?? 0) : '""',
      formatCSVCell(bvasLabel),
      formatCSVCell(queueLabel),
      formatCSVCell(payload.severity ? payload.severity.toUpperCase() : ''),
      formatCSVCell(incCatLabel),
      formatCSVCell(secLabel),
      formatCSVCell(incStatus),
      r.type === 'result' ? formatCSVNumber(payload.apcVotes ?? 0) : '""',
      r.type === 'result' ? formatCSVNumber(payload.pdpVotes ?? 0) : '""',
      r.type === 'result' ? formatCSVNumber(payload.lpVotes ?? 0) : '""',
      r.type === 'result' ? formatCSVNumber(payload.nnppVotes ?? 0) : '""',
      r.type === 'result' ? formatCSVNumber(payload.otherVotes ?? 0) : '""',
      r.type === 'result' ? formatCSVNumber(payload.totalVotes ?? (payload.voterCount ?? 0)) : '""',
      formatCSVCell(payload.description || ''),
      formatCSVCell(r.location?.lat ?? ''),
      formatCSVCell(r.location?.lng ?? ''),
      formatCSVNumber(mediaList.length),
      formatCSVCell(mediaUrls)
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const timestampStr = format(new Date(), 'yyyyMMdd_HHmm');
  const filename = `${options.customFilenamePrefix || 'ivote_master_reports_dataset'}_${timestampStr}.csv`;

  triggerCSVDownload(filename, csvContent);
  return { count: filtered.length, filename };
}
