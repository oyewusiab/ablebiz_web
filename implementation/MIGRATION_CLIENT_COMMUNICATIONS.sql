-- ============================================================================
-- ABLEBIZ SUITE — CLIENT COMMUNICATION & ENGAGEMENT WORKSPACE MIGRATION
-- File: implementation/MIGRATION_CLIENT_COMMUNICATIONS.sql
-- Safe, idempotent, non-destructive schema expansion for:
--   1. public.communication_templates (Prepared Message Library)
--   2. public.communications (Extended Client Communication History & Statuses)
--   3. public.clients (Contact quality & WhatsApp/Contact Person fields)
--   4. Row-Level Security (RLS) across all 8 canonical staff roles
--   5. Trigger preventing hard-deletion of templates used in history
-- ============================================================================

BEGIN;

-- 1. Expand public.clients with contact quality & WhatsApp fields
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT,
  ADD COLUMN IF NOT EXISTS contact_person TEXT,
  ADD COLUMN IF NOT EXISTS contact_verified BOOLEAN DEFAULT false;

-- 2. Create public.communication_templates
CREATE TABLE IF NOT EXISTS public.communication_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (
    category IN (
      'welcome_onboarding',
      'registration_updates',
      'approval_congratulations',
      'document_delivery',
      'information_document_requests',
      'service_progress_updates',
      'payment_invoice_notifications',
      'feedback_reviews',
      'referral_requests',
      'followup_reminders',
      'service_completion',
      'general_communication'
    )
  ),
  description TEXT NOT NULL DEFAULT '',
  default_channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (
    default_channel IN ('whatsapp', 'phone_call', 'email', 'in_person', 'sms')
  ),
  supported_channels TEXT[] NOT NULL DEFAULT ARRAY['whatsapp', 'email']::TEXT[],
  subject TEXT,
  body TEXT NOT NULL,
  supported_variables TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system_seed BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
  created_by_name TEXT NOT NULL DEFAULT 'ABLEBIZ System',
  allowed_roles TEXT[] NOT NULL DEFAULT ARRAY[
    'super_admin',
    'admin',
    'operations_manager',
    'registration_officer',
    'accounts_officer',
    'client_service_officer',
    'marketing_officer'
  ]::TEXT[],
  workflow_contexts TEXT[] NOT NULL DEFAULT ARRAY['client_360', 'general']::TEXT[],
  is_default_for_workflow TEXT,
  verification_guard TEXT CHECK (
    verification_guard IS NULL OR verification_guard IN ('cac_approved', 'cac_submitted', 'payment_verified')
  ),
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Non-destructively expand public.communications
ALTER TABLE public.communications
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cac_application_id UUID REFERENCES public.cac_applications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS template_id TEXT,
  ADD COLUMN IF NOT EXISTS template_name TEXT,
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS message_body TEXT,
  ADD COLUMN IF NOT EXISTS html_body TEXT,
  ADD COLUMN IF NOT EXISTS recipient_name TEXT,
  ADD COLUMN IF NOT EXISTS recipient_phone TEXT,
  ADD COLUMN IF NOT EXISTS recipient_email TEXT,
  ADD COLUMN IF NOT EXISTS cc_emails TEXT[],
  ADD COLUMN IF NOT EXISTS sender_name TEXT DEFAULT 'ABLEBIZ BUSINESS SERVICES',
  ADD COLUMN IF NOT EXISTS sender_email TEXT DEFAULT 'hello@ablebiz.com.ng',
  ADD COLUMN IF NOT EXISTS reply_to_email TEXT DEFAULT 'hello@ablebiz.com.ng',
  ADD COLUMN IF NOT EXISTS provider_name TEXT,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS outcome_notes TEXT,
  ADD COLUMN IF NOT EXISTS client_response TEXT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Allow communications for leads that are not yet converted to clients
ALTER TABLE public.communications
  ALTER COLUMN client_id DROP NOT NULL;

-- Create indexes for fast lookup in Client 360, Service Requests, CAC Operations, and Finance
CREATE INDEX IF NOT EXISTS idx_communications_client_id ON public.communications(client_id);
CREATE INDEX IF NOT EXISTS idx_communications_service_request_id ON public.communications(service_request_id);
CREATE INDEX IF NOT EXISTS idx_communications_cac_application_id ON public.communications(cac_application_id);
CREATE INDEX IF NOT EXISTS idx_communications_invoice_id ON public.communications(invoice_id);
CREATE INDEX IF NOT EXISTS idx_communications_lead_id ON public.communications(lead_id);
CREATE INDEX IF NOT EXISTS idx_communications_created_at ON public.communications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_communication_templates_category ON public.communication_templates(category);

-- 4. Trigger to block hard-deletion of system seed templates or templates used in communication history
CREATE OR REPLACE FUNCTION public.prevent_used_communication_template_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.is_system_seed = true OR OLD.usage_count > 0 THEN
    RAISE EXCEPTION 'Cannot permanently delete a system template or a template used in communication history. Deactivate it instead (set is_active = false).';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.communications
    WHERE template_id = OLD.id::TEXT OR template_id = OLD.slug
  ) THEN
    RAISE EXCEPTION 'Cannot permanently delete a template referenced in client communication history. Deactivate it instead.';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_used_template_delete ON public.communication_templates;
CREATE TRIGGER trg_prevent_used_template_delete
  BEFORE DELETE ON public.communication_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_used_communication_template_delete();

-- 5. Enable RLS & define least-privilege policies for communication_templates and communications
ALTER TABLE public.communication_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comm_templates_select_active_staff" ON public.communication_templates;
CREATE POLICY "comm_templates_select_active_staff"
  ON public.communication_templates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_profiles sp
      WHERE sp.id = auth.uid() AND sp.is_active = true
    )
  );

DROP POLICY IF EXISTS "comm_templates_manage_authorized_roles" ON public.communication_templates;
CREATE POLICY "comm_templates_manage_authorized_roles"
  ON public.communication_templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_profiles sp
      WHERE sp.id = auth.uid()
        AND sp.is_active = true
        AND sp.role IN ('super_admin', 'admin', 'operations_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff_profiles sp
      WHERE sp.id = auth.uid()
        AND sp.is_active = true
        AND sp.role IN ('super_admin', 'admin', 'operations_manager')
    )
  );

DROP POLICY IF EXISTS "communications_select_active_staff" ON public.communications;
CREATE POLICY "communications_select_active_staff"
  ON public.communications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_profiles sp
      WHERE sp.id = auth.uid() AND sp.is_active = true
    )
  );

DROP POLICY IF EXISTS "communications_insert_operational_staff" ON public.communications;
CREATE POLICY "communications_insert_operational_staff"
  ON public.communications
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff_profiles sp
      WHERE sp.id = auth.uid()
        AND sp.is_active = true
        AND sp.role IN (
          'super_admin',
          'admin',
          'operations_manager',
          'registration_officer',
          'accounts_officer',
          'client_service_officer',
          'marketing_officer'
        )
    )
  );

DROP POLICY IF EXISTS "communications_update_operational_staff" ON public.communications;
CREATE POLICY "communications_update_operational_staff"
  ON public.communications
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_profiles sp
      WHERE sp.id = auth.uid()
        AND sp.is_active = true
        AND sp.role IN (
          'super_admin',
          'admin',
          'operations_manager',
          'registration_officer',
          'accounts_officer',
          'client_service_officer',
          'marketing_officer'
        )
    )
  );

COMMIT;
