// Road to 9 · nightly backup (Supabase Edge Function "backup").
// Returns ONE encrypted file with everything needed to rebuild Road to 9: every planner, every account
// (email and dates, no passwords exist) and every invite link. A Google Apps Script in Moritz's Drive
// fetches it each night. The file is unreadable without BACKUP_KEY, which only Moritz holds.
//
// File format (.r9b): "R9B1" | 16-byte salt | 12-byte IV | AES-256-GCM ciphertext of gzip(JSON)
// Key = PBKDF2-SHA256(BACKUP_KEY, salt, 210000 iterations). tools/backup_decrypt.py opens it.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const ITERATIONS = 210000;

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
  for (let page = 1; ; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return new Response("Users: " + error.message, { status: 500 });
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

  const plain = new TextEncoder().encode(JSON.stringify({
    app: "road-to-9", format: 1, made_at: new Date().toISOString(),
    counts: { users: users.length, progress: progress?.length ?? 0, invites: invites?.length ?? 0 },
    users, progress, invites,
  }));

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, await gzip(plain)));

  const out = new Uint8Array(4 + 16 + 12 + sealed.length);
  out.set(new TextEncoder().encode("R9B1"), 0); out.set(salt, 4); out.set(iv, 20); out.set(sealed, 32);
  return new Response(out, { headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-store" } });
});
