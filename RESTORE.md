# Road to 9 · rebuilding from a backup

For when the Supabase project is broken, deleted or locked, or data was lost and has to come back.
Roughly an hour. The website itself (GitHub Pages) is separate and is not affected; only the
database, the logins and the four server functions live at Supabase.

Tested on 15 November 2026: all 11 database files built a new database from empty, and a backup
restored into it with every account, planner, invite, group and message matching the backup field by field.

**You need:** a recent `.r9b` file from Drive ("Road to 9 backups"), `BACKUP_KEY` and `BACKUP_TOKEN`
from your password manager, the hello@roadto9.com mailbox password, and Python 3 on your Mac.

**What comes back:** every account (same ids, same emails), every planner exactly as last saved,
invite links (used and unused), study groups and who is in them, students' messages.
**What doesn't, and doesn't need to:** passwords (there are none, everyone signs in by email link),
who was online and the error log (both rebuild themselves), and what students share with their groups
(rebuilt from their planner the next time they open Road to 9). Anything done after the backup was made is lost,
so take the newest file.

---

## 1. Decide: same project or a new one

- **The project still exists but data is wrong or missing:** skip to step 6. Nothing else changes.
- **The project is gone or unusable:** make a new one (steps 2 to 5).

## 2. New Supabase project

Follow SETUP.md section 3, steps 1 to 5 (London region, sign-ups OFF, Site URL and redirect URLs,
SMTP from hello@roadto9.com). Then paste the two email templates from `supabase/email/` (see its README).

## 3. Database

SQL Editor → New query. Paste and run each file in `supabase/`, **in order**, one at a time:
`001_init.sql`, `002_…`, up to the highest number. Each should end with "Success".
If one fails, stop and send me the error; don't skip it.

## 4. Server functions and their secrets

1. Edge Functions → deploy the four folders in `supabase/functions/`: **admin**, **backup**, **invite**,
   **message**. For each one, turn **Verify JWT off** (each checks the caller itself).
   Easiest: ask me to deploy them; I can do that with the Supabase connection.
2. Edge Functions → Secrets → add, typed by you, never pasted into a chat:
   - `ADMIN_EMAILS`: your admin email(s), comma separated
   - `SMTP_PASS`: the hello@roadto9.com mailbox password
   - `BACKUP_TOKEN` and `BACKUP_KEY`: from your password manager (same as before, so old backups still open)

## 5. Point the website at the new project

Only if the project is new. Its URL and **publishable** key (never the secret key) go in two places:
- `config.json` (the app and the admin page read it), then rebuild with `python3 tools/build.py`
  and push. I can do this part.
- `backup/apps-script.gs`, lines 8 and 9, then paste the changed lines into the Apps Script
  "Road to 9 backup" too, so the nightly backup reads from the new project.

## 6. Put the data back

On your Mac, in the folder with the two scripts (`tools/backup_decrypt.py`, `tools/restore.py`):

```
python3 backup_decrypt.py > backup.json        # opens the newest .r9b in Downloads, asks for BACKUP_KEY
python3 backup_decrypt.py --check              # optional: counts only, says OK if everything is there
python3 restore.py backup.json --dry-run       # shows what it would restore, changes nothing
python3 restore.py backup.json                 # restores
```

`restore.py` asks for the project URL and the **secret key** (Project Settings → API Keys →
secret key, `sb_secret_…`). Type or paste it into the script's prompt only; it is not shown, saved or sent anywhere else.

It ends with a check, every line "N of N", and **ALL BACK**. Running it a second time is safe:
nothing already there is duplicated or changed. A planner already in the project is kept, not
overwritten. To replace planners with the backup's copy (only when the project's own copy is
known to be wrong), add `--overwrite-planners`.

**Then delete backup.json** (it is not encrypted). The `.r9b` stays in Drive.

## 7. Check

1. Open roadto9.com/admin.html: everyone listed, invite links there.
2. Sign in with a student account (email link): planner, ratings and history as before.
3. Next morning: a new `.r9b` in Drive, and `python3 backup_decrypt.py --check` says OK.

Students don't need to do anything except sign in again with their email if asked.
Someone who was invited but never joined has to be invited again from the admin page (the old invitation email no longer works).
