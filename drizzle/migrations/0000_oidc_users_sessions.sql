create table if not exists public.users (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  name        text,
  role        text not null default 'user',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  last_login  timestamptz
);
create index if not exists users_email_idx on public.users (lower(email));
grant all on public.users to service_role;
alter table public.users enable row level security;

create table if not exists public.app_sessions (
  session_id    text primary key,
  user_id       uuid not null references public.users(id) on delete cascade,
  oidc_sub      text not null,
  refresh_token text,
  id_token      text,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now()
);
create index if not exists app_sessions_user_idx on public.app_sessions (user_id);
grant all on public.app_sessions to service_role;
alter table public.app_sessions enable row level security;