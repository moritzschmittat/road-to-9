// Road to 9 · nightly backup (Supabase Edge Function "backup").
// Returns ONE encrypted file with everything needed to rebuild Road to 9: every planner, every account
// (email and dates, no passwords exist), every invite link, the study groups and students' messages. A Google Apps Script in Moritz's Drive
// fetches it each night. The file is unreadable without BACKUP_KEY, which only Moritz holds.
//
// File format (.r9b): "R9B1" | 16-byte salt | 12-byte IV | AES-256-GCM ciphertext of gzip(JSON)
// Key = PBKDF2-SHA256(BACKUP_KEY, salt, 210000 iterations). tools/backup_decrypt.py opens it.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import nodemailer from "npm:nodemailer@6.9.14";

const ITERATIONS = 210000;
const DAY = 864e5;
const KEEP_DAYS = 365;     // accounts unused for 12 months are deleted...
const WARN_DAYS = 14;      // ...after a warning email two weeks before
const MAX_DELETE = 20;     // safety: never more than this in one night; more means something is wrong, so nothing is deleted
const SITE = "https://roadto9.com/";

// After the nightly backup: warn, then delete, accounts nobody has used for 12 months.
// "Used" = the latest of: account created, last sign-in, last save of the planner, last time the app was open.
// Admin accounts are never touched. Deleting the login deletes the planner too (on delete cascade).
// The backup taken just before still holds them for 30 days, in case of a mistake.
// deno-lint-ignore no-explicit-any
async function tidy(svc: any, users: any[], progress: any[]) {
  const admins = (Deno.env.get("ADMIN_EMAILS") ?? "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  const { data: pres } = await svc.from("presence").select("user_id, seen_at");
  const seen = new Map((pres ?? []).map((p: { user_id: string; seen_at: string }) => [p.user_id, p.seen_at]));
  const saved = new Map(progress.map((p: { user_id: string; updated_at: string }) => [p.user_id, p.updated_at]));
  const now = Date.now();
  const toWarn: typeof users = [], toDelete: typeof users = [];
  for (const u of users) {
    if (!u.email || admins.includes(u.email.toLowerCase())) continue;
    const last = Math.max(...[u.created_at, u.last_sign_in_at, saved.get(u.id), seen.get(u.id)].filter(Boolean).map((d) => Date.parse(d as string)));
    if (!Number.isFinite(last)) continue;
    const idle = (now - last) / DAY;
    const warned = u.app_metadata?.inactive_warned_at ? Date.parse(u.app_metadata.inactive_warned_at) : 0;
    const warnedSinceLastUse = warned > last;
    if (idle >= KEEP_DAYS && warnedSinceLastUse && (now - warned) / DAY >= WARN_DAYS) toDelete.push(u);
    else if (idle >= KEEP_DAYS - WARN_DAYS && !warnedSinceLastUse) toWarn.push(u);
  }
  if (toDelete.length > MAX_DELETE) { console.error(`tidy: ${toDelete.length} accounts due for deletion, more than ${MAX_DELETE}; nothing deleted`); return; }

  const pass = Deno.env.get("SMTP_PASS");
  const mail = pass ? nodemailer.createTransport({ host: Deno.env.get("SMTP_HOST") ?? "gukm1088.siteground.biz", port: 465, secure: true, auth: { user: "hello@roadto9.com", pass } }) : null;
  for (const u of toWarn) {
    if (!mail) break;   // no warning can go out, so nobody gets nearer to deletion
    const on = new Date(now + WARN_DAYS * DAY).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
    try {
      await mail.sendMail({
        from: '"Road to 9" <hello@roadto9.com>', to: u.email,
        subject: "Your Road to 9 account will be deleted on " + on,
        text: `Hello,\n\nYou haven't used Road to 9 for almost a year, so we'll delete your account and your planner on ${on}.\n\n` +
          `Want to keep it? Just sign in at ${SITE} before then.\nWant a copy first? Sign in, then Settings → Download my data.\n\n` +
          `If you do nothing, everything is deleted for good.\n\nRoad to 9\nhello@roadto9.com`,
      });
      await svc.auth.admin.updateUserById(u.id, { app_metadata: { ...(u.app_metadata ?? {}), inactive_warned_at: new Date().toISOString() } });
    } catch (e) { console.error("tidy: warning email failed", e); }
  }
  for (const u of toDelete) {
    const { error } = await svc.auth.admin.deleteUser(u.id);
    if (error) console.error("tidy: delete failed", error.message);
  }
  console.log(`tidy: warned ${mail ? toWarn.length : 0}, deleted ${toDelete.length}`);
}

function masterKey() {
  try {
    const keys = Object.values(JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}"));
    if (keys.length) return keys[0] as string;
  } catch { /* fall back */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

// Compare without leaking timing.
function same(a: string, b: string) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
}

async function gzip(bytes: Uint8Array) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

Deno.serve(async (req) => {
  const token = Deno.env.get("BACKUP_TOKEN") ?? "";
  const pass = Deno.env.get("BACKUP_KEY") ?? "";
  if (token.length < 24 || pass.length < 24) return new Response("Backup secrets not set.", { status: 503 });
  if (req.method !== "POST" || !same(req.headers.get("x-backup-token") ?? "", token)) {
    return new Response("Not allowed.", { status: 403 });
  }

  const svc = createClient(Deno.env.get("SUPABASE_URL")!, masterKey(), { auth: { persistSession: false, autoRefreshToken: false } });

  const users = [];
  const raw = [];   // full records, for the inactive-account check after the backup
  for (let page = 1; ; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return new Response("Users: " + error.message, { status: 500 });
    raw.push(...data.users);
    users.push(...data.users.map((u) => ({
      id: u.id, email: u.email, created_at: u.created_at, invited_at: u.invited_at ?? null,
      email_confirmed_at: u.email_confirmed_at ?? null, last_sign_in_at: u.last_sign_in_at ?? null,
      user_metadata: u.user_metadata ?? {},
    })));
    if (data.users.length < 1000) break;
  }
  const { data: progress, error: e1 } = await svc.from("progress").select("user_id, doc, updated_at");
  if (e1) return new Response("Progress: " + e1.message, { status: 500 });
  const { data: invites, error: e2 } = await svc.from("invites").select("*");
  if (e2) return new Response("Invites: " + e2.message, { status: 500 });
  const { data: groups, error: e3 } = await svc.from("groups").select("*");
  if (e3) return new Response("Groups: " + e3.message, { status: 500 });
  const { data: group_members, error: e4 } = await svc.from("group_members").select("*");
  if (e4) return new Response("Group members: " + e4.message, { status: 500 });
  const { data: messages, error: e5 } = await svc.from("messages").select("*");
  if (e5) return new Response("Messages: " + e5.message, { status: 500 });

  const plain = new TextEncoder().encode(JSON.stringify({
    app: "road-to-9", format: 1, made_at: new Date().toISOString(),
    counts: { users: users.length, progress: progress?.length ?? 0, invites: invites?.length ?? 0, groups: groups?.length ?? 0, messages: messages?.length ?? 0 },
    users, progress, invites, groups, group_members, messages,
  }));

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, await gzip(plain)));

  const out = new Uint8Array(4 + 16 + 12 + sealed.length);
  out.set(new TextEncoder().encode("R9B1"), 0); out.set(salt, 4); out.set(iv, 20); out.set(sealed, 32);
  // The backup is safely made; now the 12-month clean-up (never stops the backup from being returned).
  try { await tidy(svc, raw, progress ?? []); } catch (e) { console.error("tidy failed", e); }
  return new Response(out, { headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-store" } });
});
