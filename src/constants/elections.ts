import { ElectionScope } from '../types';

export const ELECTION_LEVEL_LABELS: Record<string, { label: string; short: string; color: string; bg: string }> = {
  governorship: {
    label: 'Gubernatorial (Governorship)',
    short: 'Governorship',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200'
  },
  general_federal: {
    label: '2027 General Election (Presidential, Senate & House of Reps)',
    short: 'Presidential & NASS (2027)',
    color: 'text-purple-700',
    bg: 'bg-purple-50 border-purple-200'
  },
  presidential: {
    label: 'Presidential Election',
    short: 'Presidential',
    color: 'text-purple-700',
    bg: 'bg-purple-50 border-purple-200'
  },
  senatorial: {
    label: 'Senatorial Election (Senate)',
    short: 'Senate',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200'
  },
  house_of_reps: {
    label: 'House of Representatives',
    short: 'House of Reps',
    color: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200'
  }
};

export const AVAILABLE_ELECTIONS: ElectionScope[] = [
  {
    id: 'osun-guber-offcycle',
    name: 'Osun State Off-Cycle Gubernatorial Election',
    level: 'governorship',
    state: 'Osun',
    year: 2026,
    isOffCycle: true,
    isActiveDefault: true,
    description: 'Off-cycle governorship election observation across all 30 LGAs in Osun State.'
  },
  {
    id: 'gen-2027-federal',
    name: '2027 General Election (Presidential, Senate & House of Reps)',
    level: 'general_federal',
    year: 2027,
    isOffCycle: false,
    isActiveDefault: false,
    description: 'Unified 2027 Federal General Election covering Presidential, Senatorial, and House of Representatives voting conducted concurrently.'
  },
  {
    id: 'gen-2027-gubernatorial-national',
    name: '2027 General Elections - State Governorships',
    level: 'governorship',
    year: 2027,
    isOffCycle: false,
    isActiveDefault: false,
    description: 'State governorship elections across participating states in the 2027 general cycle.'
  }
];

export const OSUN_STATE_LGAS = [
  'Atakunmosa East',
  'Atakunmosa West',
  'Aiyedaade',
  'Aiyedire',
  'Boluwaduro',
  'Boripe',
  'Ede North',
  'Ede South',
  'Egbedore',
  'Ejigbo',
  'Ife Central',
  'Ife East',
  'Ife North',
  'Ife South',
  'Ifedayo',
  'Ifelodun',
  'Ilesa East',
  'Ilesa West',
  'Irepodun',
  'Irewole',
  'Isokan',
  'Iwo',
  'Obokun',
  'Odo Otin',
  'Ola Oluwa',
  'Olorunda',
  'Oriade',
  'Orolu',
  'Osogbo'
];
