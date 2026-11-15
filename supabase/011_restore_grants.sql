-- Road to 9 · database setup, part 11 (restoring a backup)
-- tools/restore.py writes study groups back with the server key; until now that key could only read them.
-- Students still can't create groups directly: they go through create_group / join_group as before.
grant insert on public.groups, public.group_members to service_role;
