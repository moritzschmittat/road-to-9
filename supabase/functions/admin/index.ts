// Road to 9 · admin function (Supabase Edge Function "admin").
// Runs on Supabase's servers, never in a browser: it holds the master key and checks that the
// caller is signed in as one of the admin emails (secret ADMIN_EMAILS, comma separated) before
// doing anything. It returns account details only, never anyone's ratings, sessions or notes.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const ORIGINS = ["https://roadto9.com", "https://www.roadto9.com"];
const SITE = "https://roadto9.com/";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // same codes as the friend invite links
function newCode() {
  const b = crypto.getRandomValues(new Uint8Array(10));
  const s = Array.from(b, (x) => ALPHABET[x % 32]).join("");
  return s.slice(0, 5) + "-" + s.slice(5);
}

function headers(origin: string) {
  return {
    "Access-Control-Allow-Origin": ORIGINS.includes(origin) ? origin : ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const h = headers(req.headers.get("origin") ?? "");
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...h, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return reply({ error: "Use POST." }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  let master = "";
  try { master = (Object.values(JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}"))[0] as string) ?? ""; } catch { /* fall back */ }
  if (!master) master = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!master) return reply({ error: "Server key missing." }, 500);
  const admins = (Deno.env.get("ADMIN_EMAILS") ?? "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  const svc = createClient(url, master, { auth: { persistSession: false, autoRefreshToken: false } });

  // Who is calling? Ask the auth server; a forged or expired token fails here.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return reply({ error: "Not signed in." }, 401);
  const { data: { user }, error: authErr } = await svc.auth.getUser(token);
  if (authErr || !user) return reply({ error: "Not signed in." }, 401);
  if (!user.email || !user.email_confirmed_at || !admins.includes(user.email.toLowerCase())) {
    return reply({ error: "Not allowed." }, 403);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply({ error: "Bad request." }, 400); }

  // Put a planner file (exported from Road to 9) into a student's account before they first sign in,
  // so their plan is waiting for them. Never overwrites: only for an account with nothing saved yet.
  // The terms tick is left out on purpose: the student agrees to the terms themselves on first sign-in.
  const seed = async (uid: string, raw: unknown): Promise<string | null> => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "That file isn't a Road to 9 planner.";
    const doc = { ...(raw as Record<string, unknown>) };
    delete doc.app; delete doc.exportedAt;
    const st = doc.settings as Record<string, unknown> | undefined;
    if (!st || typeof st !== "object" || !doc.cards || typeof doc.cards !== "object" || !Array.isArray(doc.log)) return "That file isn't a Road to 9 planner.";
    doc.settings = { ...st, onboarded: true, ob: { step: "done", i: 0 } };
    delete (doc.settings as Record<string, unknown>).terms;
    if (JSON.stringify(doc).length > 1_900_000) return "That file is too big.";
    const { data: ex } = await svc.from("progress").select("user_id").eq("user_id", uid).maybeSingle();
    if (ex) return "They already have a planner saved, so nothing was changed.";
    const { error } = await svc.from("progress").insert({ user_id: uid, doc });
    return error ? error.message : null;
  };

  switch (body.action) {
    case "list": {
      const users = [];
      for (let page = 1; ; page++) {
        const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) return reply({ error: error.message }, 500);
        users.push(...data.users);
        if (data.users.length < 1000) break;
      }
      // Only the first name, "finished setup" and the time of the last save. Nothing else from the planner.
      const { data: rows, error } = await svc.from("progress")
        .select("user_id, name:doc->settings->>name, onboarded:doc->settings->>onboarded, updated_at");
      if (error) return reply({ error: error.message }, 500);
      const byId = new Map((rows ?? []).map((r) => [r.user_id, r]));
      // Who invited whom (friend invites). Admin invites have no row here.
      const { data: inv } = await svc.from("invites").select("inviter, invitee, used_at");
      const emailOf = new Map(users.map((u) => [u.id, u.email]));
      const invitedBy = new Map((inv ?? []).filter((i) => i.invitee).map((i) => [i.invitee, emailOf.get(i.inviter) ?? "a removed student"]));
      const sentBy = new Map<string, number>();
      for (const i of inv ?? []) if (i.used_at) sentBy.set(i.inviter, (sentBy.get(i.inviter) ?? 0) + 1);
      return reply({
        me: user.id,
        users: users.map((u) => {
          const r = byId.get(u.id);
          return {
            id: u.id,
            email: u.email,
            invited_at: u.invited_at ?? u.created_at,
            joined: !!u.email_confirmed_at,
            last_sign_in_at: u.last_sign_in_at ?? null,
            parent_ok_at: u.user_metadata?.parent_ok_at ?? null,
            name: r?.name ?? null,
            onboarded: r?.onboarded === "true",
            last_saved_at: r?.updated_at ?? null,
            admin: admins.includes((u.email ?? "").toLowerCase()),
            invited_by: invitedBy.get(u.id) ?? null,
            invites_sent: sentBy.get(u.id) ?? 0,
          };
        }),
      });
    }

    case "totals": {
      // Study time for everyone together. Totals only, never per student.
      const { data, error } = await svc.rpc("study_totals");
      if (error) return reply({ error: error.message }, 500);
      return reply((data ?? [])[0] ?? { today_min: 0, week_min: 0, ever_min: 0, students: 0 });
    }

    case "messages": {
      const { data, error } = await svc.from("messages").select("id, email, topic, body, created_at, done_at").order("created_at", { ascending: false }).limit(200);
      if (error) return reply({ error: error.message }, 500);
      return reply({ messages: data ?? [] });
    }

    case "done": {
      const { error } = await svc.from("messages").update({ done_at: body.undo ? null : new Date().toISOString() }).eq("id", Number(body.id));
      if (error) return reply({ error: error.message }, 400);
      return reply({ ok: true });
    }

    case "invite": {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (!EMAIL.test(email)) return reply({ error: "That doesn't look like an email address." }, 400);
      // with a planner file: check it before anyone gets an email
      if (body.doc !== undefined && (!body.doc || typeof body.doc !== "object" || !(body.doc as Record<string, unknown>).settings)) {
        return reply({ error: "That file isn't a Road to 9 planner." }, 400);
      }
      const { data, error } = await svc.auth.admin.inviteUserByEmail(email, {
        redirectTo: SITE,
      });
      if (error) {
        const msg = /already been registered/i.test(error.message) ? "That email already has an account." : error.message;
        return reply({ error: msg }, 400);
      }
      if (body.doc !== undefined && data.user) {
        const e = await seed(data.user.id, body.doc);
        if (e) return reply({ ok: true, seedError: e });
        return reply({ ok: true, seeded: true });
      }
      return reply({ ok: true });
    }

    case "resend": {
      const { data, error } = await svc.auth.admin.getUserById(String(body.id ?? ""));
      if (error || !data.user?.email) return reply({ error: "No such user." }, 404);
      if (data.user.email_confirmed_at) return reply({ error: "They've already joined, so they can sign in with their email on roadto9.com." }, 400);
      const { error: e2 } = await svc.auth.admin.inviteUserByEmail(data.user.email, { redirectTo: SITE });
      if (e2) return reply({ error: e2.message }, 400);
      return reply({ ok: true });
    }

    case "seed": {
      const id = String(body.id ?? "");
      const { data, error } = await svc.auth.admin.getUserById(id);
      if (error || !data.user) return reply({ error: "No such user." }, 404);
      const e = await seed(id, body.doc);
      if (e) return reply({ error: e }, 400);
      return reply({ ok: true });
    }

    case "codes": {
      // A batch of one-use invite links owned by the admin, shown on the admin page to copy.
      const n = Math.min(100, Math.max(1, Math.floor(Number(body.count ?? 50)) || 50));
      const rows = Array.from({ length: n }, () => ({ inviter: user.id, code: newCode() }));
      const { error } = await svc.from("invites").insert(rows);
      if (error) return reply({ error: "Couldn't make the links: " + error.message }, 500);
      const links = rows.map((r) => `${SITE}?join=${r.code}`);
      return reply({ ok: true, links });
    }

    case "remove": {
      const id = String(body.id ?? "");
      if (id === user.id) return reply({ error: "You can't remove your own admin account here." }, 400);
      // Deleting the login also deletes their planner row (on delete cascade).
      const { error } = await svc.auth.admin.deleteUser(id);
      if (error) return reply({ error: error.message }, 400);
      return reply({ ok: true });
    }

    default:
      return reply({ error: "Unknown action." }, 400);
  }
});
