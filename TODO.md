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
- [ ] Nightly Drive backup: Moritz adds BACKUP_TOKEN / BACKUP_KEY and runs the Apps Script setup
      (calendar reminder Sat 14 Nov 10:00).
- [ ] Email for student messages: Moritz adds Supabase secret SMTP_PASS (the hello@roadto9.com mailbox
      password). Until then messages only show on the admin page.
- [ ] Delete accounts unused for 12 months, with a warning email 2 weeks before (Moritz to confirm period).
- [ ] Public study-time counter once there are about 10 students.
- [ ] ICO fee check; processor terms (Supabase, GitHub, SiteGround, Google); solicitor review before charging.
- [x] Study groups and "Need help?" (14 Nov 2026).
- [ ] DPIA addendum for study groups (names, studying status and very strong topics shared inside groups).
- [ ] Groups across different exam boards: match by subject only (today: same specification, by topic).
