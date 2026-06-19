# Demo Mode — Shared Seeded Workspace

Every visitor lands on the dashboard already signed in as a fixed **demo user** that owns a single shared **demo organization**. That org is pre-populated with random but realistic data (locations, contacts, reviews, campaigns, feedback, notifications), so all pages — Dashboard, Analytics, Reviews, Contacts, Campaigns, Feedback, Insights, Locations, etc. — render meaningful content immediately.

Anyone hitting the site shares the same workspace and can interact with it. A nightly reseed keeps it fresh.

## What you'll see

- Open the site → spinner for ~1s → land directly on `/dashboard` with charts, reviews, and stats populated
- Every nav item works (no gates, no paywalls — that's already done)
- Reviews feed shows ~60 randomly generated reviews across Google / Facebook / Yelp / Apple Maps with varied ratings, sentiment, and dates over the last 90 days
- Contacts page lists ~40 fake customers with names, emails, phone numbers
- Campaigns page shows 3 sample SMS/email campaigns with recipient stats
- Feedback page shows a handful of low-rating responses with text
- Analytics renders real charts off the seeded data
- A small "DEMO MODE — shared workspace" banner stays visible

## How it works (technical)

### 1. New edge function `demo-bootstrap` (public, no JWT)
- Uses service role to:
  - Create demo user `demo@maximumsocial.app` with a fixed random password on first call (idempotent — won't recreate if it exists)
  - Returns `{ email, password }` to the client
- The fixed user ID + org ID are stored as edge-function constants so seeding can target them.

### 2. New edge function `demo-seed` (also service role)
- Wipes and re-inserts seed data for the demo org:
  - 2 locations (`Maximum Social — Downtown`, `Maximum Social — Westside`)
  - ~40 contacts with faker-style random names/emails/phones
  - ~60 reviews spread over the last 90 days across 4 sources, ratings weighted 4–5★ majority, with sentiment populated
  - 3 campaigns with 10–15 campaign_recipients each, some marked sent/responded/routed
  - ~8 feedback_responses (1–3 star with feedback text)
  - 5 notifications
- Called once at deploy time by the bootstrap function if the org is empty, plus exposed for a manual "reset demo data" trigger later.

### 3. Client auto-login (`AuthContext` or a new `DemoAutoLogin` wrapper)
- On app mount: if no session, call `demo-bootstrap`, then `supabase.auth.signInWithPassword` with the returned creds
- Show a full-screen loader during this bootstrap
- After sign-in, the existing AuthContext + useOrganization hooks just work — RLS lets the demo user read its own org's data

### 4. Banner
- Add a persistent top banner: "🎭 Demo workspace — data is shared and resets nightly." Dismissible per-session.

### 5. Cron reseed (optional, can skip if you want it static)
- Schedule `demo-seed` to run daily at 04:00 UTC via a `cron-` style edge function entry. **I'll skip this unless you say otherwise** — keeps things simple; reseed can be a manual button on `/super-admin/demo`.

## Files changed / added

- `supabase/functions/demo-bootstrap/index.ts` — new
- `supabase/functions/demo-seed/index.ts` — new
- `src/contexts/AuthContext.tsx` — add auto-demo-login on mount when no session
- `src/components/DemoBanner.tsx` — new, mounted in App
- `src/App.tsx` — mount banner, remove the `/auth` redirect since we never want users hitting auth anymore (already done — keep as is)
- Migration: no schema changes needed. All seed data goes through the edge function using the existing tables.

## Out of scope

- Per-visitor isolated demo workspaces (would need anonymous auth — not enabled, and adds a lot of complexity)
- Real SMS/email sending from demo (edge functions are already stubbed in sandbox mode)
- Persisting visitor changes beyond the next reseed

## Risks / notes

- All visitors share one workspace, so one visitor's edits are visible to everyone until reseed. If that's a problem, switch to option 3 from earlier.
- The demo user's password is exposed via the bootstrap endpoint (by design — it's a public demo). If anyone signs in elsewhere with it they only access the demo org.
