import { supabase, supabaseEnabled } from "./supabaseClient";

export interface ProvisionStaffPayload {
  action: "create_staff" | "reconcile_staff" | "approve_request" | "diagnostic" | "complete_password_change";
  email?: string;
  fullName?: string;
  role?: string;
  department?: string;
  phone?: string | null;
  requestId?: string;
  targetProfileId?: string;
}

export interface ProvisionStaffResponse {
  success: boolean;
  action: string;
  staff?: {
    id: string;
    auth_uid: string;
    email: string;
    full_name: string;
    role: string;
    department?: string;
    phone?: string | null;
    is_active: boolean;
    must_change_password?: boolean;
  };
  tempPassword?: string;
  error?: string;
  // Diagnostic fields
  authenticated?: boolean;
  callerUserId?: string;
  callerStaffProfileFound?: boolean;
  callerRole?: string;
  callerActive?: boolean;
  adminAuthClientAvailable?: boolean;
  functionVersion?: string;
}

/**
 * Invoke the authoritative server-side Edge Function: staff-provision
 * Uses the caller's active authenticated Super Admin JWT session.
 * Never exposes service_role or privileged secrets to the browser.
 */
export async function invokeStaffProvision(
  payload: ProvisionStaffPayload
): Promise<ProvisionStaffResponse> {
  if (!supabaseEnabled || !supabase) {
    throw new Error("Supabase client is not configured.");
  }

  // Invoke the live deployed Edge Function 'super-api', with fallback to 'staff-provision'
  let res = await supabase.functions.invoke("super-api", {
    body: payload,
  });

  if (res.error && (res.error.message?.includes("not found") || res.error.message?.includes("404"))) {
    res = await supabase.functions.invoke("staff-provision", {
      body: payload,
    });
  }

  const { data, error } = res;

  if (error) {
    // If Edge Function returned an HTTP error or function error message
    throw new Error(error.message || "Staff provisioning service call failed.");
  }

  if (!data?.success) {
    throw new Error(data?.error || "Staff provisioning operation unsuccessful.");
  }

  return data as ProvisionStaffResponse;
}
