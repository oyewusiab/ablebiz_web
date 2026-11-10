-- =============================================================================
-- ABLEBIZ SUITE — COMPREHENSIVE BI & EXECUTIVE REPORTING EXPANSION MIGRATION
-- File: implementation/MIGRATION_BI_REPORTING_EXPANSION.sql
-- Idempotent, safe to run multiple times in Supabase SQL Editor.
-- =============================================================================

BEGIN;

-- 1. Ensure all 8 canonical roles have scoped access to the `reports` module
--    in `public.roles_permissions` (per-report & per-scope security is enforced
--    by RLS on underlying tables and canonical RBAC in reportPermissions.ts).
INSERT INTO public.roles_permissions (
  role,
  module,
  can_view,
  can_create,
  can_edit,
  can_delete,
  can_approve,
  can_export
)
VALUES
  ('super_admin',            'reports', true, true, true, true, true, true),
  ('admin',                  'reports', true, true, true, false, true, true),
  ('operations_manager',     'reports', true, true, false, false, false, true),
  ('registration_officer',   'reports', true, false, false, false, false, false),
  ('accounts_officer',       'reports', true, true, false, false, false, true),
  ('client_service_officer', 'reports', true, false, false, false, false, false),
  ('marketing_officer',      'reports', true, true, false, false, false, true),
  ('viewer',                 'reports', true, false, false, false, false, false)
ON CONFLICT (role, module)
DO UPDATE SET
  can_view = EXCLUDED.can_view,
  can_create = EXCLUDED.can_create,
  can_edit = EXCLUDED.can_edit,
  can_delete = EXCLUDED.can_delete,
  can_approve = EXCLUDED.can_approve,
  can_export = EXCLUDED.can_export;

-- 2. Saved Report Configurations & Favourites Table
CREATE TABLE IF NOT EXISTS public.report_saved_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  report_id TEXT NOT NULL,
  category TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_favourite BOOLEAN NOT NULL DEFAULT false,
  created_by_staff_id UUID REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
  created_by_name TEXT NOT NULL DEFAULT 'Staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.report_saved_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "report_saved_configs_select_own_or_admin" ON public.report_saved_configs;
CREATE POLICY "report_saved_configs_select_own_or_admin"
  ON public.report_saved_configs
  FOR SELECT
  TO authenticated
  USING (
    created_by_staff_id IN (
      SELECT id FROM public.staff_profiles WHERE auth_uid = auth.uid() AND is_active = true
    )
    OR public.current_staff_role() IN ('super_admin', 'admin')
  );

DROP POLICY IF EXISTS "report_saved_configs_manage_own" ON public.report_saved_configs;
CREATE POLICY "report_saved_configs_manage_own"
  ON public.report_saved_configs
  FOR ALL
  TO authenticated
  USING (
    created_by_staff_id IN (
      SELECT id FROM public.staff_profiles WHERE auth_uid = auth.uid() AND is_active = true
    )
    OR public.current_staff_role() IN ('super_admin', 'admin')
  )
  WITH CHECK (
    created_by_staff_id IN (
      SELECT id FROM public.staff_profiles WHERE auth_uid = auth.uid() AND is_active = true
    )
    OR public.current_staff_role() IN ('super_admin', 'admin')
  );

-- 3. Report Execution & Export History Table
CREATE TABLE IF NOT EXISTS public.report_execution_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id TEXT NOT NULL,
  report_title TEXT NOT NULL,
  category TEXT NOT NULL,
  generated_by_staff_id UUID REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
  generated_by_name TEXT NOT NULL DEFAULT 'Staff',
  generated_by_role TEXT NOT NULL DEFAULT 'viewer',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reporting_period_label TEXT NOT NULL DEFAULT '',
  filters_applied JSONB NOT NULL DEFAULT '{}'::jsonb,
  scope_applied TEXT NOT NULL DEFAULT 'personal',
  output_format TEXT NOT NULL DEFAULT 'preview',
  record_count INTEGER NOT NULL DEFAULT 0,
  document_number TEXT NOT NULL DEFAULT ''
);

