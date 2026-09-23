# King's Library

Ebook + podcast platform. Three static front ends (`site/`, `app/`, `admin/`) backed by Supabase.

## Structure

```
site/    marketing website — browse, sample chapters, "buy"
app/     reader app — email+OTP login, owned books/podcasts, reader view, podcast player
admin/   admin panel — manage catalog, grant access, notifications, activity log
supabase/
  migrations/   versioned SQL schema (source of truth for the database)
  functions/    Edge Functions (service-role operations: granting access, signed audio URLs)
_original-mockups/   the original static demo files, kept for reference
```

## v1 model

- No online payments yet. A buyer pays you outside the system; you grant access by
  email in the admin panel. That's what creates their account and emails them the
  6-digit sign-in code.
- Book chapters: uploading an **.epub, .docx, .pdf or .txt** in Manage Books
  auto-splits it into chapters, all client-side in the browser (JSZip for EPUB and
  Word — the .docx XML is read directly; pdf.js is lazy-loaded from jsDelivr for PDF).
  Detection order: EPUB spine / Word heading styles / PDF bookmarks → "Chapter …"-style
  lines (English, Hindi, Punjabi, Arabic) → all-bold short lines (Word) / large-font
  lines (PDF) → fixed ~15k-char "Part N" chunks.
- Chapter text format: paragraphs separated by blank lines. Word uploads keep their look
  as limited inline tags — `<b> <i> <u> <sup> <sub> <br>` — and a paragraph wrapper
  `<p class="center|right|left|indent|inset|tight">` for alignment, indents and
  "no space after" (verse lines). The reader sanitizes everything else to plain text
  and justifies untagged paragraphs.
  Pasted text is split the same way. Scanned (image-only) PDFs have no text and can't be
  read. The "Content" button can also replace a book's chapters from a file, and
  review/edit/add/delete them individually.
- Public sign-up (`enable_signup`) is left **on** at the project level — see "Known
  CLI landmine" below for why. This is safe: every RLS policy requires a matching row
  in `profiles`/`access_grants`, which only the `grant-access` Edge Function (service
  role) ever creates. A stranger who self-registers gets an authenticated session with
  zero rows visible anywhere.

## One-time Supabase setup

1. **Create a project** at supabase.com (free tier is fine).
2. **Run the schema.** Open the SQL Editor in the Supabase dashboard, paste the contents
   of `supabase/migrations/0001_init.sql`, and run it.
3. **Disable public sign-ups, wire up Resend SMTP, and switch the OTP email to a
   6-digit code — all via the CLI instead of the dashboard** (the dashboard's Magic
   Link template editor can get stuck on some accounts):
   ```powershell
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   $env:RESEND_SMTP_PASS = "<your Resend API key>"   # your own terminal, never commit this
   npx supabase config diff     # review what would change
   npx supabase config push     # confirm the auth section when prompted
   ```
   This pushes the `[auth]` section of `supabase/config.toml`, which already has
   `enable_signup = false`, the Resend SMTP block, and a custom `magic_link` template
   (`supabase/templates/magic_link.html`) that shows the raw `{{ .Token }}` code — the
   app calls `supabase.auth.verifyOtp({ email, token, type: 'email' })` with it.
   `site_url`/`additional_redirect_urls` are set to `https://kingslibrary.online/{site,app,admin}/`
   (the old `https://actonword.github.io/kings-library/{site,app,admin}/` URLs are kept
   as a fallback in `additional_redirect_urls`).
6. **Create your admin account.** Authentication → Users → Add user (email + password).
   Copy the new user's UUID, then in the SQL Editor run:
   ```sql
   insert into public.profiles (id, email, role, display_name)
   values ('<uuid-from-the-user-you-just-created>', 'you@example.com', 'admin', 'Admin');
   ```
7. **Create storage buckets.** Storage → New bucket:
   - `covers` — public
   - `podcast-audio` — private (served only via signed URLs from an Edge Function)
8. **Get your API keys.** Project Settings → API → copy the Project URL and the
   `anon` public key. These go in each front end's Supabase client config (added in
   the next step, once the front ends are wired up).

