import { createClient } from "npm:@supabase/supabase-js@2";

function corsHeaders(request: Request) {
  const configuredOrigin = Deno.env.get("ALLOWED_ORIGIN");
  const requestOrigin = request.headers.get("Origin");
  const allowed = configuredOrigin && requestOrigin === configuredOrigin ? configuredOrigin : "null";
  return {
  "Access-Control-Allow-Origin": allowed,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  };
}

type Role = "student" | "cr" | "admin";
type RequestBody = {
  action?: "invite_member" | "set_roles";
  class_id?: string;
  email?: string;
  display_name?: string;
  user_id?: string;
  roles?: Role[];
  roll_number?: number | null;
};

const validRoles = new Set<Role>(["student", "cr", "admin"]);
const isUuid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function response(request: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json" },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return response(request, 405, { error: "Method not allowed" });
  const declaredLength = Number(request.headers.get("Content-Length") ?? "0");
  if (declaredLength > 16_384) return response(request, 413, { error: "Request is too large" });

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return response(request, 401, { error: "Sign-in required" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return response(request, 500, { error: "Server configuration is incomplete" });
  }

  const token = authorization.slice("Bearer ".length);
  const callerClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await callerClient.auth.getUser(token);
  if (authError || !authData.user) return response(request, 401, { error: "Invalid or expired session" });

  let body: RequestBody;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 16_384) return response(request, 413, { error: "Request is too large" });
    body = JSON.parse(rawBody) as RequestBody;
  } catch {
    return response(request, 400, { error: "Request body must be valid JSON" });
  }

  const classId = body.class_id;
  if (!isUuid(classId)) return response(request, 400, { error: "A valid class_id is required" });

  const { data: activeClass, error: classError } = await serviceClient
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("is_active", true)
    .maybeSingle();
  if (classError) return response(request, 500, { error: "Could not verify the class" });
  if (!activeClass) return response(request, 404, { error: "Active class not found" });

  const { data: adminRole, error: roleError } = await serviceClient
    .from("class_memberships")
    .select("user_id")
    .eq("user_id", authData.user.id)
    .eq("class_id", classId)
    .eq("role", "admin")
    .eq("is_active", true)
    .maybeSingle();
  if (roleError) return response(request, 500, { error: "Could not verify administrator access" });
  if (!adminRole) return response(request, 403, { error: "Active class Admin role required" });

  if (body.action !== "invite_member" && body.action !== "set_roles") {
    return response(request, 400, { error: "Unsupported action" });
  }
  if (!Array.isArray(body.roles) || body.roles.length === 0 ||
      body.roles.some((role) => !validRoles.has(role)) || new Set(body.roles).size !== body.roles.length) {
    return response(request, 400, { error: "Choose one or more valid roles: student, cr, admin" });
  }

  const roles = body.roles;
  const hasStudent = roles.includes("student");
  const rollNumber = body.roll_number;
  if (hasStudent && (!Number.isInteger(rollNumber) || (rollNumber as number) < 1 || (rollNumber as number) > 66)) {
    return response(request, 400, { error: "Student membership requires a roll number from 1 to 66" });
  }
  if (!hasStudent && rollNumber != null) {
    return response(request, 400, { error: "Only Student membership can have a roll number" });
  }

  if (hasStudent) {
    let rollQuery = serviceClient.from("class_memberships")
      .select("user_id")
      .eq("class_id", classId)
      .eq("role", "student")
      .eq("roll_number", rollNumber)
      .eq("is_active", true);
    if (body.action === "set_roles" && isUuid(body.user_id)) {
      rollQuery = rollQuery.neq("user_id", body.user_id);
    }
    const { data: rollOwner, error: rollError } = await rollQuery.maybeSingle();
    if (rollError) return response(request, 500, { error: "Could not verify that roll number" });
    if (rollOwner) return response(request, 409, { error: "That student roll number is already assigned" });
  }

  let targetUserId = body.user_id;
  let targetEmail: string | undefined;
  if (body.action === "invite_member") {
    const email = body.email?.trim().toLowerCase();
    const displayName = body.display_name?.trim();
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return response(request, 400, { error: "A valid email address is required" });
    }
    if (!displayName || displayName.length > 100) {
      return response(request, 400, { error: "Display name must be between 1 and 100 characters" });
    }
    const redirectTo = Deno.env.get("INVITE_REDIRECT_URL");
    if (!redirectTo) return response(request, 500, { error: "Invite redirect URL is not configured" });
    const { data, error } = await serviceClient.auth.admin.inviteUserByEmail(email, {
      data: { display_name: displayName },
      redirectTo,
    });
    if (error || !data.user) {
      return response(request, 400, { error: "Could not invite this email. It may already have an account." });
    }
    targetUserId = data.user.id;
    targetEmail = email;
    const { error: profileError } = await serviceClient.from("profiles").upsert({
      user_id: targetUserId,
      display_name: displayName,
    }, { onConflict: "user_id" });
    if (profileError) {
      await serviceClient.auth.admin.deleteUser(targetUserId);
      return response(request, 500, { error: "Could not finish account setup" });
    }
  } else if (!isUuid(targetUserId)) {
    return response(request, 400, { error: "A valid user_id is required for set_roles" });
  }

  const targetId = targetUserId as string;
  const { data: currentAdminRoles, error: currentAdminError } = await serviceClient
    .from("class_memberships")
    .select("user_id")
    .eq("class_id", classId)
    .eq("role", "admin")
    .eq("is_active", true);
  if (currentAdminError) return response(request, 500, { error: "Could not verify class administrator count" });
  if (!roles.includes("admin") && currentAdminRoles?.length === 1 && currentAdminRoles[0].user_id === targetId) {
    return response(request, 409, { error: "The last active Admin cannot be removed" });
  }
  const roleRows = roles.map((role) => ({
    user_id: targetId,
    class_id: classId,
    role,
    roll_number: role === "student" ? rollNumber : null,
    is_active: true,
  }));

  const { error: upsertError } = await serviceClient.from("class_memberships").upsert(roleRows, {
    onConflict: "user_id,class_id,role",
  });
  if (upsertError) {
    if (body.action === "invite_member") await serviceClient.auth.admin.deleteUser(targetId);
    if (upsertError.code === "23505") return response(request, 409, { error: "That student roll number is already assigned" });
    return response(request, 500, { error: "Could not save class roles" });
  }

  const { error: removeError } = await serviceClient.from("class_memberships")
    .delete()
    .eq("user_id", targetId)
    .eq("class_id", classId)
    .not("role", "in", `(${roles.join(",")})`);
  if (removeError) return response(request, 500, { error: "Roles were saved, but old roles could not be removed" });

  const { error: auditError } = await serviceClient.from("audit_events").insert({
    actor_id: authData.user.id,
    class_id: classId,
    action: body.action === "invite_member" ? "member_invited" : "member_roles_changed",
    target_type: "user",
    target_id: targetId,
    metadata: { roles, roll_number: hasStudent ? rollNumber : null },
  });
  if (auditError) return response(request, 500, { error: "Membership saved, but its audit record could not be written" });

  return response(request, body.action === "invite_member" ? 201 : 200, {
    user_id: targetId,
    ...(targetEmail ? { email: targetEmail } : {}),
    roles,
    ...(hasStudent ? { roll_number: rollNumber } : {}),
  });
});
