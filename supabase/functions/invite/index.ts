// Road to 9 · friend invites (Supabase Edge Function "invite").
// Every student who has joined can invite up to 3 friends. Runs on Supabase's servers: it holds the
// master key, checks who is calling, counts their invites and sends the invite email.
// The friend's email only shows the inviter's first name (or "A friend"), nothing else.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const PER_STUDENT = 3;
const ORIGINS = ["https://roadto9.com", "https://www.roadto9.com"];
const SITE = "https://roadto9.com/";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function headers(origin: string) {
  return {
    "Access-Control-Allow-Origin": ORIGINS.includes(origin) ? origin : ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function masterKey() {
  try {
    const keys = Object.values(JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}"));
    if (keys.length) return keys[0] as string;
  } catch { /* fall back */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

Deno.serve(async (req) => {
  const h = headers(req.headers.get("origin") ?? "");
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...h, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return reply({ error: "Use POST." }, 405);

  const master = masterKey();
  if (!master) return reply({ error: "Server key missing." }, 500);
  const svc = createClient(Deno.env.get("SUPABASE_URL")!, master, { auth: { persistSession: false, autoRefreshToken: false } });
  const admins = (Deno.env.get("ADMIN_EMAILS") ?? "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return reply({ error: "Not signed in." }, 401);
  const { data: { user }, error: authErr } = await svc.auth.getUser(token);
  if (authErr || !user || !user.email_confirmed_at) return reply({ error: "Not signed in." }, 401);
  const isAdmin = admins.includes((user.email ?? "").toLowerCase());

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply({ error: "Bad request." }, 400); }

  const { data: mine, error: listErr } = await svc.from("invites")
    .select("id, email, invitee, created_at").eq("inviter", user.id).order("created_at");
  if (listErr) return reply({ error: listErr.message }, 500);
  const limit = isAdmin ? null : PER_STUDENT;
  const left = limit === null ? null : Math.max(0, limit - (mine ?? []).length);

  if (body.action === "status") {
    const invites = [];
    for (const i of mine ?? []) {
      let joined = false;
      if (i.invitee) {
        const { data } = await svc.auth.admin.getUserById(i.invitee);
        joined = !!data.user?.email_confirmed_at;
      }
      invites.push({ email: i.email, joined, invited_at: i.created_at });
    }
    return reply({ limit, left, invites });
  }

  if (body.action === "invite") {
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!EMAIL.test(email)) return reply({ error: "That doesn't look like an email address." }, 400);
    if (email === (user.email ?? "").toLowerCase()) return reply({ error: "That's your own email." }, 400);
    if (left !== null && left <= 0) return reply({ error: `You've used all ${PER_STUDENT} of your invites.` }, 400);

    // The friend's email says who invited them: first name only.
    const { data: row } = await svc.from("progress").select("name:doc->settings->>name").eq("user_id", user.id).maybeSingle();
    const name = String(row?.name ?? "").replace(/[^\p{L}\p{M}' -]/gu, "").trim().slice(0, 30) || "A friend";

    const { data, error } = await svc.auth.admin.inviteUserByEmail(email, {
      redirectTo: SITE,
      data: { invited_by_name: name },
    });
    if (error) {
      // An invite that doesn't go out doesn't use up one of theirs.
      if (/already been registered/i.test(error.message)) return reply({ error: "That person is already on Road to 9." }, 400);
      return reply({ error: "Couldn't send the invite. Try again later." }, 400);
    }
    const { error: insErr } = await svc.from("invites").insert({ inviter: user.id, email, invitee: data.user?.id ?? null });
    if (insErr) return reply({ error: insErr.message }, 500);
    return reply({ ok: true, left: left === null ? null : left - 1 });
  }

  return reply({ error: "Unknown action." }, 400);
});