## Known CLI landmine

`supabase config push` for anything under `[auth]`/`[auth.email]` silently resets the
dashboard's "Enable Email provider" toggle to OFF (it's not a field the CLI's config
schema tracks, so it seems to get clobbered as a side effect). This breaks all email
sign-in — password and OTP alike — with zero emails sent and a `email_provider_disabled`
error. Hit this twice already.

**Rule: don't `config push` the auth section anymore.** Make auth/email setting changes
directly in the dashboard, then `supabase config pull` afterward just to keep
`config.toml` in sync for reference. If a push to auth ever is unavoidable, immediately
verify afterward with:
```powershell
Invoke-RestMethod -Uri "https://orddbbrlxdnynbwhcqrm.supabase.co/auth/v1/otp" -Method POST `
  -Headers @{ "apikey" = "<anon key>"; "Content-Type" = "application/json" } `
  -Body '{"email":"<any granted reader email>","create_user":false}'
```
A `422 email_provider_disabled` means the toggle got reset — go re-enable it before
telling anyone sign-in is fixed.

**Second landmine: `enable_signup = false` breaks OTP for everyone, not just new users.**
GoTrue's `/auth/v1/otp` endpoint refuses *all* OTP requests when `enable_signup` is
false — even for existing users with `shouldCreateUser: false`. There is no way to
"disable signup but allow OTP for existing accounts" at the project-config level.
`enable_signup` is therefore left `true` intentionally (see "v1 model" above);
don't set it back to false, it will silently break every reader's sign-in.

## Resend domain (resolved)

`kingslibrary.online` is verified in Resend as of 2026-09-21. `RESEND_FROM_EMAIL` is
set to `King's Library <hello@kingslibrary.online>` (applies to the custom emails sent
by `grant-access`/`send-notification`). The OTP/magic-link sender (`admin_email` in
Supabase's SMTP settings) still needs updating to the same address — **do this via the
dashboard**, not `config push` (see landmine above), since it's the exact setting that
trips the email-provider-reset bug.

## Hosting

GitHub repo: `actonword/kings-library` → GitHub Pages, custom domain `kingslibrary.online`
(DNS live via 4 A records at Hostinger; HTTPS cert was still provisioning as of
2026-09-21 — until then `actonword.github.io/kings-library/` is the safe fallback URL
to hand out). `/site/`, `/app/`, `/admin/` are the three front ends either way.

## Status

- [x] Schema + RLS policies (`supabase/migrations/0001_init.sql`), storage buckets (`0002`)
- [x] Resend SMTP + OTP template + rate limits live on the project
- [x] Admin account created (`actonword@gmail.com`, `role='admin'`)
- [x] Edge Functions deployed + `RESEND_API_KEY` secret set
- [x] Admin panel (`admin/index.html`) wired to real Supabase — tested, working
- [x] Reader app (`app/index.html`) wired to real Supabase — full flow confirmed
      working end-to-end (grant → email → OTP → library → open/read a book) for the
      Resend account's own email; other recipients blocked until a domain is verified
      (see "Resend sandbox limitation")
- [x] Public website (`site/index.html`) wired to real Supabase catalog — Buy Now
      opens a pre-filled email to malviyadheerajkumar@gmail.com (no payment gateway in v1)
- [x] GitHub repo created and pushed (`actonword/kings-library`), GitHub Pages live
- [x] Custom domain `kingslibrary.online` — DNS live at Hostinger, HTTPS provisioning
- [x] Domain verified in Resend; `RESEND_FROM_EMAIL` updated to hello@kingslibrary.online
- [ ] Update OTP sender (`admin_email`) to hello@kingslibrary.online in the Supabase
      dashboard's SMTP settings (not yet done — do this via dashboard, not config push)
- [ ] Once HTTPS is confirmed live on kingslibrary.online: update Site URL/Redirect URLs
      in the dashboard, redeploy Edge Functions so APP_URL picks up the new domain, and
      switch reader-facing links (grant emails, PWA) over from actonword.github.io
