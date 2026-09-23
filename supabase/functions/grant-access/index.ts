// POST body: { email: string, displayName?: string, bookIds?: string[], podcastIds?: string[] }
// Admin-only. Creates the reader's account if it doesn't exist yet, grants the
// requested books/podcasts, logs the action, and emails the reader.
import { adminClient, requireAdmin } from "../_shared/auth.ts";
import { jsonResponse, corsHeaders } from "../_shared/cors.ts";
import { sendEmail, APP_URL } from "../_shared/email.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { ok, profile: adminProfile } = await requireAdmin(req);
  if (!ok) return jsonResponse({ error: "Admin access required" }, 403);

  const body = await req.json().catch(() => null);
  const email: string | undefined = body?.email?.trim().toLowerCase();
  const displayName: string | undefined = body?.displayName?.trim();
  const bookIds: string[] = Array.isArray(body?.bookIds) ? body.bookIds : [];
  const podcastIds: string[] = Array.isArray(body?.podcastIds) ? body.podcastIds : [];
  // A free gift is recorded with price_paid = 0 so it doesn't count as revenue.
  const isGift: boolean = body?.gift === true;

  if (!email || !email.includes("@")) {
    return jsonResponse({ error: "A valid email is required" }, 400);
  }
  if (bookIds.length === 0 && podcastIds.length === 0) {
    return jsonResponse({ error: "Select at least one book or podcast" }, 400);
  }

  const admin = adminClient();

  // Find or create the reader's profile/account.
  let { data: existingProfile } = await admin
    .from("profiles")
    .select("id, email")
    .eq("email", email)
    .maybeSingle();

  let readerId: string;
  let isNewReader = false;

  if (existingProfile) {
    readerId = existingProfile.id;
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: displayName ? { display_name: displayName } : undefined,
    });
    if (createErr || !created?.user) {
      return jsonResponse({ error: createErr?.message ?? "Could not create reader account" }, 500);
    }
    readerId = created.user.id;
    isNewReader = true;

    const { error: profileErr } = await admin.from("profiles").insert({
      id: readerId,
      email,
      display_name: displayName ?? null,
      role: "reader",
    });
    if (profileErr) return jsonResponse({ error: profileErr.message }, 500);
  }

  // Price at the moment of granting (the item's current price), unless it's a gift.
  const priceOf: Record<string, number> = {};
  if (!isGift) {
    if (bookIds.length) {
      const { data } = await admin.from("books").select("id, price").in("id", bookIds);
      (data ?? []).forEach((b) => (priceOf[b.id] = Number(b.price) || 0));
    }
    if (podcastIds.length) {
      const { data } = await admin.from("podcasts").select("id, price").in("id", podcastIds);
      (data ?? []).forEach((p) => (priceOf[p.id] = Number(p.price) || 0));
    }
  }

  const grantRows = [
    ...bookIds.map((id) => ({ reader_id: readerId, item_type: "book", item_id: id, granted_by: adminProfile!.id, price_paid: priceOf[id] ?? 0 })),
    ...podcastIds.map((id) => ({ reader_id: readerId, item_type: "podcast", item_id: id, granted_by: adminProfile!.id, price_paid: priceOf[id] ?? 0 })),
  ];

  let { error: grantErr } = await admin
    .from("access_grants")
    .upsert(grantRows, { onConflict: "reader_id,item_type,item_id", ignoreDuplicates: true });
  if (grantErr && /price_paid/.test(grantErr.message)) {
    // Database not yet migrated (0012) — grant without recording the price.
    ({ error: grantErr } = await admin
      .from("access_grants")
      .upsert(grantRows.map(({ price_paid: _p, ...row }) => row), { onConflict: "reader_id,item_type,item_id", ignoreDuplicates: true }));
  }
  if (grantErr) return jsonResponse({ error: grantErr.message }, 500);

  // Look up titles for the activity log + email.
  const titles: string[] = [];
  if (bookIds.length) {
    const { data } = await admin.from("books").select("title").in("id", bookIds);
    titles.push(...(data ?? []).map((b) => b.title));
  }
  if (podcastIds.length) {
    const { data } = await admin.from("podcasts").select("title").in("id", podcastIds);
    titles.push(...(data ?? []).map((p) => p.title));
  }

  await admin.from("activity_log").insert({
    body: `Granted ${titles.map((t) => `<strong>${t}</strong>`).join(", ")} to <strong>${email}</strong>${isGift ? " (free gift)" : ""}.`,
  });

  await sendEmail(
    email,
    "Your King's Library access is ready",
    `<p>Hello${displayName ? " " + displayName : ""},</p>
     <p>You now have access to: <strong>${titles.join(", ")}</strong>.</p>
     <p>Open the app and sign in with this email address — we'll send you a one-time
     code to log in, no password needed.</p>
     <p><a href="${APP_URL}">${APP_URL}</a></p>`,
  );

  return jsonResponse({ ok: true, readerId, isNewReader, granted: titles });
});
