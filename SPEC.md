# Road to 9 — project spec

*We do the planning, you do the learning.*

A revision planner for GCSE students. It holds no teaching content. It decides what to study next,
for how long, and when to come back to a topic before it is forgotten. Started as a personal planner (Nov 2026); this repository is the standalone, invite-only version.

Owner and operator: Moritz Schmittat (adult). Users: students aged 14 to 18, invited individually.

---

## 1. Architecture

| Part | What it does |
|---|---|
| `index.html` | The whole app: one static page (HTML, CSS, plain JavaScript, no framework). The planning engine runs in the browser. |
| Supabase Auth | Sign-in by email link. Invite only; open sign-up is switched off. |
| Supabase table `progress` | One row per user: their whole planner state as JSON. Row-level security: each user can only read and write their own row. |
| Supabase Realtime | Pushes changes to the user's other open devices. Later: "who's studying" presence for study groups. |
| GitHub Pages | Serves the site from this repository at roadto9.com. Every push to `main` goes live within about a minute. |
| Domain | roadto9.com (roadtonine.com redirects). DNS at the registrar points to GitHub Pages. |

No server code of our own. The only key in the page is Supabase's public **anon** key, which is
safe to publish because the database rules decide what it can do. The **service_role** key is never
used in this project and never committed.

The page also keeps a local copy of the state in the browser so it works offline; changes sync when
the connection is back. Every change carries a timestamp per item so two devices merge cleanly
(newest change per item wins).

## 2. The planning engine (unchanged from the original version)

Nothing is stored as a schedule. The plan is recalculated from the user's state on every action.

State per topic chunk: rating (5 levels), stage (unrated, not taught yet, off, to revise,
revise again, in refreshers), refresher step, next due date. Plus settings, session log, journal,
to-dos, rating history.

**Rules**

- Every topic gets one revise session first: 20 min if rated strong or very strong, else 45 min.
  Weakest topics first.
- After revising, rated:
  - very strong: 2 × 5 min refreshers, spread evenly until the subject's first exam
  - strong: 3 × 5 min refreshers, spread evenly until the exam
  - OK: refreshers of 10, 10, 5, 5, 5 min at +1 day, +3 days, +1 week, +2 weeks, +1 month
  - weak or very weak: revise again (30 min) next day
- At a refresher: green moves on; OK repeats the step (strong topics switch to the normal track);
  weak, or OK twice in a row, goes back to revise again.
- Refreshers due long after a mock or exam are pulled forward to just before it.
- Daily time comes from settings (minutes per weekday, holidays, days off, mock week, study leave).
- Overdue refreshers first, then revise sessions by subject balance (least recent time relative to
  what's left), exam closeness (boost in the 4 weeks before a subject's first exam), weakest first.
- Refreshers and revise sessions are interleaved; which comes first alternates.
- Past papers from 20 March.
- The week calendar is a forecast: it simulates the coming days assuming an OK rating each time.

**Two progress measures**

- Confidence: per spec point, very strong 100%, strong 50%, OK 25%, weak 12.5%, very weak 6.25%.
- Learning done: time behind you ÷ total time, where a topic from scratch costs 140 min with this
  plan. Unrated and "off" topics are left out.

## 3. Privacy and safety (decided)

The guiding rule: **as safe and honest as we possibly can.**

- Invite only. The admin invites students from the admin page (no parental check: parental consent
  isn't required at 13+; every student confirms a parent or carer knows if they're under 18). Every student has 3 one-use invite links to share themselves (see 3e). No public sign-up,
  no user directory, no search.
- We store: email address (for sign-in), display name chosen by the user, and their planner data.
  Nothing else. No analytics, no ads, no tracking, no third-party scripts beyond the Supabase client.
- No parent view inside the app. It is the students' space.
- The privacy note says plainly: *"The site owner can access stored data for maintenance only and
  does not look at individual accounts."*
- "Delete my account" deletes the account and every piece of data, immediately and for real.
- Export and import buttons stay, so users always have their own copy.

## 3a. Terms and business (decided)

- We are not responsible for students' exam results. `terms.html` says so in plain English: a
  planning tool, not teaching or advice; no guarantee of any grade; check dates and specs with school
  and exam board; not affiliated with any exam board; liability excluded as far as the law allows.
- Free for GCSE 2027. Moritz reserves the right to introduce paid plans for GCSE 2028; users are told
  in advance and nobody is charged without actively choosing to pay.
- Invitation only, on purpose: exclusivity helps it spread through word of mouth.
- Operator and data controller: **Schmittat Ltd** (company no. 09452378, VAT GB 976 4772 61), so it is
  covered by the company's insurance and costs go through the company. Company details appear in the
  footer, terms and privacy note (UK trading disclosure rules).
- Pricing idea for GCSE 2028: a **one-off purchase**, about £10 + VAT (£12 shown to customers, as consumer
  prices must include VAT), covering one student until the end of their GCSE exams. No subscription.
  Bought by a parent. Terms to be signed off by a solicitor before any charging starts.

## 3b. Subjects for all of the UK (direction)

- Goal: all GCSE subjects in England, Wales and Northern Ireland, plus Scotland's National 5s.
  Different grading per nation (9–1; A*–G; A*–G with C*; National 5 A–D).
- Order: England (GCSE + IGCSE) first via a specification catalogue, "build your own topic list" for any
  spec, and ready-made topic lists by demand. Other nations later.
