// Road to 9 · friend invites (Supabase Edge Function "invite").
// Every student has 3 one-use invite links. They pass a link on themselves (WhatsApp, text, in person).
// The friend opens it, types their own email and asks for a sign-in link. Road to 9 never emails anyone
// on someone else's say-so and never stores a friend's address before the friend gives it.
// Runs on Supabase's servers: it holds the master key; the website never does.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const PER_STUDENT = 3;
const ORIGINS = ["https://roadto9.com", "https://www.roadto9.com"];
const SITE = "https://roadto9.com/";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 characters: no 0/O or 1/I mix-ups
const CODE = /^[A-Z2-9]{5}-[A-Z2-9]{5}$/;

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

// 10 random characters (50 bits): guessing a valid code is not practical.
function newCode() {
  const b = crypto.getRandomValues(new Uint8Array(10));
  const s = Array.from(b, (x) => ALPHABET[x % 32]).join("");
  return s.slice(0, 5) + "-" + s.slice(5);
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

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply({ error: "Bad request." }, 400); }

  const firstName = async (uid: string) => {
    const { data } = await svc.from("progress").select("name:doc->settings->>name").eq("user_id", uid).maybeSingle();
    return String(data?.name ?? "").replace(/[^\p{L}\p{M}\p{N}' ._-]/gu, "").trim().slice(0, 30);
  };
  const findCode = async (raw: unknown) => {
    const code = String(raw ?? "").trim().toUpperCase();
    if (!CODE.test(code)) return null;
    const { data } = await svc.from("invites").select("id, inviter, used_at").eq("code", code).maybeSingle();
    return data;
  };

  // ---- For the friend who opened a link (not signed in) ----
  if (body.action === "peek") {
    const inv = await findCode(body.code);
    if (!inv || inv.used_at) return reply({ error: "This invite link has already been used or isn't valid. Ask your friend for another one." }, 404);
    return reply({ ok: true, from: (await firstName(inv.inviter)) || null });
  }

  if (body.action === "claim") {
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!EMAIL.test(email)) return reply({ error: "That doesn't look like an email address." }, 400);
    if (body.over13 !== true) return reply({ error: "Road to 9 is for students aged 13 and over." }, 400);
    const inv = await findCode(body.code);
    if (!inv || inv.used_at) return reply({ error: "This invite link has already been used or isn't valid. Ask your friend for another one." }, 404);
    // Reserve the link first so two people can't use it at once.
    const { data: held } = await svc.from("invites").update({ used_at: new Date().toISOString() })
      .eq("id", inv.id).is("used_at", null).select("id");
    if (!held?.length) return reply({ error: "This invite link has just been used. Ask your friend for another one." }, 409);
    const name = await firstName(inv.inviter);
    // The friend asked for this email themselves, on this page.
    const { data, error } = await svc.auth.admin.inviteUserByEmail(email, {
      redirectTo: SITE,
      data: { invited_by_name: name || null, said_over_13_at: new Date().toISOString() },
    });
    if (error) {
      await svc.from("invites").update({ used_at: null }).eq("id", inv.id); // give the link back
      if (/already been registered/i.test(error.message)) return reply({ error: "That email is already on Road to 9. Sign in on the main page instead." }, 400);
      return reply({ error: "Couldn't send your link. Try again in a minute." }, 400);
    }
    await svc.from("invites").update({ invitee: data.user?.id ?? null }).eq("id", inv.id);
    return reply({ ok: true });
  }

  // ---- For a signed-in student: their own links ----
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: { user } } = token ? await svc.auth.getUser(token) : { data: { user: null } };
  if (!user || !user.email_confirmed_at) return reply({ error: "Not signed in." }, 401);
  const isAdmin = admins.includes((user.email ?? "").toLowerCase());

  const list = async () => {
    const { data } = await svc.from("invites").select("code, used_at, created_at").eq("inviter", user.id).order("created_at");
    return (data ?? []).filter((i) => i.code);
  };

  if (body.action === "status" || body.action === "more") {
    let mine = await list();
    // Everyone gets 3 links in total, made the first time they look. Admins can make more.
    const want = body.action === "more" && isAdmin ? mine.length + 1 : Math.max(mine.length, PER_STUDENT);
    if (want > mine.length) {
      const rows = Array.from({ length: want - mine.length }, () => ({ inviter: user.id, code: newCode() }));
      const { error } = await svc.from("invites").insert(rows);
      if (error) return reply({ error: "Couldn't make your invite links. Try again." }, 500);
      mine = await list();
    }
    return reply({ admin: isAdmin, links: mine.map((i) => ({ code: i.code, used: !!i.used_at })) });
  }

  return reply({ error: "Unknown action." }, 400);
});
