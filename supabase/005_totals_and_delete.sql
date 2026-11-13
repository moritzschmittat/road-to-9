-- Road to 9 · database setup, part 5
-- (1) Study totals for everyone together: minutes today, in the last 7 days and ever, plus how many
--     students have studied at all. Totals only, never per student. Only the server role can run it.
create or replace function public.study_totals()
returns table (today_min bigint, week_min bigint, ever_min bigint, students bigint)
language sql security definer set search_path = '' stable as $$
  with s as (
    select (e->>'d')::date as d, coalesce((e->>'mins')::int, 0) as m, p.user_id
    from public.progress p,
         jsonb_array_elements(case when jsonb_typeof(p.doc->'log') = 'array' then p.doc->'log' else '[]'::jsonb end) e
    where e ? 'at' and e->>'d' ~ '^\d{4}-\d{2}-\d{2}$' and coalesce(e->>'mins', '0') ~ '^\d{1,4}$'
  ), today as (select (now() at time zone 'Europe/London')::date as t)
  select coalesce(sum(m) filter (where d = today.t), 0),
         coalesce(sum(m) filter (where d > today.t - 7 and d <= today.t), 0),
         coalesce(sum(m), 0),
         count(distinct user_id)
  from s, today group by today.t
  union all select 0, 0, 0, 0 where not exists (select 1 from s)
$$;
revoke all on function public.study_totals() from public, anon, authenticated;
grant execute on function public.study_totals() to service_role;

-- (2) "Delete my account" now needs a fresh email confirmation: the student must have signed in
--     with an emailed link in the last 15 minutes.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if not exists (select 1 from auth.users where id = auth.uid() and last_sign_in_at > now() - interval '15 minutes') then
    raise exception 'confirm by email first';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
