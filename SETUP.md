# Road to 9 · setup steps for Moritz

About 30 minutes in total. Do them in this order.

---

## 1. Domain and mailbox (SiteGround)

1. Register **roadto9.com** (and **roadtonine.com** if you want the spelled-out version too).
   Registration only; you don't need hosting for it.
2. Create a mailbox **hello@roadto9.com** (Site Tools → Email → Accounts).
   Note its password, and the **outgoing (SMTP) server name**: Site Tools → Email → Accounts →
   ⋮ next to the mailbox → Mail Configuration. It looks like `mail.roadto9.com` or
   `gukxxxx.siteground.biz`.
3. Leave DNS alone for now. I'll send the exact records once the site is on GitHub.

## 2. GitHub (free)

1. Create an account at github.com if you don't have one.
2. Create a new repository: name **road-to-9**, **Public**, no README (leave it empty).
3. In claude.ai: Settings → Connectors → **GitHub** → connect, and allow access to `road-to-9`.
4. Tell me the repository name, e.g. `yourname/road-to-9`.

## 3. Supabase project

1. **New project**: name `road-to-9`, region **West EU (London)**. Choose a strong database
   password and keep it in your password manager. You won't need to give it to me.
2. **Database**: SQL Editor → New query → paste the whole of `supabase/001_init.sql` → **Run**.
   It should finish with "Success. No rows returned".
3. **Invite only**: Authentication → Sign In / Providers →
   - **Allow new users to sign up: OFF**
   - Email provider: **on**, Confirm email: **on**
4. **Web addresses**: Authentication → URL Configuration →
   - Site URL: `https://roadto9.com`
   - Redirect URLs, add both:
     `https://roadto9.com/**` and `https://moritzschmittat.github.io/**`
5. **Login emails from your own mailbox**: Authentication → Emails → SMTP Settings →
   enable custom SMTP:
   - Sender email: `hello@roadto9.com`, sender name: `Road to 9`
   - Host: the SMTP server from step 1.2, port **465**
   - Username: `hello@roadto9.com`, password: the mailbox password
6. **Send me two values** (Project Settings → API Keys / Data API):
   - the **Project URL** (`https://xxxx.supabase.co`)
   - the **anon** key or **publishable** key (`sb_publishable_…` or a long `eyJ…`)

   Never send the **service_role** or **secret** key. The site doesn't need it, and it would
   bypass every safety rule in the database.

## 4. Later: inviting someone

Once the site works: Authentication → Users → **Add user → Send invitation** → their email.
They get a link, click it, and they're in. Ask their parent first.
