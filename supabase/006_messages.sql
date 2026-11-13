-- Road to 9 · database setup, part 6 (messages to Road to 9, e.g. "my subject is missing")
-- Written only by the "message" server function; read only by the admin function.
create table if not exists public.messages (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users (id) on delete cascade,
  email      text,
  topic      text not null default 'subject',
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  done_at    timestamptz
);
alter table public.messages enable row level security;
revoke all on public.messages from anon, authenticated;
grant select, insert, update, delete on public.messages to service_role;
grant usage, select on all sequences in schema public to service_role;
