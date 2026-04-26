-- Pre-auth dev schema: tighten RLS when Supabase Auth is enabled.
-- Applied to hosted project via Cursor MCP (apply_migration); kept here for history.

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  first_name text,
  city text,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Safety Check profile fields; open anon policies for connectivity testing only.';

alter table public.profiles enable row level security;

drop policy if exists "profiles_anon_select" on public.profiles;
drop policy if exists "profiles_anon_insert" on public.profiles;

create policy "profiles_anon_select"
  on public.profiles
  for select
  to anon
  using (true);

create policy "profiles_anon_insert"
  on public.profiles
  for insert
  to anon
  with check (true);

grant select, insert on table public.profiles to anon, authenticated;
grant all on table public.profiles to service_role;
