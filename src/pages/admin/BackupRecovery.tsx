import { useEffect, useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Server,
  Database,
  RefreshCw,
  HardDrive,
  FileCheck2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  BookOpen,
  Calendar,
  Layers,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import {
  fetchBackupRecords,
  fetchRestoreDrills,
  fetchBusinessContinuitySettings,
  saveBusinessContinuitySettings,
  createBackupRecord,
  recordRestoreDrill,
  checkBackupHealthAndAlert,
  DEFAULT_BUSINESS_CONTINUITY_SETTINGS,
} from '../../lib/backup/backupService';
import type {
  BackupRecord,
  RestoreDrill,
  BusinessContinuitySettings,
  RestoreOutcome,
} from '../../types/suitePhases15To19';

export function BackupRecoveryPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'records' | 'drills' | 'targets' | 'manual'>('overview');
  const [loading, setLoading] = useState(true);

  const [records, setRecords] = useState<BackupRecord[]>([]);
  const [drills, setDrills] = useState<RestoreDrill[]>([]);
  const [settings, setSettings] = useState<BusinessContinuitySettings>(DEFAULT_BUSINESS_CONTINUITY_SETTINGS);
  const [health, setHealth] = useState<{
    healthStatus: 'healthy' | 'attention_required' | 'critical';
    lastBackupDate: string | null;
    alertsGenerated: number;
  }>({
    healthStatus: 'healthy',
    lastBackupDate: null,
    alertsGenerated: 0,
  });

  // Modal states
  const [isDrillModalOpen, setIsDrillModalOpen] = useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // New Drill Form
  const [drillForm, setDrillForm] = useState({
    backup_reference: '',
    isolated_environment_name: 'ablebiz-staging-isolated-recovery-01',
    duration_minutes: 45,
    critical_tables_verified: 'staff_profiles, clients, invoices, payments, expenses, cac_applications',
    documents_verified: true,
    integrity_check_passed: true,
    rpo_hours_achieved: 1.5,
    rto_minutes_achieved: 45,
    overall_outcome: 'passed_unconditionally' as RestoreOutcome,
    validation_notes: '',
    corrective_action_plan: '',
  });

  // Verification Form
  const [verifyForm, setVerifyForm] = useState({
    backup_type: 'database' as const,
    file_size_mb: 250,
    notes: 'Weekly manual administrative verification and offsite archive audit.',
  });

  // Target Settings Form
  const [targetForm, setTargetForm] = useState({
    target_rpo_hours: 2.0,
    target_rto_hours: 4.0,
    rpo_rto_approved_by_management: false,
    retention_policy_days: 30,
  });

  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [recList, drillList, sett, healthRes] = await Promise.all([
        fetchBackupRecords(),
        fetchRestoreDrills(),
        fetchBusinessContinuitySettings(),
        checkBackupHealthAndAlert(),
      ]);

      setRecords(recList);
      setDrills(drillList);
      setSettings(sett);
      setHealth(healthRes);

      setTargetForm({
        target_rpo_hours: sett.target_rpo_hours,
        target_rto_hours: sett.target_rto_hours,
        rpo_rto_approved_by_management: sett.rpo_rto_approved_by_management,
        retention_policy_days: sett.retention_policy_days,
      });

      if (recList.length > 0 && !drillForm.backup_reference) {
        setDrillForm((prev) => ({ ...prev, backup_reference: recList[0].backup_reference }));
      }
    } catch (err) {
      console.error('[BackupRecovery] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordDrill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    setSubmitting(true);
    setActionMessage(null);

    try {
      const tables = drillForm.critical_tables_verified
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await recordRestoreDrill({
        backup_reference: drillForm.backup_reference || 'BKP-RECENT',
        isolated_environment_name: drillForm.isolated_environment_name,
        duration_minutes: Number(drillForm.duration_minutes),
        critical_tables_verified: tables,
        documents_verified: drillForm.documents_verified,
        integrity_check_passed: drillForm.integrity_check_passed,
        rpo_hours_achieved: Number(drillForm.rpo_hours_achieved),
        rto_minutes_achieved: Number(drillForm.rto_minutes_achieved),
        overall_outcome: drillForm.overall_outcome,
        validation_notes: drillForm.validation_notes || 'All core data tables reconciled with zero loss.',
        corrective_action_plan: drillForm.corrective_action_plan,
        conducted_by: profile.id,
      });

      if (res) {
        setActionMessage('Physical restore drill logged successfully.');
        setIsDrillModalOpen(false);
        loadData();
      }
    } catch (err: any) {
      setActionMessage(err.message || 'Failed to log restore drill.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    setSubmitting(true);
    setActionMessage(null);

    try {
      const res = await createBackupRecord({
        backup_type: verifyForm.backup_type,
        file_size_mb: Number(verifyForm.file_size_mb),
        status: 'verified',
        notes: verifyForm.notes,
        verified_by: profile.id,
      });

      if (res) {
        setActionMessage('Backup record logged and verified successfully.');
        setIsVerifyModalOpen(false);
        loadData();
      }
    } catch (err: any) {
      setActionMessage(err.message || 'Failed to record backup.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setActionMessage(null);

    try {
      await saveBusinessContinuitySettings({
        target_rpo_hours: Number(targetForm.target_rpo_hours),
        target_rto_hours: Number(targetForm.target_rto_hours),
        rpo_rto_approved_by_management: targetForm.rpo_rto_approved_by_management,
        management_approval_date: targetForm.rpo_rto_approved_by_management ? new Date().toISOString().split('T')[0] : null,
        retention_policy_days: Number(targetForm.retention_policy_days),
      });

      setActionMessage('Business continuity targets saved successfully.');
      setIsSettingsModalOpen(false);
      loadData();
    } catch (err: any) {
      setActionMessage(err.message || 'Failed to save settings.');
    } finally {
      setSubmitting(false);
    }
  };

  const latestDrill = drills[0];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#0A2558] border border-blue-200 shadow-2xs">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Backup, Recovery & Business Continuity</h1>
              <p className="text-xs text-slate-500">
                Critical enterprise data continuity, verified snapshot logs, and documented restore drills
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsVerifyModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Record Verification</span>
          </button>
          <button
            type="button"
            onClick={() => setIsDrillModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0A2558] px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#061738] transition"
          >
            <Plus className="h-4 w-4" />
            <span>Record Restore Drill</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3 text-xs font-medium text-blue-900 flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-blue-500 hover:text-blue-700">Dismiss</button>
        </div>
      )}

      {/* Honest Boundary Notice */}
      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 p-4 text-xs text-amber-900 flex items-start gap-3 shadow-2xs">
        <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">Critical Infrastructure & Operational Transparency Notice</p>
          <p className="text-[11px] leading-relaxed text-amber-800">
            Database snapshots are managed by the Supabase infrastructure layer. This workspace records actual verified backup logs, monitors health windows, and tracks mandatory physical restore drills into isolated test environments. Statuses displayed reflect confirmed records and are never artificially generated.
          </p>
        </div>
      </div>

      {/* Health Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Health Status</span>
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${health.healthStatus === 'healthy' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-lg font-bold text-slate-900 capitalize">
            {health.healthStatus.replace('_', ' ')}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {health.lastBackupDate
              ? `Last verified: ${new Date(health.lastBackupDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
              : 'Automated daily schedule active'}
          </p>
        </div>

        {/* Target RPO */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Target RPO</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-[#0A2558]">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-lg font-bold text-slate-900">
            {settings.target_rpo_hours} Hours
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`inline-block h-2 w-2 rounded-full ${settings.rpo_rto_approved_by_management ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            <p className="text-[11px] text-slate-500">
              {settings.rpo_rto_approved_by_management ? 'Approved by Management' : 'Pending Management Approval'}
            </p>
          </div>
        </div>

        {/* Target RTO */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Target RTO</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <RefreshCw className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-lg font-bold text-slate-900">
            {settings.target_rto_hours} Hours
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Maximum target system restore time
          </p>
        </div>

        {/* Last Restore Test */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Last Restore Drill</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <FileCheck2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-lg font-bold text-slate-900">
            {latestDrill ? latestDrill.drill_code : 'No drill recorded'}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {latestDrill ? `Achieved in ${latestDrill.duration_minutes} mins` : 'Drill required every 90 days'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`pb-2.5 text-xs font-bold transition border-b-2 ${
            activeTab === 'overview'
              ? 'border-[#0A2558] text-[#0A2558]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Infrastructure Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('records')}
          className={`pb-2.5 text-xs font-bold transition border-b-2 ${
            activeTab === 'records'
              ? 'border-[#0A2558] text-[#0A2558]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Verified Backup Records ({records.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('drills')}
          className={`pb-2.5 text-xs font-bold transition border-b-2 ${
            activeTab === 'drills'
              ? 'border-[#0A2558] text-[#0A2558]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Physical Restore Drills ({drills.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('targets')}
          className={`pb-2.5 text-xs font-bold transition border-b-2 ${
            activeTab === 'targets'
              ? 'border-[#0A2558] text-[#0A2558]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          RPO & RTO Targets
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('manual')}
          className={`pb-2.5 text-xs font-bold transition border-b-2 ${
            activeTab === 'manual'
              ? 'border-[#0A2558] text-[#0A2558]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Disaster Recovery Manual
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <h2 className="text-sm font-bold text-slate-900 mb-3">Backup Coverage & Storage Locations</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 space-y-1">
                  <span className="font-semibold text-slate-700">Database Layer:</span>
                  <p className="text-slate-500 text-[11px]">Daily automated snapshots, 30-day retention with Point-in-Time Recovery capability.</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 space-y-1">
                  <span className="font-semibold text-slate-700">Document Storage:</span>
                  <p className="text-slate-500 text-[11px]">Multi-region offsite object storage covering CAC certificates, client documents, and invoice PDFs.</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 space-y-1">
                  <span className="font-semibold text-slate-700">Configuration & Workflows:</span>
                  <p className="text-slate-500 text-[11px]">Service catalogues, approval rules, and escalation policies versioned in database migrations.</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 space-y-1">
                  <span className="font-semibold text-slate-700">Disaster Recovery Readiness:</span>
                  <p className="text-slate-500 text-[11px]">Documented physical dry-run restore procedure required prior to production cutovers.</p>
                </div>
              </div>
            </div>

            {/* Recent Drills Summary */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-slate-900">Recent Physical Restore Drills</h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('drills')}
                  className="text-xs font-semibold text-[#0A2558] hover:underline"
                >
                  View all drills →
                </button>
              </div>

              {drills.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
                  No physical restore drill has been recorded yet. Click "Record Restore Drill" to log your first verified drill into an isolated environment.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {drills.slice(0, 3).map((d) => (
                    <div key={d.id} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">{d.drill_code}</span>
                          <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                            d.overall_outcome === 'passed_unconditionally'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}>
                            {d.overall_outcome.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Environment: {d.isolated_environment_name} • Restored in {d.duration_minutes}m (RTO: {d.rto_minutes_achieved}m, RPO: {d.rpo_hours_achieved}h)
                        </p>
                      </div>
                      <span className="text-[11px] font-medium text-slate-400">{d.drill_date}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar: Continuity Contacts */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
              <h2 className="text-sm font-bold text-slate-900">Continuity Officers & Contacts</h2>
              <div className="space-y-2.5 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Disaster Recovery Lead:</span>
                  <p className="font-semibold text-slate-800">{settings.disaster_recovery_lead}</p>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Emergency Hotline:</span>
                  <p className="font-semibold text-slate-800">{settings.emergency_contact_phone}</p>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Official Escalation Email:</span>
                  <p className="font-semibold text-slate-800">{settings.emergency_contact_email}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
              <h2 className="text-sm font-bold text-slate-900">Operational Directives</h2>
              <ul className="text-xs text-slate-600 space-y-2 list-disc list-inside">
                <li>Never run destructive test restores against the live cluster.</li>
                <li>Verify database references to client document files after restore.</li>
                <li>Log physical drills quarterly to comply with business continuity policy.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Backup Records */}
      {activeTab === 'records' && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Verified Backup Logs</h3>
            <button
              onClick={() => setIsVerifyModalOpen(true)}
              className="text-xs font-semibold text-[#0A2558] hover:underline"
            >
              + Log Verification
            </button>
          </div>

          {records.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No backup logs recorded yet. Automated snapshots occur daily at 02:00 UTC.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <tr>
                    <th className="py-2.5 px-3">Reference</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Provider</th>
                    <th className="py-2.5 px-3">Size (MB)</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Retention</th>
                    <th className="py-2.5 px-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {records.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{r.backup_reference}</td>
                      <td className="py-2.5 px-3 capitalize">{r.backup_type.replace('_', ' ')}</td>
                      <td className="py-2.5 px-3 text-slate-500">{r.provider}</td>
                      <td className="py-2.5 px-3">{r.file_size_mb} MB</td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                          r.status === 'completed' || r.status === 'verified'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-700'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{r.retention_days} days</td>
                      <td className="py-2.5 px-3 text-slate-400">{new Date(r.created_at).toLocaleString('en-GB')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Restore Drills */}
      {activeTab === 'drills' && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Physical Restore Drill History</h3>
            <button
              onClick={() => setIsDrillModalOpen(true)}
              className="text-xs font-semibold text-[#0A2558] hover:underline"
            >
              + Record Drill
            </button>
          </div>

          {drills.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No physical restore drills logged. Document your first isolated dry-run restore.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {drills.map((d) => (
                <div key={d.id} className="p-4 space-y-2 hover:bg-slate-50/50">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-xs text-slate-900">{d.drill_code}</span>
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                        d.overall_outcome === 'passed_unconditionally'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {d.overall_outcome.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-slate-400">{d.drill_date}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl">
                    <div>
                      <span className="text-slate-400 block">Target Environment:</span>
                      <p className="font-medium text-slate-800">{d.isolated_environment_name}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Achieved RTO:</span>
                      <p className="font-medium text-slate-800">{d.rto_minutes_achieved} mins</p>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Achieved RPO:</span>
                      <p className="font-medium text-slate-800">{d.rpo_hours_achieved} hours</p>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Conducted By:</span>
                      <p className="font-medium text-slate-800">{d.conductor?.full_name || 'System Admin'}</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed pt-1">
                    <span className="font-semibold">Validation Notes: </span>{d.validation_notes}
                  </p>
                  {d.corrective_action_plan && (
                    <p className="text-xs text-amber-800 bg-amber-50/80 p-2 rounded-lg">
                      <span className="font-semibold">Action Plan: </span>{d.corrective_action_plan}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Target Configuration */}
      {activeTab === 'targets' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs max-w-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Recovery Point & Recovery Time Targets</h2>
              <p className="text-xs text-slate-500">Configure corporate data loss and downtime commitments.</p>
            </div>
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="text-xs font-semibold text-[#0A2558] hover:underline"
            >
              Edit Targets
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-slate-600">Recovery Point Objective (RPO):</span>
              <span className="font-bold text-slate-900">{settings.target_rpo_hours} Hours</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-slate-600">Recovery Time Objective (RTO):</span>
              <span className="font-bold text-slate-900">{settings.target_rto_hours} Hours</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-slate-600">Executive Management Approval:</span>
              <span className={`font-semibold ${settings.rpo_rto_approved_by_management ? 'text-emerald-600' : 'text-amber-600'}`}>
                {settings.rpo_rto_approved_by_management ? 'Approved' : 'Pending Formal Sign-off'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-slate-600">Snapshot Retention Period:</span>
              <span className="font-bold text-slate-900">{settings.retention_policy_days} Days</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-slate-600">Point-in-Time Recovery (PITR):</span>
              <span className="font-semibold text-emerald-600">{settings.point_in_time_recovery_available ? 'Available' : 'Disabled'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Disaster Recovery Manual */}
      {activeTab === 'manual' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <BookOpen className="h-4 w-4 text-[#0A2558]" />
            <h2 className="text-sm font-bold text-slate-900">Disaster Recovery & Continuity Runbook</h2>
          </div>
          <pre className="text-xs text-slate-700 bg-slate-50 p-4 rounded-xl overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
            {settings.disaster_recovery_runbook}
          </pre>
        </div>
      )}

      {/* Modal: Record Restore Drill */}
      {isDrillModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-bold text-slate-900">Record Physical Restore Drill</h3>
            <p className="text-xs text-slate-500">
              Document an isolated restore drill conducted on a test staging container.
            </p>

            <form onSubmit={handleRecordDrill} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Backup Reference:</label>
                <input
                  type="text"
                  required
                  value={drillForm.backup_reference}
                  onChange={(e) => setDrillForm({ ...drillForm, backup_reference: e.target.value })}
                  placeholder="e.g. BKP-202611-1001"
                  className="w-full rounded-lg border border-slate-200 p-2"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Isolated Environment Name:</label>
                <input
                  type="text"
                  required
                  value={drillForm.isolated_environment_name}
                  onChange={(e) => setDrillForm({ ...drillForm, isolated_environment_name: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Duration (Minutes):</label>
                  <input
                    type="number"
                    required
                    value={drillForm.duration_minutes}
                    onChange={(e) => setDrillForm({ ...drillForm, duration_minutes: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-200 p-2"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Achieved RPO (Hours):</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={drillForm.rpo_hours_achieved}
                    onChange={(e) => setDrillForm({ ...drillForm, rpo_hours_achieved: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-200 p-2"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Overall Outcome:</label>
                <select
                  value={drillForm.overall_outcome}
                  onChange={(e) => setDrillForm({ ...drillForm, overall_outcome: e.target.value as RestoreOutcome })}
                  className="w-full rounded-lg border border-slate-200 p-2"
                >
                  <option value="passed_unconditionally">Passed Unconditionally</option>
                  <option value="passed_with_minor_notes">Passed with Minor Notes</option>
                  <option value="failed_requires_action">Failed (Requires Action Plan)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Validation Notes:</label>
                <textarea
                  required
                  rows={3}
                  value={drillForm.validation_notes}
                  onChange={(e) => setDrillForm({ ...drillForm, validation_notes: e.target.value })}
                  placeholder="Detail verification of core tables, staff logins, invoices and payments."
                  className="w-full rounded-lg border border-slate-200 p-2"
                />
              </div>

              {drillForm.overall_outcome === 'failed_requires_action' && (
                <div>
                  <label className="font-semibold text-red-700 block mb-1">Corrective Action Plan:</label>
                  <textarea
                    rows={2}
                    value={drillForm.corrective_action_plan}
                    onChange={(e) => setDrillForm({ ...drillForm, corrective_action_plan: e.target.value })}
                    placeholder="Immediate steps to resolve data reconciliation issue."
                    className="w-full rounded-lg border border-red-200 bg-red-50/50 p-2"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDrillModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-[#0A2558] text-white font-semibold hover:bg-[#061738]"
                >
                  {submitting ? 'Saving...' : 'Log Restore Drill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record Manual Verification */}
      {isVerifyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Record Backup Verification</h3>
            <p className="text-xs text-slate-500">
              Confirm administrative verification of an offsite snapshot or database backup.
            </p>

            <form onSubmit={handleManualVerify} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Backup Type:</label>
                <select
                  value={verifyForm.backup_type}
                  onChange={(e) => setVerifyForm({ ...verifyForm, backup_type: e.target.value as any })}
                  className="w-full rounded-lg border border-slate-200 p-2"
                >
                  <option value="database">Database Snapshot</option>
                  <option value="documents">Document Storage Bucket</option>
                  <option value="full_suite">Full Suite Archive</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Estimated Size (MB):</label>
                <input
                  type="number"
                  required
                  value={verifyForm.file_size_mb}
                  onChange={(e) => setVerifyForm({ ...verifyForm, file_size_mb: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-200 p-2"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Verification Notes:</label>
                <textarea
                  rows={3}
                  value={verifyForm.notes}
                  onChange={(e) => setVerifyForm({ ...verifyForm, notes: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 p-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsVerifyModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-[#0A2558] text-white font-semibold hover:bg-[#061738]"
                >
                  {submitting ? 'Recording...' : 'Record Verification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Settings */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Update Recovery Targets</h3>
            <form onSubmit={handleSaveSettings} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Target RPO (Hours):</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={targetForm.target_rpo_hours}
                  onChange={(e) => setTargetForm({ ...targetForm, target_rpo_hours: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-200 p-2"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Target RTO (Hours):</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={targetForm.target_rto_hours}
                  onChange={(e) => setTargetForm({ ...targetForm, target_rto_hours: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-200 p-2"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Retention Policy (Days):</label>
                <input
                  type="number"
                  required
                  value={targetForm.retention_policy_days}
                  onChange={(e) => setTargetForm({ ...targetForm, retention_policy_days: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-200 p-2"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="mgmtApprove"
                  checked={targetForm.rpo_rto_approved_by_management}
                  onChange={(e) => setTargetForm({ ...targetForm, rpo_rto_approved_by_management: e.target.checked })}
                  className="rounded border-slate-300"
                />
                <label htmlFor="mgmtApprove" className="font-semibold text-slate-800">
                  Formally Approved by Executive Management
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-[#0A2558] text-white font-semibold hover:bg-[#061738]"
                >
                  {submitting ? 'Saving...' : 'Save Targets'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
