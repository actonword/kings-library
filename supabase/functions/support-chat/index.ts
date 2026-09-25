// POST body: { messages: [{ role: "user" | "assistant", content: string }], lang?: "en" | "hi" | "pa" }
// Support chatbot for the app and website. Answers questions about using King's Library,
// buying, delivery, refunds and the catalog — from the site's own settings and catalog,
// never from guesswork — and hands off to WhatsApp/email for anything it can't resolve.
// Signed-in readers: the bot also knows which books/podcasts they own.
// Limits: DAILY_LIMIT replies per reader (or per IP for website visitors), plus a
// site-wide daily cap as a cost safety net.
import Anthropic from "npm:@anthropic-ai/sdk";
import { adminClient, getCallerProfile } from "../_shared/auth.ts";
import { jsonResponse, corsHeaders } from "../_shared/cors.ts";

const MODEL = "claude-haiku-4-5"; // chosen by the site owner for cost
const DAILY_LIMIT = Number(Deno.env.get("CHAT_DAILY_LIMIT") ?? 20);
const SITE_DAILY_LIMIT = Number(Deno.env.get("CHAT_SITE_DAILY_LIMIT") ?? 500);
const MAX_HISTORY = 8;          // only the last few turns are sent, to keep cost per reply low
const MAX_MESSAGE_CHARS = 1500;

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

// How buying works today. Update this when online payments (Razorpay) go live.
const HOW_TO_BUY = `Buying right now: on the website (kingslibrary.online), each book or podcast has a "Buy Now" button. It opens the buyer's email app with a ready-written message to King's Library; we reply with how to pay (for example UPI). Once payment is confirmed, we give access and the buyer gets an email "Your King's Library access is ready" with the app link. Prices are one-time — there is no subscription.`;

const APP_GUIDE = `How the King's Library app works (https://kingslibrary.online/app/):
- Sign in: enter the same email address used to buy. A 6-digit code is emailed (from hello@kingslibrary.online); type it in. No password. If the code doesn't arrive: check spam/promotions, wait a minute and tap "Resend code", and make sure it's the exact email used to buy. Codes expire after a while — always use the newest one.
- Install on the phone (free, no app store): on the sign-in screen tap "Show me how" under "Install the app on your phone", or the download icon at the top of the library. Android: open the link in Chrome (if it opened inside Gmail/WhatsApp, tap ⋮ → Open in Chrome), then ⋮ → Install app. iPhone/iPad: open in Safari, tap Share → Add to Home Screen → Add.
- Library: shows the books and podcasts the reader owns. Items not bought show a lock. A language menu filters by English, Hindi or Punjabi. The "EN" button switches the app's own language (English / हिंदी / ਪੰਜਾਬੀ).
- Reading: swipe left/right, tap the page edges or use the arrows to turn pages; drag the slider to jump. The list icon at the top opens the chapter list; the book also has a Contents page where tapping a chapter jumps to it. The settings icon changes text size and theme (light, sepia, dark); pinch with two fingers also changes text size. Books reopen on the exact page where the reader stopped.
- Protection: books can't be copied, downloaded or screenshotted from the app; content hides when the app is in the background. This is intentional.
- Podcasts: play/pause, skip 15 seconds, speed 1x–2x. Episodes resume where the listener stopped and can be controlled from the phone's lock screen.
- Website free previews: every book has a free sample ("Read Sample") and every podcast a short preview ("Listen to Sample").`;

