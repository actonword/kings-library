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
- Public sign-up is disabled. Only accounts created via a grant can log in.

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

## Hosting

GitHub repo: `actonword/kings-library` → GitHub Pages at
`https://actonword.github.io/kings-library/`, with `/site/`, `/app/`, `/admin/` as
the three front ends.

## Status

- [x] Schema + RLS policies drafted (`supabase/migrations/0001_init.sql`)
- [x] Migration run on the live Supabase project
- [x] Edge Functions written: `grant-access`, `send-notification`, `get-podcast-audio-url`
- [ ] Resend SMTP + OTP template pushed via `supabase config push` (your turn — see steps above)
- [ ] Admin account created
- [ ] Edge Functions deployed (`supabase functions deploy`) + `RESEND_API_KEY` secret set
- [ ] Front ends wired to Supabase (replace in-memory arrays with real queries)
- [ ] GitHub repo created and pushed
- [ ] GitHub Pages enabled
