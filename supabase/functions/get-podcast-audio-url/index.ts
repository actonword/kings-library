// POST body: { podcastId: string }
// Any signed-in reader who owns the podcast (or an admin) gets back a short-lived
// signed URL to the audio file in the private `podcast-audio` bucket.
import { adminClient, getCallerProfile } from "../_shared/auth.ts";
import { jsonResponse, corsHeaders } from "../_shared/cors.ts";

const SIGNED_URL_TTL_SECONDS = 60 * 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const profile = await getCallerProfile(req);
  if (!profile) return jsonResponse({ error: "Sign-in required" }, 401);

  const body = await req.json().catch(() => null);
  const podcastId: string | undefined = body?.podcastId;
  if (!podcastId) return jsonResponse({ error: "podcastId is required" }, 400);

  const admin = adminClient();

  if (profile.role !== "admin") {
    const { data: grant } = await admin
      .from("access_grants")
      .select("id")
      .eq("reader_id", profile.id)
      .eq("item_type", "podcast")
      .eq("item_id", podcastId)
      .maybeSingle();
    if (!grant) return jsonResponse({ error: "You don't have access to this podcast" }, 403);
  }

  const { data: podcast, error: podcastErr } = await admin
    .from("podcasts")
    .select("audio_path")
    .eq("id", podcastId)
    .single();
  if (podcastErr || !podcast?.audio_path) {
    return jsonResponse({ error: "Audio not found for this podcast" }, 404);
  }

  const { data: signed, error: signErr } = await admin.storage
    .from("podcast-audio")
    .createSignedUrl(podcast.audio_path, SIGNED_URL_TTL_SECONDS);
  if (signErr || !signed) return jsonResponse({ error: signErr?.message ?? "Could not sign URL" }, 500);

  return jsonResponse({ url: signed.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS });
});
