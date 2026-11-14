-- Road to 9 · database setup, part 7: study groups
-- Students make a group (it gets a code), join one with a code, and leave with one click. When the last
-- member leaves, the group is deleted. Inside a group, members see each other's first name and, only if
-- they switched it on themselves:
--   * what they are studying right now (subject and topic, while a session is running), and
--   * which topics they rated "very strong", only in the subjects where they offer help.
-- Nothing else is ever shared: no ratings, hours, percentages, journals, emails or any contact details.
-- There is no messaging of any kind.

create table if not exists public.groups (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null check (char_length(name) between 1 and 40),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id  uuid not null references public.groups (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user on public.group_members (user_id);

-- What a student shows to the people in their groups. One row per student, written only by them.
create table if not exists public.shares (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text check (name is null or char_length(name) <= 30),
  studying   jsonb check (studying is null or pg_column_size(studying) < 2000),  -- {"sid","cid","until"} while a session runs
  strong     text[] not null default '{}' check (cardinality(strong) <= 2000),      -- very strong topic ids, help subjects only
  updated_at timestamptz not null default now()
);

alter table public.groups        enable row level security;
alter table public.group_members enable row level security;
alter table public.shares        enable row level security;

-- helpers (run as owner so the policies don't recurse)
create or replace function public.is_group_member(g uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (select 1 from public.group_members where group_id = g and user_id = auth.uid())
$$;
create or replace function public.shares_a_group_with(other uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (select 1 from public.group_members a join public.group_members b on a.group_id = b.group_id
                 where a.user_id = auth.uid() and b.user_id = other)
$$;
revoke all on function public.is_group_member(uuid) from public, anon;
revoke all on function public.shares_a_group_with(uuid) from public, anon;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.shares_a_group_with(uuid) to authenticated;

drop policy if exists "members see their groups" on public.groups;
create policy "members see their groups" on public.groups for select to authenticated
  using (public.is_group_member(id));

drop policy if exists "members see who is in their groups" on public.group_members;
create policy "members see who is in their groups" on public.group_members for select to authenticated
  using (public.is_group_member(group_id));
drop policy if exists "leave a group" on public.group_members;
create policy "leave a group" on public.group_members for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "see own and group mates' shares" on public.shares;
create policy "see own and group mates' shares" on public.shares for select to authenticated
  using (user_id = (select auth.uid()) or public.shares_a_group_with(user_id));
drop policy if exists "write own share" on public.shares;
create policy "write own share" on public.shares for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists "update own share" on public.shares;
create policy "update own share" on public.shares for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "delete own share" on public.shares;
create policy "delete own share" on public.shares for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.groups, public.group_members, public.shares from anon, authenticated;
grant select on public.groups to authenticated;
grant select, delete on public.group_members to authenticated;
grant select, insert, update, delete on public.shares to authenticated;
grant select on public.groups, public.group_members, public.shares to service_role;   -- nightly backup

-- Make a group: returns its code. Up to 10 groups per student.
create or replace function public.create_group(p_name text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  nm text := btrim(coalesce(p_name, ''));
  c  text;
  b  bytea;
  g  uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if nm = '' then raise exception 'Give the group a name.'; end if;
  if char_length(nm) > 40 then nm := left(nm, 40); end if;
  if (select count(*) from public.group_members where user_id = auth.uid()) >= 10 then
    raise exception 'You can be in up to 10 groups.';
  end if;
  loop
    b := extensions.gen_random_bytes(8);
    select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (get_byte(b, i) % 32) + 1, 1), '' order by i)
      into c from generate_series(0, 7) i;
    c := left(c, 4) || '-' || right(c, 4);
    exit when not exists (select 1 from public.groups where code = c);
  end loop;
  insert into public.groups (code, name, created_by) values (c, nm, auth.uid()) returning id into g;
  insert into public.group_members (group_id, user_id) values (g, auth.uid());
  return c;
end;
$$;

-- Join with a code. Up to 10 groups per student and 40 students per group.
create or replace function public.join_group(p_code text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  c  text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  gr public.groups;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if char_length(c) = 8 then c := left(c, 4) || '-' || right(c, 4); end if;
  select * into gr from public.groups where code = c;
  if gr.id is null then raise exception 'No group has that code. Check it with whoever gave it to you.'; end if;
  if exists (select 1 from public.group_members where group_id = gr.id and user_id = auth.uid()) then
    return gr.name;
  end if;
  if (select count(*) from public.group_members where user_id = auth.uid()) >= 10 then
    raise exception 'You can be in up to 10 groups.';
  end if;
  if (select count(*) from public.group_members where group_id = gr.id) >= 40 then
    raise exception 'That group is full (40 students).';
  end if;
  insert into public.group_members (group_id, user_id) values (gr.id, auth.uid());
  return gr.name;
end;
$$;

revoke all on function public.create_group(text) from public, anon;
revoke all on function public.join_group(text) from public, anon;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.join_group(text) to authenticated;

-- When the last member leaves (or deletes their account), the group goes too.
create or replace function public.drop_empty_group()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.groups g where g.id = old.group_id
    and not exists (select 1 from public.group_members m where m.group_id = old.group_id);
  return null;
end;
$$;
drop trigger if exists drop_empty_group on public.group_members;
create trigger drop_empty_group after delete on public.group_members
  for each row execute function public.drop_empty_group();
