-- Road to 9 · database setup, part 9: who is online (for the admin page)
-- While Road to 9 is open, the app records "last seen" once a minute: one timestamp per account,
-- overwritten each time. Nothing else. Only the admin function (master key) reads it.
create table if not exists public.presence (
  user_id uuid primary key references auth.users (id) on delete cascade,
  seen_at timestamptz not null default now()
);
alter table public.presence enable row level security;
revoke all on public.presence from anon, authenticated;
grant select on public.presence to service_role;

create or replace function public.touch_presence()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.presence (user_id, seen_at) values (auth.uid(), now())
  on conflict (user_id) do update set seen_at = excluded.seen_at;
end;
$$;
revoke all on function public.touch_presence() from public, anon;
grant execute on function public.touch_presence() to authenticated;
