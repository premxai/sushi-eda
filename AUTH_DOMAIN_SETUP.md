# Supabase Auth and `trysushi.xyz` launch checklist

The application code is ready for Supabase email/password authentication. The
following dashboard and DNS actions must be performed by the account owner;
they require access to Supabase, Vercel, the backend host, and the domain
registrar.

## 1. Supabase project

1. Create a Supabase project in the production region closest to users.
2. In **Authentication → Providers**, enable Email and Password. Keep email
   confirmation enabled for production.
3. In **Authentication → URL Configuration** set:
   - Site URL: `https://trysushi.xyz`
   - Redirect URLs:
     - `http://localhost:3004/auth/callback`
     - `https://trysushi.xyz/auth/callback`
     - `https://www.trysushi.xyz/auth/callback`
     - the exact Vercel preview wildcard displayed for the project, if previews are used.
4. Copy the **Project URL** and **Publishable key** from **Project Settings → API**.
   Do not use or expose the service-role key in this application.
5. Copy the Postgres connection string from **Project Settings → Database** for
   the backend. Use the connection format recommended by Supabase for the
   backend host and `asyncpg`.

## 2. Environment variables

Set these in Vercel for the frontend (Root Directory: `frontend`):

```text
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_SITE_URL=https://trysushi.xyz
NEXT_PUBLIC_API_URL=/api
BACKEND_URL=https://<your-api-host>
```

Set these in the backend host (Render or Railway):

```text
ENVIRONMENT=production
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
DATABASE_URL=postgresql+asyncpg://...
ALLOWED_ORIGINS=https://trysushi.xyz,https://www.trysushi.xyz
```

Retain the existing R2, Redis, retention, and Anthropic variables as needed.
`DATABASE_URL` is required for persistent user records, datasets, analyses,
and share links. The backend creates its application tables on startup; do not
put application tables in Supabase's `auth` schema.

## 3. Vercel and domain

1. Import the GitHub repository into Vercel with `frontend` as the Root
   Directory, add the frontend environment variables, then deploy.
2. In **Project → Settings → Domains**, add both `trysushi.xyz` and
   `www.trysushi.xyz`. Make the apex domain canonical and redirect `www`, or
   choose the reverse deliberately.
3. At the domain registrar, add the exact records Vercel displays after adding
   the domain. Typically the apex uses an A record and `www` a CNAME, but the
   Vercel inspection result is authoritative.
4. Wait for Vercel to issue SSL, then confirm both HTTPS origins resolve.
5. Deploy the backend after adding its environment variables. Its CORS allow
   list must include the canonical and redirect host while the redirect is
   being verified.

## 4. Acceptance checks

1. Sign up at `https://trysushi.xyz/sign-up` and confirm the email link.
2. Sign in and upload a supported file; ensure the report and dataset library
   are private to that account.
3. Open the sample report while signed out; it remains public.
4. Sign out, then confirm an upload requires sign-in.
5. Use a private browser to verify a public share link and an expired link.
6. Check backend logs for rejected/expired bearer tokens and CORS errors.
