-- Road to 9 · database setup, part 3 (invite links instead of invite emails)
-- Each student gets 3 one-use invite links. They share a link themselves; the friend asks for their
-- own sign-in email. Road to 9 never stores or emails a friend's address on a student's say-so.
alter table public.invites add column if not exists code text;
alter table public.invites add column if not exists used_at timestamptz;
alter table public.invites alter column email drop not null;
create unique index if not exists invites_code on public.invites (code);
-- Only the server function reads codes; students see their own links through it.
revoke all on public.invites from anon, authenticated;
