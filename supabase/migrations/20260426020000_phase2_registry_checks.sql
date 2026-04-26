-- Phase 2: sex offender registry lookup storage (roster_person optional until Save to Roster).
create table if not exists public.registry_checks (
  id uuid primary key default gen_random_uuid(),
  roster_person_id uuid references public.roster_people(id) on delete set null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  query_name text not null,
  query_age int,
  query_state text,
  query_zip text,
  status text not null check (
    status in ('clear', 'possible_match', 'match', 'error')
  ),
  raw_result jsonb,
  matched_name text,
  matched_dob date,
  matched_state text,
  matched_zip text,
  mugshot_url text,
  created_at timestamptz not null default now()
);

comment on table public.registry_checks is 'Registry API results; roster_person_id set after Save to Roster.';
comment on column public.registry_checks.roster_person_id is 'Null until linked to a roster person.';

create index if not exists registry_checks_owner_id_idx
  on public.registry_checks (owner_id, created_at desc);

create index if not exists registry_checks_roster_person_id_idx
  on public.registry_checks (roster_person_id)
  where roster_person_id is not null;

alter table public.registry_checks enable row level security;

drop policy if exists "registry_checks_select_own" on public.registry_checks;
drop policy if exists "registry_checks_update_own" on public.registry_checks;

create policy "registry_checks_select_own"
  on public.registry_checks
  for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "registry_checks_update_own"
  on public.registry_checks
  for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

revoke all on public.registry_checks from anon;
grant select, update on public.registry_checks to authenticated;
grant all on public.registry_checks to service_role;