function stripHtml(s: string) {
  return s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function fillPolicy(text: string, s: Record<string, string>) {
  return stripHtml(text)
    .replace(/\{business_name\}/g, s.business_name || "King's Library")
    .replace(/\{contact_email\}/g, s.contact_email || "the email on the Contact Us page")
    .replace(/\{contact_phone\}/g, s.contact_phone || "the phone number on the Contact Us page")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function buildSystemPrompt(admin: ReturnType<typeof adminClient>) {
  const [{ data: settingsRows }, { data: books }, { data: pods }] = await Promise.all([
    admin.from("settings").select("key, value"),
    admin.from("books").select("title, author, lang, price, description").eq("status", "published").order("title"),
    admin.from("podcasts").select("title, host, lang, price, description, duration_sec").eq("status", "published").order("title"),
  ]);
  const s: Record<string, string> = Object.fromEntries((settingsRows ?? []).map((r) => [r.key, r.value ?? ""]));
  const phone = s.contact_phone || "";
  const whatsapp = phone.replace(/\D/g, "");
  const price = (p: number | null) => (p ? `₹${p}` : "price not set yet");
  const short = (d: string | null) => (d ? ` — ${stripHtml(d).slice(0, 220)}` : "");

  const catalog = [
    "Books:",
    ...((books ?? []).length ? (books ?? []).map((b) => `- "${b.title}" by ${b.author} (${b.lang}), ${price(b.price)}${short(b.description)}`) : ["- (none published yet)"]),
    "Podcasts:",
    ...((pods ?? []).length ? (pods ?? []).map((p) => `- "${p.title}" hosted by ${p.host} (${p.lang}${p.duration_sec ? `, ${Math.round(p.duration_sec / 60)} min` : ""}), ${price(p.price)}${short(p.description)}`) : ["- (none published yet)"]),
  ].join("\n");

  return `You are the friendly help assistant for King's Library (kingslibrary.online), a digital library of books and podcasts${s.business_name ? `, operated by ${s.business_name}` : ""}. You help readers and website visitors with using the app, buying, delivery, refunds and what's in the catalog.

Language: reply in the language the person writes in — English, Hindi (Devanagari script) or Punjabi (Gurmukhi script). If they write Hindi or Punjabi in English letters, reply in that language in English letters. Keep answers short and warm: a few sentences or a short numbered list. Plain text only — no markdown headings, tables or bold.

Stay grounded: answer only from the information below. Never invent prices, books, dates, discounts or policies. If something isn't covered, or the person needs something only a human can do — a payment they made, access that didn't arrive after the stated time, a refund request, changing their email, anything about their specific order — say so kindly and give the contact details. Don't promise refunds or exceptions yourself; explain the policy and pass them to the team. For topics unrelated to King's Library, politely say you can only help with King's Library. Don't discuss the content or teaching of the books — suggest the free sample on the website instead.

Contact (human help):
- Email: ${s.contact_email || "see the Contact Us page"}
${phone ? `- Phone: ${phone}${whatsapp.length >= 10 ? `\n- WhatsApp: https://wa.me/${whatsapp}` : ""}` : ""}
- Contact page: https://kingslibrary.online/#contact

${HOW_TO_BUY}

${APP_GUIDE}

Refund & Cancellation Policy (full page: https://kingslibrary.online/#refund):
${s.refund_text ? fillPolicy(s.refund_text, s) : "(not published)"}

Delivery Policy (full page: https://kingslibrary.online/#delivery):
${s.delivery_text ? fillPolicy(s.delivery_text, s) : "(not published)"}

Catalog (only these are available):
${catalog}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  // GET = "is the chat set up?" — the widget only shows its button when this says yes,
  // so visitors never see a Help button that can't answer.
  if (req.method === "GET") {
    const { error } = await adminClient().from("chat_usage").select("day").limit(1);
    return jsonResponse({ ready: !!Deno.env.get("ANTHROPIC_API_KEY") && !error });
  }
  if (req.method !== "POST") return jsonResponse({ error: "POST only" }, 405);

  const body = await req.json().catch(() => null);
  const raw: unknown[] = Array.isArray(body?.messages) ? body.messages : [];
  const messages: Anthropic.MessageParam[] = raw
    .filter((m): m is { role: "user" | "assistant"; content: string } =>
      !!m && typeof m === "object" && ((m as any).role === "user" || (m as any).role === "assistant") && typeof (m as any).content === "string" && (m as any).content.trim() !== "")
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));
  while (messages.length && messages[0].role !== "user") messages.shift(); // must start with the user
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return jsonResponse({ error: "A question is required" }, 400);
  }

  const admin = adminClient();
  const profile = await getCallerProfile(req); // null for website visitors
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const usageKey = profile ? `reader:${profile.id}` : `ip:${ip}`;

  // Count this reply first, so limits hold even under many requests at once.
  const { data: siteCount, error: siteErr } = await admin.rpc("bump_chat_usage", { p_key: "all" });
  if (siteErr) return jsonResponse({ error: "Chat is not set up yet" }, 503);
  if (siteCount > SITE_DAILY_LIMIT) return jsonResponse({ error: "busy" }, 429);
  const { data: personCount } = await admin.rpc("bump_chat_usage", { p_key: usageKey });
  if (personCount > DAILY_LIMIT) return jsonResponse({ error: "limit", limit: DAILY_LIMIT }, 429);

  const system: Anthropic.TextBlockParam[] = [
    // Same for everyone (changes only when settings/catalog change) — cacheable once it
    // grows past the model's minimum cacheable size.
    { type: "text", text: await buildSystemPrompt(admin), cache_control: { type: "ephemeral" } },
  ];
  if (profile) {
    const { data: grants } = await admin.from("access_grants").select("item_type, item_id").eq("reader_id", profile.id);
    const bookIds = (grants ?? []).filter((g) => g.item_type === "book").map((g) => g.item_id);
    const podIds = (grants ?? []).filter((g) => g.item_type === "podcast").map((g) => g.item_id);
    const [{ data: ownedBooks }, { data: ownedPods }] = await Promise.all([
      bookIds.length ? admin.from("books").select("title").in("id", bookIds) : Promise.resolve({ data: [] }),
      podIds.length ? admin.from("podcasts").select("title").in("id", podIds) : Promise.resolve({ data: [] }),
    ]);
    const owned = [...(ownedBooks ?? []).map((b) => `book "${b.title}"`), ...(ownedPods ?? []).map((p) => `podcast "${p.title}"`)];
    system.push({
      type: "text",
      text: `This person is signed in to the app as ${profile.email}. They own: ${owned.length ? owned.join(", ") : "nothing yet"}. If they ask about something they don't own, explain how to buy it.`,
    });
  } else {
    system.push({ type: "text", text: "This person is not signed in (website visitor or on the sign-in screen)." });
  }

  try {
    const response = await anthropic.messages.create({ model: MODEL, max_tokens: 1024, system, messages });
    if (response.stop_reason === "refusal") return jsonResponse({ error: "unavailable" }, 200);
    const reply = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
    return jsonResponse({ reply, remaining: Math.max(0, DAILY_LIMIT - personCount) });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return jsonResponse({ error: "Chat is not set up yet" }, 503);
    if (e instanceof Anthropic.RateLimitError) return jsonResponse({ error: "busy" }, 429);
    if (e instanceof Anthropic.APIError) return jsonResponse({ error: "unavailable" }, 502);
    return jsonResponse({ error: "unavailable" }, 500);
  }
});
