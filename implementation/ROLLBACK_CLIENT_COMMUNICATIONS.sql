-- ============================================================================
-- ABLEBIZ SUITE — CLIENT COMMUNICATION & ENGAGEMENT WORKSPACE ROLLBACK
-- File: implementation/ROLLBACK_CLIENT_COMMUNICATIONS.sql
-- Safely removes newly added communication template objects while preserving
-- core existing communication logs.
-- ============================================================================

BEGIN;

DROP TRIGGER IF EXISTS trg_prevent_used_template_delete ON public.communication_templates;
DROP FUNCTION IF EXISTS public.prevent_used_communication_template_delete();

DROP POLICY IF EXISTS "comm_templates_select_active_staff" ON public.communication_templates;
DROP POLICY IF EXISTS "comm_templates_manage_authorized_roles" ON public.communication_templates;

DROP TABLE IF EXISTS public.communication_templates;

COMMIT;
