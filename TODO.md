# Road to 9 · to do

## Next (overnight job, planned)
- [ ] **All GCSE subjects, all boards.** About 40 subjects × AQA, Pearson Edexcel, OCR, WJEC Eduqas,
      Edexcel IGCSE (100+ specifications), in the same format as Casper's (`data/curriculum.json`:
      subject → topic chunks → spec points with the official spec number).
      - Wording: each spec point as a short plain-English summary in our own words, with its spec number
        and a link to the official PDF (exam board copyright; decided by default 13 Nov 2026, Moritz
        to confirm). Casper's 11 subjects keep their current wording for now.
      - Order: most-taken subjects first (Maths, English Language, English Literature, Combined Science,
        Biology, Chemistry, Physics, History, Geography, French, Spanish, German, Computer Science, RS),
        then the rest.
      - Subject picker in onboarding must handle many boards (group by subject, then board).

## Parked
- [x] Nightly Drive backup running since 14 Nov 2026 (3am, 30 days kept, "Road to 9 backups" folder).
      Restore test passed 15 Nov 2026 (users 3, planners 2, invites 59). Key rotated that day; it lives only in Supabase and Moritz's password manager.
      Students' messages in the backup from 15 Nov 2026. Full rebuild written up in RESTORE.md (tools/restore.py) and tested
      the same day into an empty database: all migrations from zero, every field matched the backup.
      Backup alarm live 15 Nov 2026: email to Moritz if the 3am backup fails or none has arrived by 9am.
- [x] SMTP_PASS set (14 Nov 2026): student messages now also arrive by email.
- [x] Accounts unused for 12 months: warning email 2 weeks before, then deleted (runs after the nightly backup; admins never; at most 20 a night). Done 15 Nov 2026.
- [ ] Public study-time counter once there are about 10 students.
- [x] ICO data protection fee registered and paid for Schmittat Ltd, 15 Nov 2026.
- [ ] Processor terms (Supabase, GitHub, SiteGround, Google); solicitor review before charging.
- [x] Study groups and "Need help?" (14 Nov 2026).
- [x] RGS subjects added 15 Nov 2026: French, History, RS, Latin, Classical Greek. Latin/Greek: check which prose and verse options RGS takes.
- [x] DPIA addendum (signed by Moritz 15 Nov 2026, "online now" kept for now) for study groups (names, studying status and very strong topics shared inside groups) and for "online now" on the admin page (presence table, last-seen time only, since 15 Nov 2026), error reports (client_errors, no user), mock marks and topics that cost marks (inside the planner).
- [ ] Groups across different exam boards: match by subject only (today: same specification, by topic).
