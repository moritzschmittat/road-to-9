-- Road to 9 · database setup, part 2 (friend invites)
-- Every student can invite up to 3 friends. Invites are created only by the "invite" server function;
-- a student can read the list of people they invited, nothing else.

create table if not exists public.invites (
  id         bigint generated always as identity primary key,
  inviter    uuid not null references auth.users (id) on delete cascade,
  email      text not null,
  invitee    uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists invites_inviter on public.invites (inviter);
create index if not exists invites_invitee on public.invites (invitee);

alter table public.invites enable row level security;
drop policy if exists "own invites: read" on public.invites;
create policy "own invites: read" on public.invites for select to authenticated
  using ((select auth.uid()) = inviter);

revoke all on public.invites from anon, authenticated;
grant select on public.invites to authenticated;
