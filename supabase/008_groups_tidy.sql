-- Road to 9 · database setup, part 8: tidy-up after the security check (14 Nov 2026)
-- The two helper functions used by the group rules move out of the public API into a private schema,
-- so they can't be called over the web; the "delete empty group" trigger function can't be called directly either.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_group_member(g uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (select 1 from public.group_members where group_id = g and user_id = auth.uid())
$$;
create or replace function private.shares_a_group_with(other uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (select 1 from public.group_members a join public.group_members b on a.group_id = b.group_id
                 where a.user_id = auth.uid() and b.user_id = other)
$$;
revoke all on function private.is_group_member(uuid), private.shares_a_group_with(uuid) from public, anon;
grant execute on function private.is_group_member(uuid), private.shares_a_group_with(uuid) to authenticated;

drop policy if exists "members see their groups" on public.groups;
create policy "members see their groups" on public.groups for select to authenticated
  using (private.is_group_member(id));
drop policy if exists "members see who is in their groups" on public.group_members;
create policy "members see who is in their groups" on public.group_members for select to authenticated
  using (private.is_group_member(group_id));
drop policy if exists "see own and group mates' shares" on public.shares;
create policy "see own and group mates' shares" on public.shares for select to authenticated
  using (user_id = (select auth.uid()) or private.shares_a_group_with(user_id));

drop function if exists public.is_group_member(uuid);
drop function if exists public.shares_a_group_with(uuid);

revoke all on function public.drop_empty_group() from public, anon, authenticated;

-- Supabase's own "turn RLS on for new tables" event-trigger function: nobody needs to call it over the API
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
-- indexes the performance check asked for (account deletion cascades through these)
create index if not exists groups_created_by on public.groups (created_by);
create index if not exists messages_user_id on public.messages (user_id);
