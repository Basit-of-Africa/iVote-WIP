import React, { useState } from 'react';
import { 
  FileCheck, 
  FileText, 
  AlertTriangle, 
  Layers, 
  CheckCircle2, 
  ArrowRight, 
  Download, 
  Camera, 
  Clock, 
  ShieldCheck, 
  Info,
  HelpCircle,
  Vote
} from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/common/PageHeader';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';
import { toast } from 'sonner';

interface ObserverFormItem {
  id: string;
  code: string;
  title: string;
  category: 'accreditation' | 'incident' | 'results' | 'logistics';
  description: string;
  mandatoryAttachments: string[];
  estimatedMinutes: number;
  reportTypeParam: string;
  guidelines: string[];
}

const OBSERVER_FORMS: ObserverFormItem[] = [
  {
    id: 'form-ec8a',
    code: 'INEC Form EC.8A',
    title: 'Polling Unit Official Result Tally & Collation Sheet',
    category: 'results',
    description: 'Final ballot counting record for Presidential/Gubernatorial tallies. Observers record votes cast per accredited political party and upload stamped EC.8A photo.',
    mandatoryAttachments: ['Signed EC.8A Sheet Photo', 'Presiding Officer Endorsement'],
    estimatedMinutes: 5,
    reportTypeParam: 'result',
    guidelines: [
      'Wait until all votes are counted aloud and sorted openly.',
      'Ensure the total votes cast does not exceed the total accredited voters on BVAS.',
      'Capture a clear, well-lit photograph showing the signature block.'
    ]
  },
  {
    id: 'form-bvas-audit',
    code: 'Form PU-AC1',
    title: 'Accreditation & BVAS Device Verification Audit',
    category: 'accreditation',
    description: 'Midday observation audit recording BVAS biometric matching rate, total accredited voters, device uptime, and queue management standards.',
    mandatoryAttachments: ['BVAS Screen Display Photo (Optional)'],
    estimatedMinutes: 3,
    reportTypeParam: 'accreditation',
    guidelines: [
      'Log accreditation metrics at 10:00 AM and 1:30 PM.',
      'Report any persistent device rebooting or fingerprint reader failures immediately.',
      'Record if manual voter register backup procedures were enacted.'
    ]
  },
  {
    id: 'form-incident-report',
    code: 'Form IR-01',
    title: 'Incident & Electoral Offense Report Form',
    category: 'incident',
    description: 'Rapid reporting tool for ballot snatching, vote buying, intimidation, polling station delays, security breaches, or logistical breakdowns.',
    mandatoryAttachments: ['GPS Location Stamp', 'Cryptographic Photo/Video Evidence'],
    estimatedMinutes: 2,
    reportTypeParam: 'incident',
    guidelines: [
      'Prioritize personal safety before taking photographs or recording.',
      'Include exact polling unit identifier and approximate time of event.',
      'Provide concise, objective facts without personal speculation.'
    ]
  },
  {
    id: 'form-logistics-opening',
    code: 'Form LG-01',
    title: 'Polling Station Opening & Materials Arrival Checklist',
    category: 'logistics',
    description: 'Early morning assessment verifying the arrival of INEC officials, security deployment, ballot box sealing, and opening promptness (8:30 AM).',
    mandatoryAttachments: ['Station Layout Photo'],
    estimatedMinutes: 3,
    reportTypeParam: 'accreditation',
    guidelines: [
      'Confirm the presence of at least 4 INEC ad-hoc officials.',
      'Verify that ballot boxes are transparent and shown empty before sealing.',
      'Record arrival time of armed/unarmed security personnel.'
    ]
  }
];

export default function Forms() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredForms = OBSERVER_FORMS.filter(form => {
    return selectedCategory === 'all' || form.category === selectedCategory;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageHeader
        title="Observer Forms & Protocols"
        description="Standardized observation questionnaires, legal checklists, and rapid data-entry forms for accredited field observers."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Forms' }
        ]}
        badge={{
          label: '4 Standardized Forms Active',
          variant: 'blue'
        }}
        actions={
          <Link
            to="/report"
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors min-h-[38px]"
          >
            <FileText className="w-4 h-4" />
            <span>Launch Blank Report</span>
          </Link>
        }
      />

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard
          title="Active Form Templates"
          value={OBSERVER_FORMS.length}
          subtitle="INEC standardized protocols"
          icon={FileCheck}
          colorScheme="indigo"
        />
        <StatCard
          title="Avg Completion Time"
          value="3.2 min"
          subtitle="Optimized for rapid mobile entry"
          icon={Clock}
          colorScheme="emerald"
        />
        <StatCard
          title="Offline Form Cache"
          value="Enabled"
          subtitle="All forms work without network"
          icon={ShieldCheck}
          colorScheme="blue"
        />
        <StatCard
          title="Data Integrity"
          value="SHA-256"
          subtitle="Cryptographic photo validation"
          icon={Vote}
          colorScheme="purple"
        />
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-gray-200">
        {[
          { id: 'all', label: 'All Forms' },
          { id: 'accreditation', label: 'Accreditation & BVAS' },
          { id: 'incident', label: 'Incidents & Offenses' },
          { id: 'results', label: 'Results & Collation (EC.8A)' },
          { id: 'logistics', label: 'Logistics & Opening' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSelectedCategory(tab.id)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 -mb-px whitespace-nowrap cursor-pointer ${
              selectedCategory === tab.id
                ? 'border-emerald-600 text-emerald-700 font-bold bg-emerald-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Forms Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredForms.map((form) => (
          <div
            key={form.id}
            className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs flex flex-col justify-between hover:border-gray-300 transition-all"
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                    {form.code}
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 font-serif mt-2">
                    {form.title}
                  </h3>
                </div>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
                  <FileText className="w-4 h-4" />
                </div>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed">
                {form.description}
              </p>

              <div className="bg-gray-50/80 rounded-xl p-3 border border-gray-100 space-y-2">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  Field Observer Guidelines
                </p>
                <ul className="text-xs text-gray-600 space-y-1">
                  {form.guidelines.map((guideline, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{guideline}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  ~{form.estimatedMinutes} min to fill
                </span>
                <span className="flex items-center gap-1">
                  <Camera className="w-3.5 h-3.5 text-gray-400" />
                  {form.mandatoryAttachments.length} attachments
                </span>
              </div>
            </div>

            <div className="pt-5 mt-5 border-t border-gray-100 flex items-center justify-between gap-3">
              <span className="text-[11px] text-gray-400 font-medium">
                Offline Auto-Sync Enabled
              </span>
              <Link
                to={`/report?type=${form.reportTypeParam}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
              >
                <span>Launch Form</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
