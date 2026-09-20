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
- Book chapters are typed/pasted into the admin panel as plain text — no .epub/.docx/.pdf
  parsing yet.
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
   `site_url`/`additional_redirect_urls` are already set to the real GitHub Pages URLs
   (`https://actonword.github.io/kings-library/{site,app,admin}/`).
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

## Resend sandbox limitation

Without a verified sending domain in Resend, `onboarding@resend.dev` can only deliver
to the email address the Resend account itself is registered under — sending to any
other recipient fails with a GoTrue `500 Error sending magic link email`. Until a
domain is verified:
- Only the Resend account's own email can receive real OTP/notification mail for testing.
- Grant access to that address specifically when testing end-to-end delivery.
- Once a domain is verified, update `admin_email` in `supabase/config.toml`'s
  `[auth.email.smtp]` block and the `RESEND_FROM_EMAIL` Edge Function secret to an
  address on that domain, then re-run `supabase secrets set` (Edge Functions) and
  push the SMTP sender change **via the dashboard**, not `config push` (see landmine above).

## Hosting

GitHub repo: `actonword/kings-library` → GitHub Pages at
`https://actonword.github.io/kings-library/`, with `/site/`, `/app/`, `/admin/` as
the three front ends.

## Status

- [x] Schema + RLS policies (`supabase/migrations/0001_init.sql`), storage buckets (`0002`)
- [x] Resend SMTP + OTP template + rate limits live on the project
- [x] Admin account created (`actonword@gmail.com`, `role='admin'`)
- [x] Edge Functions deployed + `RESEND_API_KEY` secret set
- [x] Admin panel (`admin/index.html`) wired to real Supabase — tested, working
- [x] Reader app (`app/index.html`) wired to real Supabase — OTP sign-in confirmed
      working end-to-end for the Resend account's own email; other recipients blocked
      until a domain is verified (see "Resend sandbox limitation")
- [ ] Verify a domain in Resend so OTP/notification email reaches real reader addresses
- [ ] `site/index.html` (public website) — not wired yet, no payment gateway in v1
- [ ] GitHub repo created and pushed, GitHub Pages enabled
