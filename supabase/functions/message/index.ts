// Road to 9 · messages from students to Road to 9 (Supabase Edge Function "message").
// Saves the message for the admin page and, if SMTP_PASS is set, emails it to hello@roadto9.com
// through SiteGround. Students can send 5 messages a day at most.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import nodemailer from "npm:nodemailer@6.9.14";

const ORIGINS = ["https://roadto9.com", "https://www.roadto9.com"];
const TO = "hello@roadto9.com";

function headers(origin: string) {
  return {
    "Access-Control-Allow-Origin": ORIGINS.includes(origin) ? origin : ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
function masterKey() {
  try { const k = Object.values(JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}")); if (k.length) return k[0] as string; } catch { /* */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

Deno.serve(async (req) => {
  const h = headers(req.headers.get("origin") ?? "");
  const reply = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...h, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return reply({ error: "Use POST." }, 405);

  const svc = createClient(Deno.env.get("SUPABASE_URL")!, masterKey(), { auth: { persistSession: false, autoRefreshToken: false } });
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: { user } } = token ? await svc.auth.getUser(token) : { data: { user: null } };
  if (!user || !user.email_confirmed_at) return reply({ error: "Please sign in first." }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply({ error: "Bad request." }, 400); }
  const text = String(body.text ?? "").trim().slice(0, 1000);
  const topic = ["subject", "other"].includes(String(body.topic)) ? String(body.topic) : "subject";
  if (!text) return reply({ error: "Type your message first." }, 400);

  const since = new Date(Date.now() - 864e5).toISOString();
  const { count } = await svc.from("messages").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since);
  if ((count ?? 0) >= 5) return reply({ error: "You've sent 5 messages today. Try again tomorrow." }, 429);

  const { error } = await svc.from("messages").insert({ user_id: user.id, email: user.email, topic, body: text });
  if (error) return reply({ error: "Couldn't send. Try again later." }, 500);

  const pass = Deno.env.get("SMTP_PASS");
  if (pass) {
    try {
      const mail = nodemailer.createTransport({ host: Deno.env.get("SMTP_HOST") ?? "gukm1088.siteground.biz", port: 465, secure: true, auth: { user: TO, pass } });
      await mail.sendMail({
        from: `"Road to 9" <${TO}>`, to: TO, replyTo: user.email ?? undefined,
        subject: topic === "subject" ? "Road to 9: missing subject request" : "Road to 9: message from a student",
        text: `From: ${user.email}\n\n${text}\n\n(Also listed on roadto9.com/admin.html)`,
      });
    } catch (e) { console.error("mail failed", e); } // the message is saved either way
  }
  return reply({ ok: true });
});
