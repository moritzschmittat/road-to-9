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
      Still worth doing once: open one file with tools/backup_decrypt.py to prove the key works.
- [x] SMTP_PASS set (14 Nov 2026): student messages now also arrive by email.
- [ ] Delete accounts unused for 12 months, with a warning email 2 weeks before (Moritz to confirm period).
- [ ] Public study-time counter once there are about 10 students.
- [ ] ICO fee check; processor terms (Supabase, GitHub, SiteGround, Google); solicitor review before charging.
- [x] Study groups and "Need help?" (14 Nov 2026).
- [x] RGS subjects added 15 Nov 2026: French, History, RS, Latin, Classical Greek. Latin/Greek: check which prose and verse options RGS takes.
- [ ] DPIA addendum for study groups (names, studying status and very strong topics shared inside groups) and for "online now" on the admin page (presence table, last-seen time only, since 15 Nov 2026), error reports (client_errors, no user), mock marks and topics that cost marks (inside the planner).
- [ ] Groups across different exam boards: match by subject only (today: same specification, by topic).
