-- Road to 9 · database setup, part 1 (private progress)
-- Paste into Supabase → SQL Editor → New query → Run. Safe to run more than once.

-- One row per student: their whole planner state as JSON.
create table if not exists public.progress (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  doc        jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  -- keeps a single row from growing out of control (about 2 MB)
  constraint progress_doc_size check (octet_length(doc::text) < 2000000)
);

-- Keep updated_at current on every write.
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists progress_touch on public.progress;
create trigger progress_touch before update on public.progress
for each row execute function public.touch_updated_at();

-- Row-level security: a signed-in student can only see and change their own row.
alter table public.progress enable row level security;

drop policy if exists "own row: read"   on public.progress;
drop policy if exists "own row: insert" on public.progress;
drop policy if exists "own row: update" on public.progress;
drop policy if exists "own row: delete" on public.progress;

create policy "own row: read"   on public.progress for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own row: insert" on public.progress for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "own row: update" on public.progress for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own row: delete" on public.progress for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Visitors who aren't signed in get nothing at all.
revoke all on public.progress from anon;
-- Signed-in students may use the table (the rules above still limit them to their own row).
-- Needed because new tables are not exposed to the API automatically.
grant select, insert, update, delete on public.progress to authenticated;
-- Nothing more: truncate would bypass the row rules.
revoke truncate, references, trigger on public.progress from authenticated;

-- Live sync between a student's own devices (Realtime still applies the rules above).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'progress'
  ) then
    alter publication supabase_realtime add table public.progress;
  end if;
end $$;

-- "Delete my account": removes the login and, through the cascade above, all their data.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
