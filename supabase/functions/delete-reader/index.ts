// POST body: { readerId: string }
// Admin-only. Permanently deletes a reader's account — for emails added by mistake or
// accounts no longer used: their sign-in, profile, access to every book/podcast,
// reading/listening progress, and notifications that were addressed only to them.
import { adminClient, requireAdmin } from "../_shared/auth.ts";
import { jsonResponse, corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { ok } = await requireAdmin(req);
  if (!ok) return jsonResponse({ error: "Admin access required" }, 403);

  const body = await req.json().catch(() => null);
  const readerId: string | undefined = body?.readerId;
  if (!readerId) return jsonResponse({ error: "readerId is required" }, 400);

  const admin = adminClient();
  const { data: profile } = await admin.from("profiles").select("id, email, role").eq("id", readerId).maybeSingle();
  if (!profile) return jsonResponse({ error: "No reader found" }, 404);
  if (profile.role !== "reader") return jsonResponse({ error: "Only reader accounts can be deleted here" }, 400);

  // Notifications sent to just this reader point at their profile without cascading.
  const { error: notifErr } = await admin.from("notifications").delete().eq("target_reader_id", readerId);
  if (notifErr) return jsonResponse({ error: notifErr.message }, 500);

  // Deleting the sign-in account cascades to the profile, and from there to access
  // grants, reading/podcast progress and notification read-marks.
  const { error: delErr } = await admin.auth.admin.deleteUser(readerId);
  if (delErr && !/not.?found/i.test(delErr.message)) return jsonResponse({ error: delErr.message }, 500);
  // If there was no sign-in account (shouldn't happen), remove the profile directly.
  const { error: profErr } = await admin.from("profiles").delete().eq("id", readerId);
  if (profErr) return jsonResponse({ error: profErr.message }, 500);

  const safeEmail = profile.email.replace(/[&<>"']/g, (c: string) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
  await admin.from("activity_log").insert({ body: `Deleted reader account <strong>${safeEmail}</strong>.` });

  return jsonResponse({ ok: true, email: profile.email });
});
