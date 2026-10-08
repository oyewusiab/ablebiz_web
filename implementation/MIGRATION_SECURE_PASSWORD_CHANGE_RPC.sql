-- ==============================================================================
-- ABLEBIZ SUITE — SECURE FIRST-LOGIN PASSWORD CHANGE FLAG CLEARANCE RPC
-- File: implementation/MIGRATION_SECURE_PASSWORD_CHANGE_RPC.sql
-- Narrowly scoped SECURITY DEFINER function preventing broad RLS updates.
-- ==============================================================================

-- 1. Create or replace the narrowly scoped RPC function
create or replace function public.clear_own_password_change_flag()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_auth_uid uuid;
  v_staff_id uuid;
  v_staff_email text;
  v_staff_name text;
begin
  -- 1. Identify caller strictly from authenticated session
  v_caller_auth_uid := auth.uid();
  if v_caller_auth_uid is null then
    raise exception 'Unauthorized: Caller session is unauthenticated'
      using errcode = '42501';
  end if;

  -- 2. Locate staff profile associated with caller's auth_uid
  select id, email, full_name
  into v_staff_id, v_staff_email, v_staff_name
  from public.staff_profiles
  where auth_uid = v_caller_auth_uid;

  if v_staff_id is null then
    raise exception 'Forbidden: No staff profile linked to active authenticated identity'
      using errcode = '42501';
  end if;

  -- 3. Narrow update: ONLY clear must_change_password and bump updated_at
  update public.staff_profiles
  set must_change_password = false,
      updated_at = now()
  where id = v_staff_id;

  -- 4. Record audit events
  begin
    insert into public.audit_logs (
      staff_id,
      staff_email,
      action,
      entity_type,
      entity_id,
      old_values,
      new_values
    ) values (
      v_staff_id,
      v_staff_email,
      'staff_first_login_password_changed',
      'staff_profile',
      v_staff_id,
      jsonb_build_object('must_change_password', true),
      jsonb_build_object('must_change_password', false)
    );

    insert into public.activity_timeline (
      entity_type,
      entity_id,
      actor_type,
      actor_id,
      event_type,
      event_title,
      metadata
    ) values (
      'staff_profile',
      v_staff_id,
      'staff',
      v_staff_id,
      'password_changed',
      'First-login permanent password established for ' || coalesce(v_staff_name, v_staff_email),
      jsonb_build_object('status', 'completed')
    );
  exception when others then
    -- Do not fail password change if audit logging encounters a transient issue
    null;
  end;

  return jsonb_build_object(
    'success', true,
    'staff_id', v_staff_id,
    'must_change_password', false
  );
end;
$$;

-- 2. Strict Permission Hardening: Revoke from public/anon, grant only to authenticated
revoke all on function public.clear_own_password_change_flag() from public, anon;
grant execute on function public.clear_own_password_change_flag() to authenticated;
