# Supabase workspace integration

The frontend uses Supabase Auth for Google OAuth (PKCE), email/password sign-in,
email confirmation, session refresh, logout, and profile metadata. Users are
created in Supabase's managed `auth.users`; no custom table migration is required
for sign-in. The old localStorage demo session and `?demo` bypass are removed.

## Database and storage setup

Run [`../supabase/migrations/20261107190148_user_workspace.sql`](../supabase/migrations/20261107190148_user_workspace.sql)
in the Supabase SQL Editor, or apply it with the Supabase CLI. It creates the
`investigations` table, owner-only row policies, an owner/date index, and an
`avatars` Storage bucket. The publishable key cannot run schema migrations.
Connect the Supabase management plugin to apply the migration through this chat.

The supplied hosted project has the workspace migration applied. Live checks
confirmed its owner/date index, four owner-only report policies, avatar bucket
limits, and four owner-only avatar policies. The existing optional `profiles`
table and its signup/update triggers were also inspected and hardened in
`harden_workspace_functions`. That migration expects those pre-existing profile
objects; the app itself stores profile edits in Auth metadata.

`supabase/tests/workspace_rls.sql` passed on the hosted database with temporary
fixture users in a rolled-back transaction. It checked owner reads/writes,
cross-account denial (including reassignment), anonymous denial, and profile
triggers. No fixture data remains. The security advisor returned no findings
after hardening. Actual Google account selection and email delivery still need
to be exercised in the browser.

Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in the root `.env` (or backend
deployment environment). These are configured locally for the supplied project.
The API verifies every bearer token with Supabase Auth's `/auth/v1/user` endpoint,
then sends that same user token to PostgREST. Owner filters and database RLS
both restrict history, reports, and explanation updates. The server never uses a
service-role key. Missing/invalid sessions return 401; inaccessible IDs return
404; storage outages return 503 without falling back to a shared local database.

Investigation routes require verified sessions. `/health`, API documentation, and the separately implemented SMS-analysis endpoint remain public. Old SQLite reports stay in
the local file and are **not** automatically assigned to any account. This
avoids exposing previously shared scans to the first person who signs in.
The SQLite helper remains only for offline test fixtures and possible exports.
Authenticated users can edit their own stored reports directly via PostgREST;
reports are user-owned records, not tamper-proof attestations.

Profile names and notification preferences persist in user metadata. Photos are
resized and uploaded to Storage rather than embedded in auth tokens. Avatar
objects are publicly readable by URL; writes are restricted to the owner's UUID
folder. Scan reports remain private to their owner. Notification delivery and
scheduled certificate checks are not implemented; the UI labels that limit.
The previous nonfunctional generated API-key control has been removed.

## Frontend environment

Copy `webassure/.env.example` to `webassure/.env.local` and set the Supabase URL
and publishable key. The supplied project is configured locally already.
Restart `npm run dev` after changes. For production, set the same two
`NEXT_PUBLIC_SUPABASE_*` variables in the hosting environment before building.
Publishable keys are intended for browser clients. Do not use a service-role key,
Google client secret, or database password in these variables.

## Google provider setup

1. In Google Cloud → Google Auth Platform → Clients, create a **Web application**
   OAuth client. A project name or project ID is not an OAuth client ID.
2. Add the application origins (for example `http://localhost:3000` and your
   deployed HTTPS origin) to **Authorized JavaScript origins**.
3. Add this exact **Authorized redirect URI**:
   `https://ldrspcimsdzazhbckmca.supabase.co/auth/v1/callback`.
4. In Supabase → Authentication → Sign In / Providers → Google, enable Google
   and enter the actual Google OAuth client ID and client secret. Keep the secret
   in that dashboard; it is not used in frontend files.
5. In Supabase → Authentication → URL Configuration, set **Site URL** to your
   deployed origin and allow `http://localhost:3000/auth/callback` and
   `https://YOUR-DEPLOYED-HOST/auth/callback` under **Redirect URLs**. Include any
   other actual development ports or preview domains you use.
   Also allow `http://localhost:3000/auth/reset-password` and its deployed
   equivalent so password recovery can return to the app.
6. If Google's consent screen is in Testing, add the accounts you will use as
   test users. Complete Google's consent-screen configuration as required.

Live inspection during implementation confirmed Google and email are enabled.
The Google authorization redirect now contains a correctly shaped Web OAuth
client ID. A complete account-selection/consent flow is still needed to verify
the client secret, allowed Google users, and application redirect configuration.

## Check the complete flow

Open `/login`, choose Google, select a permitted Google account, and check that
you return through `/auth/callback` to `/dashboard`. Check the new user under
Supabase → Authentication → Users. Refresh, open another tab, then log out and
verify the dashboard asks for sign-in again. A `next=/dashboard/scans` URL is
preserved through sign-in; external redirect destinations are rejected.

The callback uses one browser Supabase client; its SDK exchanges the PKCE code
once on initialization. The callback then verifies the user and redirects.
Complete the flow in the same browser that started it so the PKCE verifier is
available. Provider failures appear on the callback page instead of creating a
demo user.

GitHub sign-in is not shown because that provider is disabled in this project.
Email confirmation depends on the Supabase project's email configuration.

## Password recovery and validation

The login page's **Forgot?** link opens `/forgot-password`. Reset emails return to
`/auth/reset-password`; the SDK restores the PKCE recovery session before the
new password is saved. Open the email in the browser that requested it. Configure
Supabase email delivery/SMTP and redirect allowlists for deployed use. Google-only
users can use this email flow to set a password if permitted by project settings.

Run the backend suite and `npm --prefix webassure test`, then build the frontend.
`tests/test_supabase.py` covers rejected sessions, verified ownership, scoped
reads/writes and secret-free failures. The browser suite uses mocked Auth and
isolated SQLite fixtures; it does not prove live RLS or email/OAuth delivery.
After applying the migration, sign in with two actual accounts: each should see
only its own scans, and opening the other account's report ID should return 404.
Also try direct REST access with each user token to verify the database policies.

References: [Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google),
[PKCE sessions](https://supabase.com/docs/guides/auth/sessions/pkce-flow).
