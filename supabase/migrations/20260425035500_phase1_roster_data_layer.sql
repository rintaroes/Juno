create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.roster_people (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null,
  estimated_age int,
  dob date,
  state text,
  zip text,
  source text not null default 'manual' check (
    source in ('manual', 'registry_lookup', 'image_search', 'chat_upload')
  ),
  notes text,
  ai_summary text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.roster_people is 'People on a user roster; RLS by owner.';

alter table public.roster_people enable row level security;

drop trigger if exists roster_people_set_updated_at on public.roster_people;
create trigger roster_people_set_updated_at
before update on public.roster_people
for each row
execute procedure public.set_updated_at();

drop policy if exists "roster_people_select_own" on public.roster_people;
drop policy if exists "roster_people_insert_own" on public.roster_people;
drop policy if exists "roster_people_update_own" on public.roster_people;
drop policy if exists "roster_people_delete_own" on public.roster_people;

create policy "roster_people_select_own"
  on public.roster_people
  for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "roster_people_insert_own"
  on public.roster_people
  for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "roster_people_update_own"
  on public.roster_people
  for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "roster_people_delete_own"
  on public.roster_people
  for delete
  to authenticated
  using (auth.uid() = owner_id);

revoke all on public.roster_people from anon;
grant select, insert, update, delete on public.roster_people to authenticated;
grant all on public.roster_people to service_role;
