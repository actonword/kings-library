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
3. **Disable public sign-ups.** Authentication → Sign In / Providers → Email → turn off
   "Allow new users to sign up". Accounts are only ever created by the grant-access
   Edge Function (using the service role key), never by someone signing up themselves.
4. **Switch the OTP email to a 6-digit code.** Authentication → Emails → Magic Link
   template → make sure it references `{{ .Token }}` (the code), not just the link —
   the app calls `supabase.auth.verifyOtp({ email, token, type: 'email' })`.
5. **Route auth email through Resend.** Project Settings → Authentication → SMTP Settings:
   - Host: `smtp.resend.com`, Port: `465`
   - Username: `resend`
   - Password: your Resend API key
   - Sender email: an address on a domain you've verified in Resend
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

## Status

- [x] Schema + RLS policies drafted (`supabase/migrations/0001_init.sql`)
- [ ] Supabase project created and migration run (your turn — see steps above)
- [ ] Resend SMTP wired into Supabase Auth
- [ ] Admin account created
- [ ] Edge Functions: `grant-access`, `send-notification`, `get-podcast-audio-url`
- [ ] Front ends wired to Supabase (replace in-memory arrays with real queries)
- [ ] Deployed to GitHub Pages
