import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestPayload {
  action: "create_staff" | "reconcile_staff" | "approve_request";
  email?: string;
  fullName?: string;
  role?: string;
  department?: string;
  phone?: string | null;
  requestId?: string;
  targetProfileId?: string;
}

/**
 * Generate a cryptographically secure, high-entropy unique temporary password (14 characters).
 * Contains uppercase, lowercase, numbers, and symbols.
 * Never uses predictable or shared values like "Welcome1".
 */
function generateSecureTempPassword(): string {
  const lowercase = "abcdefghjkmnpqrstuvwxyz";
  const uppercase = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const numbers = "23456789";
  const symbols = "!@#$%&*";
  const allChars = lowercase + uppercase + numbers + symbols;

  const array = new Uint8Array(14);
  crypto.getRandomValues(array);

  const chars = [
    lowercase[array[0] % lowercase.length],
    uppercase[array[1] % uppercase.length],
    numbers[array[2] % numbers.length],
    symbols[array[3] % symbols.length],
  ];
  for (let i = 4; i < 14; i++) {
    chars.push(allChars[array[i] % allChars.length]);
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = array[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

serve(async (req: Request) => {
  // 1. Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      throw new Error("Server configuration error: Missing Supabase environment variables.");
    }

    // 2. Validate Caller Authentication (Bearer JWT)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: { user: callerUser }, error: callerAuthErr } = await callerClient.auth.getUser();
    if (callerAuthErr || !callerUser) {
      return new Response(
        JSON.stringify({ error: `Unauthorized caller session: ${callerAuthErr?.message || "Invalid token"}` }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Verify Caller is an Active Super Admin in staff_profiles
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: callerProfile, error: callerProfErr } = await adminClient
      .from("staff_profiles")
      .select("id, full_name, email, role, is_active")
      .eq("auth_uid", callerUser.id)
      .maybeSingle();

    if (callerProfErr || !callerProfile) {
      return new Response(
        JSON.stringify({ error: "Access Denied: Caller staff profile not found." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isSuperAdmin =
      callerProfile.is_active &&
      (callerProfile.role === "super_admin" || callerProfile.role === "managing_director");

    if (!isSuperAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Only active Super Admins can provision staff accounts." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Parse Request Body
    const body: RequestPayload = await req.json();
    const { action } = body;

    // Helper: Audit Logging
    const logAudit = async (actionName: string, entityId: string, oldVals: any, newVals: any, title: string) => {
      try {
        await Promise.all([
          adminClient.from("audit_logs").insert({
            staff_id: callerProfile.id,
            staff_email: callerProfile.email,
            action: actionName,
            entity_type: "staff_profile",
            entity_id: entityId,
            old_values: oldVals,
            new_values: newVals,
          }),
          adminClient.from("activity_timeline").insert({
            entity_type: "staff_profile",
            entity_id: entityId,
            actor_type: "staff",
            actor_id: callerProfile.id,
            event_type: actionName,
            event_title: title,
            metadata: newVals,
          }),
        ]);
      } catch (err) {
        console.warn("[EdgeFunction AuditLog] Warning:", err);
      }
    };

    // =========================================================================
    // ACTION A: RECONCILE EXISTING ORPHANED STAFF PROFILE
    // =========================================================================
    if (action === "reconcile_staff") {
      const targetProfileId = body.targetProfileId;
      const targetEmail = body.email?.trim().toLowerCase();

      let targetQuery = adminClient.from("staff_profiles").select("*");
      if (targetProfileId) {
        targetQuery = targetQuery.eq("id", targetProfileId);
      } else if (targetEmail) {
        targetQuery = targetQuery.eq("email", targetEmail);
      } else {
        return new Response(
          JSON.stringify({ error: "targetProfileId or email is required for reconciliation." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: targetProfile, error: targetErr } = await targetQuery.single();
      if (targetErr || !targetProfile) {
        return new Response(
          JSON.stringify({ error: "Target staff profile not found for reconciliation." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tempPassword = generateSecureTempPassword();
      let realAuthUid: string;

      // Check if auth user already exists in auth.users by attempting creation
      const { data: newAuthUser, error: createAuthErr } = await adminClient.auth.admin.createUser({
        email: targetProfile.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: targetProfile.full_name },
      });

      if (createAuthErr) {
        if (createAuthErr.message.toLowerCase().includes("already registered") || createAuthErr.message.toLowerCase().includes("already exists")) {
          // User already exists in Auth: Locate the user ID
          const { data: { users }, error: listErr } = await adminClient.auth.admin.listUsers();
          const existingUser = users?.find((u) => u.email?.toLowerCase() === targetProfile.email.toLowerCase());
          if (!existingUser) {
            throw new Error(`Auth account conflict: user exists but could not be located in Auth directory.`);
          }
          realAuthUid = existingUser.id;

          // Update their password to the newly issued temporary password & ensure email is confirmed
          const { error: updateAuthErr } = await adminClient.auth.admin.updateUserById(realAuthUid, {
            password: tempPassword,
            email_confirm: true,
          });
          if (updateAuthErr) {
            throw new Error(`Failed to reset credentials for existing Auth user: ${updateAuthErr.message}`);
          }
        } else {
          throw new Error(`Failed to provision Auth account: ${createAuthErr.message}`);
        }
      } else {
        realAuthUid = newAuthUser.user.id;
      }

      // Update staff_profiles with real auth_uid, auth_status = 'provisioned', and must_change_password = true
      const { data: updatedProfile, error: updateProfErr } = await adminClient
        .from("staff_profiles")
        .update({
          auth_uid: realAuthUid,
          auth_status: "provisioned",
          must_change_password: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetProfile.id)
        .select()
        .single();

      if (updateProfErr) {
        throw new Error(`Database error updating staff profile with auth_uid: ${updateProfErr.message}`);
      }

      await logAudit(
        "staff_auth_provisioned",
        targetProfile.id,
        { auth_uid: targetProfile.auth_uid, must_change_password: targetProfile.must_change_password },
        { auth_uid: realAuthUid, must_change_password: true, reconciled: true },
        `Staff account reconciled and Auth identity provisioned for ${targetProfile.full_name} (${targetProfile.email})`
      );

      return new Response(
        JSON.stringify({
          success: true,
          action: "reconcile_staff",
          staff: updatedProfile,
          tempPassword,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================================
    // ACTION B: CREATE STAFF DIRECTLY (SUPER ADMIN)
    // =========================================================================
    if (action === "create_staff") {
      const email = body.email?.trim().toLowerCase();
      const fullName = body.fullName?.trim();
      const role = body.role || "viewer";
      const department = body.department?.trim() || "Operations";
      const phone = body.phone?.trim() || null;

      if (!email || !fullName) {
        return new Response(
          JSON.stringify({ error: "Email and Full Name are required." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check for duplicate profile
      const { data: existingProfile } = await adminClient
        .from("staff_profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existingProfile) {
        return new Response(
          JSON.stringify({ error: `A staff profile with email ${email} already exists.` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tempPassword = generateSecureTempPassword();

      // Create identity in Supabase Auth via Auth Admin API
      const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

      if (authErr) {
        return new Response(
          JSON.stringify({ error: `Auth Admin creation failed: ${authErr.message}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const realAuthUid = authData.user.id;

      // Insert into staff_profiles with authoritative auth_uid
      const { data: createdStaff, error: insertErr } = await adminClient
        .from("staff_profiles")
        .insert({
          auth_uid: realAuthUid,
          email,
          full_name: fullName,
          role,
          department,
          phone,
          is_active: true,
          auth_status: "provisioned",
          must_change_password: true,
        })
        .select()
        .single();

      if (insertErr) {
        // Rollback Auth user if profile insert fails to avoid dangling identities
        await adminClient.auth.admin.deleteUser(realAuthUid);
        throw new Error(`Failed to create staff profile: ${insertErr.message}`);
      }

      await logAudit(
        "staff_auth_provisioned",
        createdStaff.id,
        null,
        { email, role, department, auth_uid: realAuthUid, must_change_password: true },
        `Staff account directly provisioned: ${fullName} (${email}) with role ${role}`
      );

      return new Response(
        JSON.stringify({
          success: true,
          action: "create_staff",
          staff: createdStaff,
          tempPassword,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================================
    // ACTION C: APPROVE ADMIN CHANGE REQUEST (SUPER ADMIN APPROVAL)
    // =========================================================================
    if (action === "approve_request") {
      const requestId = body.requestId;
      if (!requestId) {
        return new Response(
          JSON.stringify({ error: "requestId is required." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: reqRecord, error: reqErr } = await adminClient
        .from("staff_change_requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (reqErr || !reqRecord) {
        return new Response(
          JSON.stringify({ error: "Staff change request not found." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (reqRecord.status !== "pending") {
        return new Response(
          JSON.stringify({ error: `Request cannot be approved: current status is ${reqRecord.status}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (reqRecord.request_type !== "create_staff") {
        return new Response(
          JSON.stringify({ error: `Edge Function provisioning only executes create_staff requests.` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const changes = reqRecord.requested_changes || {};
      const targetEmail = (changes.email || "").trim().toLowerCase();
      const targetFullName = (changes.full_name || "").trim();
      const targetRole = reqRecord.requested_role || "viewer";
      const targetDept = (changes.department || "").trim() || "Operations";
      const targetPhone = (changes.phone || "").trim() || null;

      if (!targetEmail || !targetFullName) {
        throw new Error("Missing requested email or full name in change request payload.");
      }

      const tempPassword = generateSecureTempPassword();

      // Create identity in Supabase Auth
      const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
        email: targetEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: targetFullName },
      });

      if (authErr) {
        await adminClient
          .from("staff_change_requests")
          .update({
            status: "failed",
            execution_error: authErr.message,
            reviewed_by: callerProfile.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", reqRecord.id);

        throw new Error(`Auth Admin creation failed: ${authErr.message}`);
      }

      const realAuthUid = authData.user.id;

      // Insert into staff_profiles
      const { data: createdStaff, error: insertErr } = await adminClient
        .from("staff_profiles")
        .insert({
          auth_uid: realAuthUid,
          email: targetEmail,
          full_name: targetFullName,
          role: targetRole,
          department: targetDept,
          phone: targetPhone,
          is_active: true,
          auth_status: "provisioned",
          must_change_password: true,
        })
        .select()
        .single();

      if (insertErr) {
        await adminClient.auth.admin.deleteUser(realAuthUid);
        await adminClient
          .from("staff_change_requests")
          .update({
            status: "failed",
            execution_error: insertErr.message,
            reviewed_by: callerProfile.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", reqRecord.id);

        throw new Error(`Failed to create staff profile: ${insertErr.message}`);
      }

      // Mark request executed
      await adminClient
        .from("staff_change_requests")
        .update({
          status: "executed",
          reviewed_by: callerProfile.id,
          reviewed_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          target_staff_profile_id: createdStaff.id,
        })
        .eq("id", reqRecord.id);

      await logAudit(
        "staff_auth_provision_approved",
        createdStaff.id,
        { request_id: reqRecord.id, status: "pending" },
        { auth_uid: realAuthUid, status: "executed", must_change_password: true },
        `Staff creation request #${reqRecord.id.slice(0, 8)} approved and provisioned for ${targetFullName}`
      );

      return new Response(
        JSON.stringify({
          success: true,
          action: "approve_request",
          staff: createdStaff,
          tempPassword,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unsupported action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[EdgeFunction Error]:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Internal server error during provisioning" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
