# Road to 9

*We do the planning, you do the learning.*

A GCSE revision planner: it tells you what to study next, for how long, and brings topics back
just before you'd forget them. Invite only. See `SPEC.md` for every decision and `SETUP.md` for
the one-off setup.

## Files

| Path | What it is |
|---|---|
| `src/app.html` | The app source (HTML, CSS, JavaScript in one file). Edit this. |
| `data/curriculum.json` | Spec points for each subject, grouped into topics. No personal data. |
| `config.json` | Public Supabase settings (project URL + anon/publishable key). |
| `tools/build.py` | Builds `index.html` from the three files above. |
| `index.html` | The built page that GitHub Pages serves. Don't edit by hand. |
| `privacy.html` | The privacy note. |
| `terms.html` | Terms of use (no guarantee of results, free for GCSE 2027, invite only). |
| `supabase/001_init.sql` | Database setup (table, security rules, delete-account function). |
| `admin.html` | Admin page: invite, resend, remove students (account details only). |
| `supabase/functions/backup/` + `backup/apps-script.gs` | Nightly encrypted backup into Google Drive (kept 30 days). Open one with `tools/backup_decrypt.py`. |
| `supabase/functions/admin/` | Server function behind the admin page; holds the master key on Supabase's side. |

## Making a change

```
python3 tools/build.py
git add -A && git commit -m "…" && git push
```

GitHub Pages publishes `main` within about a minute.

## Safety rules for this repository

- Never commit the Supabase **service_role** / **secret** key. `tools/build.py` refuses to build with one.
- Never commit anyone's progress or export files.
