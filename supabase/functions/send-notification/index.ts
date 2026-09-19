// POST body: { title: string, message: string, target: 'all'|'book_owners'|'reader',
//              bookId?: string, readerEmail?: string, emailToo?: boolean }
// Admin-only. Inserts the notification (readers see it via the notifications table
// under RLS) and, if emailToo is true, also emails the affected readers via Resend.
import { adminClient, requireAdmin } from "../_shared/auth.ts";
import { jsonResponse, corsHeaders } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/email.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { ok, profile: adminProfile } = await requireAdmin(req);
  if (!ok) return jsonResponse({ error: "Admin access required" }, 403);

  const body = await req.json().catch(() => null);
  const title: string | undefined = body?.title?.trim();
  const message: string | undefined = body?.message?.trim();
  const target: string = body?.target ?? "all";
  const bookId: string | undefined = body?.bookId;
  const readerEmail: string | undefined = body?.readerEmail?.trim().toLowerCase();
  const emailToo: boolean = !!body?.emailToo;

  if (!title || !message) return jsonResponse({ error: "title and message are required" }, 400);
  if (!["all", "book_owners", "reader"].includes(target)) {
    return jsonResponse({ error: "invalid target" }, 400);
  }
  if (target === "book_owners" && !bookId) return jsonResponse({ error: "bookId required for book_owners" }, 400);
  if (target === "reader" && !readerEmail) return jsonResponse({ error: "readerEmail required for reader" }, 400);

  const admin = adminClient();
  let targetReaderId: string | null = null;

  if (target === "reader") {
    const { data: reader } = await admin.from("profiles").select("id").eq("email", readerEmail).maybeSingle();
    if (!reader) return jsonResponse({ error: "No reader found with that email" }, 404);
    targetReaderId = reader.id;
  }

  const { data: notification, error: insertErr } = await admin
    .from("notifications")
    .insert({
      title,
      message,
      target,
      book_id: target === "book_owners" ? bookId : null,
      target_reader_id: targetReaderId,
      created_by: adminProfile!.id,
    })
    .select()
    .single();
  if (insertErr) return jsonResponse({ error: insertErr.message }, 500);

  await admin.from("activity_log").insert({
    body: `Sent notification <strong>${title}</strong> (${target}).`,
  });

  if (emailToo) {
    let recipients: string[] = [];
    if (target === "all") {
      const { data } = await admin.from("profiles").select("email").eq("role", "reader");
      recipients = (data ?? []).map((r) => r.email);
    } else if (target === "reader") {
      recipients = [readerEmail!];
    } else if (target === "book_owners") {
      const { data } = await admin
        .from("access_grants")
        .select("profiles(email)")
        .eq("item_type", "book")
        .eq("item_id", bookId!);
      recipients = (data ?? []).map((r: any) => r.profiles?.email).filter(Boolean);
    }
    await Promise.all(recipients.map((to) => sendEmail(to, title, `<p>${message}</p>`)));
  }

  return jsonResponse({ ok: true, notification });
});
