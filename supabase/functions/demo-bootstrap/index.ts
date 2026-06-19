// Public, no-auth bootstrap for the shared demo workspace.
// Creates (idempotent) a fixed demo user, ensures their org has an active
// "founder" subscription (so trigger-based plan limits don't block seeding),
// and on first run seeds the org with randomized realistic data so every
// page of the app renders meaningful content.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const DEMO_EMAIL = "demo@maximumsocial.app";
const DEMO_PASSWORD = "demo-mode-public-2026!";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// ── Random data helpers ────────────────────────────────────────────────────
const FIRST = ["Alex","Jordan","Taylor","Morgan","Riley","Casey","Avery","Jamie","Sam","Drew","Quinn","Reese","Skyler","Cameron","Hayden","Parker","Rowan","Sage","Blair","Emerson","Finley","Harper","Indigo","Kai","Lennon","Marley","Nova","Oakley","Phoenix","River","Sasha","Tatum","Wren","Zion","Maya","Leo","Ivy","Asher","Luna","Eli"];
const LAST = ["Carter","Hayes","Mendez","Patel","Nguyen","O'Brien","Kim","Reyes","Singh","Walker","Foster","Bennett","Brooks","Diaz","Edwards","Fischer","Garcia","Hughes","Iverson","Johnson","Klein","Lopez","Martinez","Novak","Owens","Price","Quinn","Roberts","Sanders","Turner","Vance","Wright","Young","Zhao","Adler","Bishop","Cole","Dawson","Ellis","Flynn"];
const POSITIVE = [
  "Absolutely fantastic experience — staff went above and beyond.",
  "Best in town! Will be back next weekend.",
  "Quick service, friendly team, and the quality is unmatched.",
  "Five stars. Truly impressed by how polished everything was.",
  "My new favorite spot. Atmosphere is incredible.",
  "Loved every minute. The attention to detail is wild.",
  "Couldn't recommend more highly — top tier.",
  "Came in skeptical, left a fan. So good.",
];
const NEUTRAL = [
  "Decent overall. A few things could be smoother but nothing major.",
  "It was fine. Nothing wowed me but nothing to complain about.",
  "Average experience. Might come back, might not.",
  "Okay — staff were nice, the wait was a bit long.",
];
const NEGATIVE = [
  "Waited 30 minutes before anyone acknowledged me. Disappointing.",
  "Quality has slipped. Used to be better last year.",
  "Staff seemed overwhelmed and uninterested. Not coming back.",
  "Order was wrong twice. Frustrating visit.",
];
const SOURCES = ["google","facebook","yelp","trustpilot","instagram"];

const rand = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pickRating = () => {
  const r = Math.random();
  if (r < 0.62) return 5;
  if (r < 0.84) return 4;
  if (r < 0.92) return 3;
  if (r < 0.97) return 2;
  return 1;
};
const sentimentFor = (r: number) => (r >= 4 ? "positive" : r <= 2 ? "negative" : "neutral");
const textFor = (r: number) =>
  r >= 4 ? rand(POSITIVE) : r <= 2 ? rand(NEGATIVE) : rand(NEUTRAL);
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

async function getOrCreateDemoUser(): Promise<string> {
  // Try to find existing user
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const found = list?.users?.find((u) => u.email?.toLowerCase() === DEMO_EMAIL);
  if (found) return found.id;

  const { data: created, error } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Demo User", company_name: "Maximum Social Demo" },
  });
  if (error || !created.user) throw new Error(`createUser: ${error?.message}`);
  return created.user.id;
}

async function getOrgIdForUser(userId: string): Promise<string> {
  const { data, error } = await admin
    .from("user_organizations")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data?.organization_id) return data.organization_id;
  // Fallback: handle_new_user trigger should have created one. Create one if not.
  const { data: org, error: oerr } = await admin
    .from("organizations")
    .insert({ name: "Maximum Social Demo" })
    .select("id")
    .single();
  if (oerr) throw oerr;
  await admin
    .from("user_organizations")
    .insert({ user_id: userId, organization_id: org.id, role: "owner" });
  return org.id;
}

async function ensureFounderSubscription(orgId: string, userId: string) {
  const { data: existing } = await admin
    .from("subscriptions")
    .select("id")
    .eq("organization_id", orgId)
    .eq("status", "active")
    .maybeSingle();
  if (existing) return;
  await admin.from("subscriptions").insert({
    organization_id: orgId,
    user_id: userId,
    environment: "sandbox",
    plan_tier: "founder",
    status: "active",
    current_period_end: new Date(Date.now() + 365 * 86400000).toISOString(),
  });
}

