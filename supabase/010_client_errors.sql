-- Road to 9 · database setup, part 10: error log for the admin page
-- When something breaks in a student's browser, the app sends the error message, where in the code it
-- happened, the browser type and the app version. No user id, no email, nothing typed by the student.
-- Only the admin function (master key) reads it. Keeps the newest 500.
create table if not exists public.client_errors (
  id    bigserial primary key,
  at    timestamptz not null default now(),
  msg   text not null check (char_length(msg) <= 300),
  src   text check (src is null or char_length(src) <= 200),
  line  int,
  ua    text check (ua is null or char_length(ua) <= 120),
  ver   text check (ver is null or char_length(ver) <= 40)
);
alter table public.client_errors enable row level security;
revoke all on public.client_errors from anon, authenticated;
grant select, delete on public.client_errors to service_role;

create or replace function public.log_client_error(p_msg text, p_src text, p_line int, p_ua text, p_ver text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return; end if;
  -- flood guard: at most 60 errors a minute from everyone together
  if (select count(*) from public.client_errors where at > now() - interval '1 minute') >= 60 then return; end if;
  insert into public.client_errors (msg, src, line, ua, ver)
  values (left(coalesce(p_msg, '?'), 300), left(p_src, 200), p_line, left(p_ua, 120), left(p_ver, 40));
  delete from public.client_errors where id < (select id from public.client_errors order by id desc offset 499 limit 1);
end;
$$;
revoke all on function public.log_client_error(text, text, int, text, text) from public, anon;
grant execute on function public.log_client_error(text, text, int, text, text) to authenticated;