ALTER TABLE public.report_execution_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "report_execution_history_select_scoped" ON public.report_execution_history;
CREATE POLICY "report_execution_history_select_scoped"
  ON public.report_execution_history
  FOR SELECT
  TO authenticated
  USING (
    generated_by_staff_id IN (
      SELECT id FROM public.staff_profiles WHERE auth_uid = auth.uid() AND is_active = true
    )
    OR public.current_staff_role() IN ('super_admin', 'admin')
  );

DROP POLICY IF EXISTS "report_execution_history_insert_own" ON public.report_execution_history;
CREATE POLICY "report_execution_history_insert_own"
  ON public.report_execution_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    generated_by_staff_id IN (
      SELECT id FROM public.staff_profiles WHERE auth_uid = auth.uid() AND is_active = true
    )
    OR public.current_staff_role() IN ('super_admin', 'admin')
  );

-- 4. Scheduled Report Configurations Table
CREATE TABLE IF NOT EXISTS public.report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id TEXT NOT NULL,
  report_title TEXT NOT NULL,
  category TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly')),
  output_format TEXT NOT NULL CHECK (output_format IN ('pdf', 'xlsx', 'csv')),
  recipient_staff_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  recipient_names JSONB NOT NULL DEFAULT '[]'::jsonb,
  scope_applied TEXT NOT NULL DEFAULT 'organisation',
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT CHECK (last_run_status IN ('success', 'failed', 'pending')),
  last_failure_reason TEXT,
  created_by_staff_id UUID REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
  created_by_name TEXT NOT NULL DEFAULT 'Staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "report_schedules_select_authorized" ON public.report_schedules;
CREATE POLICY "report_schedules_select_authorized"
  ON public.report_schedules
  FOR SELECT
  TO authenticated
  USING (
    created_by_staff_id IN (
      SELECT id FROM public.staff_profiles WHERE auth_uid = auth.uid() AND is_active = true
    )
    OR public.current_staff_role() IN ('super_admin', 'admin', 'operations_manager', 'accounts_officer', 'marketing_officer')
  );

DROP POLICY IF EXISTS "report_schedules_manage_authorized" ON public.report_schedules;
CREATE POLICY "report_schedules_manage_authorized"
  ON public.report_schedules
  FOR ALL
  TO authenticated
  USING (
    public.current_staff_role() IN ('super_admin', 'admin', 'operations_manager', 'accounts_officer', 'marketing_officer')
  )
  WITH CHECK (
    public.current_staff_role() IN ('super_admin', 'admin', 'operations_manager', 'accounts_officer', 'marketing_officer')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.report_saved_configs,
  public.report_execution_history,
  public.report_schedules
TO authenticated;

-- 5. Performance Indexes for Reporting Date Ranges & Status Aggregations
CREATE INDEX IF NOT EXISTS idx_report_saved_configs_staff ON public.report_saved_configs(created_by_staff_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_history_staff_date ON public.report_execution_history(generated_by_staff_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_schedules_active_next ON public.report_schedules(is_active, next_run_at);

CREATE INDEX IF NOT EXISTS idx_invoices_reporting_date_status ON public.invoices(issue_date, status);
CREATE INDEX IF NOT EXISTS idx_payments_reporting_date_verified ON public.payments(payment_date, is_verified);
CREATE INDEX IF NOT EXISTS idx_expenses_reporting_date_category ON public.expenses(expense_date, category);
CREATE INDEX IF NOT EXISTS idx_service_requests_reporting_status ON public.service_requests(created_at, status);
CREATE INDEX IF NOT EXISTS idx_cac_applications_reporting_stage ON public.cac_applications(created_at, current_stage);

-- Safe conditional indexes for leads, referral_events, and campaign_referral_payouts
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'qualification_status'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_leads_reporting_created_status ON public.leads(created_at, qualification_status);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'referral_events' AND column_name = 'verification_status'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_referral_events_reporting_verified ON public.referral_events(created_at, verification_status);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'campaign_referral_payouts'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_campaign_payouts_reporting_status ON public.campaign_referral_payouts(created_at, payment_status);
  END IF;
END $$;

COMMIT;
