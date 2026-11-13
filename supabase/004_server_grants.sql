-- Road to 9 · database setup, part 4
-- New tables aren't exposed automatically on this project, so the server role used by the
-- admin and invite functions needs explicit access. Browsers never get this role.
grant select, insert, update, delete on public.progress, public.invites to service_role;
grant usage, select on all sequences in schema public to service_role;