- Store topic headings in our own words and link to the official spec rather than copying spec text
  (exam board copyright), especially before charging.

## 3c. Onboarding (built)

After the first sign-in (accepting the invite), a new student goes through four steps before the app
opens; the menu is hidden until they finish, and progress is saved after every tap so they can stop
and carry on later, on any device:

1. **You**: what Road to 9 does in three lines; optional first name; a required tick: "I agree to the
   Terms of use and have read the Privacy note. If I'm under 18, a parent or carer knows I'm using Road
   to 9." The version and time are saved (`settings.terms`). Raising `TERMS_V` in the app asks everyone
   to agree again before they carry on. Also "Already have a progress
   file?" to import one and skip the rest (used to move the first student's data across).
2. **Subjects**: tick the subjects you take (at least one).
3. **Rate topics**: one page per subject. Every topic gets one of: very strong, strong, OK, weak,
   very weak (with a plain-English description of each), "not taught yet" or "not on my course".
   A whole section can be marked "not taught yet" at once. Unrated topics are allowed but flagged.
4. **Study time**: minutes on a school day and on a weekend day. Everything else is in Settings.

Then straight to Today with the first session ready.

## 3d. Admin page (built)

`admin.html` at roadto9.com/admin.html. The admin signs in with an email link like a student. All admin
actions go through the Supabase Edge Function `admin` (`supabase/functions/admin`), which holds the
master key on Supabase's side and only acts for emails listed in the function secret `ADMIN_EMAILS`.
No password or key is in the page. Actions: invite, resend invite, remove (deletes account and planner data),
list. The list shows account details only: email, first name, invited (and by whom), last sign-in, last
saved, setup finished. Never ratings, sessions, journals or to-dos.

## 3e. Friend invites (built)

- Minimum age 13 (terms; "I'm 13 or over" on the invite page and in the first-sign-in tick).
- Every student has 3 one-use invite links (Settings → Invite friends), made the first time they open
  Settings. Admins can make more. Links look like `roadto9.com/?join=ABCDE-FGHJK` (50-bit random codes).
- The student passes a link on themselves. No pre-written message, no reward. Road to 9 never emails a
  friend on a student's say-so and never stores a friend's address before the friend gives it. Reason:
  ICO guidance on "refer a friend" email (PECR) — the organisation that sends or instigates the email
  needs the friend's consent and is advised not to ask for friends' details.
- The friend opens the link, sees the inviter's first name, types their own email, confirms 13+, and
  gets the invite email they asked for. The link is used up (reserved first, released if sending fails).
- Server function `invite` (actions: peek, claim, status, more) and the `invites` table (code, inviter,
  invitee, used_at). Students can't read the table directly; only the function can.
- The admin page shows who joined through whose link and how many links each student has used.
- Parental consent is not legally required at 13+ under the contract basis; every student still
  confirms a parent or carer knows (under 18). Admin invites have no parental check either. See the DPIA.

## 3f. Backups (built)

- Supabase Pro: one daily database backup, 7 days kept, restore in the dashboard only.
- Our own: every night at 3am a Google Apps Script in Moritz's Drive calls the `backup` function
  (secret header BACKUP_TOKEN) and saves `road-to-9-YYYY-MM-DD.r9b` in "Road to 9 backups"; 30 days kept.
- The file is AES-256-GCM encrypted (key from BACKUP_KEY via PBKDF2), so Google and anyone with Drive
  access see nothing. Contents: users (email, dates, metadata), every planner row, every invite.
- Open with `tools/backup_decrypt.py`. Keys live in Moritz's password manager and in Supabase secrets.

## 4. Study groups (phase 2) and "Who can help" (phase 3)

- Groups are joined by invite code only. Kids only. Leave at any time.
- Two switches per user, both **off** by default:
  - "Show when I'm studying" → live bar: *"Toby is studying Chemistry · States of matter"*.
    Supabase Realtime Presence; disappears when the session ends; nothing stored.
    A "hide the bar" option for focus.
  - "Show topics I'm strong on" → shares only topics rated very strong or strong (and when last
    studied). Switching it off deletes the shared rows.
- **Who can help**: on a topic, lists group members who are strong on it, with the exact text:
  *"Contact Toby via your usual channel for help with Chemistry. This platform does not provide
  any communication facility."*
- Never: messaging, notifications between users, ask buttons, league tables, rankings, hours,
  percentages, weak topics, journals or to-dos of other users.
- Matching: same exam board → by topic; different boards → by subject only.

## 5. Subjects

Eleven specifications are built in so far (Pearson Edexcel IGCSE and GCSE, AQA and OCR). Friends take different subjects and boards, so:

- Settings gets a subject picker; users switch on the subjects they take.
- New boards are added as spec-point lists in `subjects/`, one file per specification.
- Later: let users import or edit their own spec lists.

## 6. Later ideas (parked)

- A-levels (target grade per subject, A*–E), starting 18 months early (phased study time,
  maintenance refreshers every 2–3 months, cap on refresher gaps), several mock weeks.
- Optional morning email via a scheduled Supabase function.

## 7. Phases

1. Standalone site: sign-in, private progress, sync, offline, Road to 9 branding, name and subjects
   in settings, privacy page, delete account. Move the first student's progress across.
2. Study groups and the who's-studying bar.
3. Who can help.
