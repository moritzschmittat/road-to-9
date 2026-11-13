// Road to 9 · admin function (Supabase Edge Function "admin").
// Runs on Supabase's servers, never in a browser: it holds the master key and checks that the
// caller is signed in as one of the admin emails (secret ADMIN_EMAILS, comma separated) before
// doing anything. It returns account details only, never anyone's ratings, sessions or notes.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

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
      const { data: inv } = await svc.from("invites").select("inviter, invitee");
      const emailOf = new Map(users.map((u) => [u.id, u.email]));
      const invitedBy = new Map((inv ?? []).filter((i) => i.invitee).map((i) => [i.invitee, emailOf.get(i.inviter) ?? "a removed student"]));
      const sentBy = new Map<string, number>();
      for (const i of inv ?? []) sentBy.set(i.inviter, (sentBy.get(i.inviter) ?? 0) + 1);
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

    case "invite": {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (!EMAIL.test(email)) return reply({ error: "That doesn't look like an email address." }, 400);
      if (body.parentOk !== true) return reply({ error: "Confirm that a parent or carer has agreed." }, 400);
      const { error } = await svc.auth.admin.inviteUserByEmail(email, {
        redirectTo: SITE,
        data: { parent_ok_at: new Date().toISOString() },
      });
      if (error) {
        const msg = /already been registered/i.test(error.message) ? "That email already has an account." : error.message;
        return reply({ error: msg }, 400);
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
