import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

/**
 * Resolves the caller's profile from the request's Authorization header.
 * Returns null if there's no valid session.
 */
export async function getCallerProfile(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const asUserClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await asUserClient.auth.getUser();
  if (userErr || !userData?.user) return null;

  const admin = adminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, email, role")
    .eq("id", userData.user.id)
    .single();

  return profile ?? null;
}

export async function requireAdmin(req: Request) {
  const profile = await getCallerProfile(req);
  if (!profile || profile.role !== "admin") {
    return { ok: false as const, profile: null };
  }
  return { ok: true as const, profile };
}