async function seedDemoData(orgId: string, userId: string) {
  // Wipe existing data
  await admin.from("feedback_responses").delete().eq("organization_id", orgId);
  await admin.from("campaign_recipients").delete().eq("organization_id", orgId);
  await admin.from("campaigns").delete().eq("organization_id", orgId);
  await admin.from("reviews").delete().eq("organization_id", orgId);
  await admin.from("contacts").delete().eq("organization_id", orgId);
  await admin.from("locations").delete().eq("organization_id", orgId);
  await admin.from("notifications").delete().eq("organization_id", orgId);

  // Locations
  const { data: locations, error: locErr } = await admin
    .from("locations")
    .insert([
      {
        organization_id: orgId,
        name: "Maximum Social — Downtown",
        address: "123 Main St, Austin, TX",
        google_review_url: "https://g.page/r/demo-downtown/review",
        is_primary: true,
      },
      {
        organization_id: orgId,
        name: "Maximum Social — Westside",
        address: "880 Lakeview Blvd, Austin, TX",
        google_review_url: "https://g.page/r/demo-westside/review",
        is_primary: false,
      },
    ])
    .select("id");
  if (locErr) throw locErr;
  const locIds = locations!.map((l) => l.id);

  // Contacts (40)
  const contactRows = Array.from({ length: 40 }).map((_, i) => {
    const first = rand(FIRST);
    const last = rand(LAST);
    return {
      organization_id: orgId,
      name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase().replace("'", "")}${i}@example.com`,
      phone: `+1512${String(randInt(2000000, 9999999)).padStart(7, "0")}`,
      sms_opt_in: Math.random() > 0.3,
      sms_opted_in_at: Math.random() > 0.3 ? daysAgo(randInt(1, 120)) : null,
      location_id: rand(locIds),
    };
  });
  const { data: contacts, error: cerr } = await admin
    .from("contacts")
    .insert(contactRows)
    .select("id, name, email, phone, location_id");
  if (cerr) throw cerr;

  // Reviews (60)
  const reviewRows = Array.from({ length: 60 }).map(() => {
    const rating = pickRating();
    const first = rand(FIRST);
    const last = rand(LAST);
    return {
      organization_id: orgId,
      location_id: rand(locIds),
      source: rand(SOURCES),
      author_name: `${first} ${last[0]}.`,
      rating,
      text: textFor(rating),
      sentiment: sentimentFor(rating),
      review_date: daysAgo(randInt(0, 90)),
    };
  });
  await admin.from("reviews").insert(reviewRows);

  // Campaigns (3) + recipients
  const campaignDefs = [
    { name: "Spring Reactivation",  channel: "email", status: "sent",     daysOffset: -10 },
    { name: "Westside VIP Push",    channel: "sms",   status: "sent",     daysOffset: -5  },
    { name: "Weekend Follow-Ups",   channel: "email", status: "scheduled", daysOffset: 2  },
  ];
  for (const c of campaignDefs) {
    const { data: camp, error: caerr } = await admin
      .from("campaigns")
      .insert({
        organization_id: orgId,
        name: c.name,
        subject: "How was your experience?",
        message_body: "Hey {{name}}, thanks for stopping by — would love your quick feedback!",
        channel: c.channel,
        status: c.status,
        scheduled_at: daysAgo(-c.daysOffset),
        created_by: userId,
      })
      .select("id")
      .single();
    if (caerr) throw caerr;
    const sample = contacts!.slice(0, randInt(10, 15));
    const recRows = sample.map((ct) => {
      const sent = c.status === "sent";
      const responded = sent && Math.random() > 0.45;
      const rating = responded ? pickRating() : null;
      return {
        campaign_id: camp.id,
        contact_id: ct.id,
        organization_id: orgId,
        location_id: ct.location_id,
        phone: ct.phone,
        send_status: sent ? "sent" : "pending",
        sent_at: sent ? daysAgo(-c.daysOffset + randInt(0, 2)) : null,
        rating,
        rating_submitted_at: responded ? daysAgo(-c.daysOffset + randInt(0, 3)) : null,
        routed_to: responded ? (rating! >= 4 ? "google" : "feedback") : null,
      };
    });
    await admin.from("campaign_recipients").insert(recRows);
  }

  // Feedback responses (8 low-rating)
  const fbRows = Array.from({ length: 8 }).map(() => {
    const rating = randInt(1, 3);
    return {
      organization_id: orgId,
      rating,
      feedback: rating <= 2 ? rand(NEGATIVE) : rand(NEUTRAL),
      contact_email: `customer${randInt(1, 999)}@example.com`,
      contact_name: `${rand(FIRST)} ${rand(LAST)}`,
    };
  });
  await admin.from("feedback_responses").insert(fbRows);

  // Notifications (5)
  const notifRows = Array.from({ length: 5 }).map(() => ({
    organization_id: orgId,
    user_id: userId,
    kind: "low_rating",
    title: "New low rating received",
    body: `${rand(FIRST)} left a ${randInt(1, 3)}★ rating`,
    link: "/feedback",
  }));
  await admin.from("notifications").insert(notifRows);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const reseed = url.searchParams.get("reseed") === "1";

    const userId = await getOrCreateDemoUser();
    const orgId = await getOrgIdForUser(userId);
    await ensureFounderSubscription(orgId, userId);

    // Seed if empty (or forced)
    const { count } = await admin
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId);
    if (reseed || (count ?? 0) === 0) {
      await seedDemoData(orgId, userId);
    }

    return new Response(
      JSON.stringify({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        userId,
        orgId,
        seeded: reseed || (count ?? 0) === 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("demo-bootstrap error", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
