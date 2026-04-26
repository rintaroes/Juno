-- Phase 7: live circle map, date sessions, foreground location snapshots.

create table if not exists public.date_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  roster_person_id uuid not null references public.roster_people(id) on delete cascade,
  companion_display_name text not null,
  status text not null check (status in ('active', 'ended', 'cancelled')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  timer_minutes int,
  last_known_lat double precision,
  last_known_lng double precision,
  notes text
);

create unique index if not exists date_sessions_one_active_per_user_idx
  on public.date_sessions (user_id)
  where status = 'active';

create index if not exists date_sessions_user_started_idx
  on public.date_sessions (user_id, started_at desc);

comment on table public.date_sessions is 'Dating safety date mode; companion_display_name copied from roster at start for circle visibility without roster RLS.';

create table if not exists public.live_locations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  status text not null check (status in ('normal', 'on_date')),
  active_date_session_id uuid references public.date_sessions(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists live_locations_updated_idx on public.live_locations (updated_at desc);

comment on table public.live_locations is 'Last known foreground location for map; friends can read accepted circle members.';

alter table public.date_sessions enable row level security;
alter table public.live_locations enable row level security;

revoke all on public.date_sessions from anon;
revoke all on public.live_locations from anon;
grant select, insert, update, delete on public.date_sessions to authenticated;
grant select, insert, update, delete on public.live_locations to authenticated;
grant all on public.date_sessions to service_role;
grant all on public.live_locations to service_role;

-- date_sessions: owner full access; friends read active sessions only.
drop policy if exists "date_sessions_select_own" on public.date_sessions;
create policy "date_sessions_select_own"
  on public.date_sessions
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "date_sessions_select_friend_active" on public.date_sessions;
create policy "date_sessions_select_friend_active"
  on public.date_sessions
  for select
  to authenticated
  using (
    status = 'active'
    and exists (
      select 1
      from public.friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = auth.uid() and f.addressee_id = date_sessions.user_id)
          or (f.addressee_id = auth.uid() and f.requester_id = date_sessions.user_id)
        )
    )
  );

drop policy if exists "date_sessions_insert_own_roster" on public.date_sessions;
create policy "date_sessions_insert_own_roster"
  on public.date_sessions
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.roster_people r
      where r.id = roster_person_id
        and r.owner_id = auth.uid()
    )
  );

drop policy if exists "date_sessions_update_own" on public.date_sessions;
create policy "date_sessions_update_own"
  on public.date_sessions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "date_sessions_delete_own" on public.date_sessions;
create policy "date_sessions_delete_own"
  on public.date_sessions
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- live_locations: own row; friends read only.
drop policy if exists "live_locations_select_own_or_friend" on public.live_locations;
create policy "live_locations_select_own_or_friend"
  on public.live_locations
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = auth.uid() and f.addressee_id = live_locations.user_id)
          or (f.addressee_id = auth.uid() and f.requester_id = live_locations.user_id)
        )
    )
  );

drop policy if exists "live_locations_insert_own" on public.live_locations;
create policy "live_locations_insert_own"
  on public.live_locations
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "live_locations_update_own" on public.live_locations;
create policy "live_locations_update_own"
  on public.live_locations
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "live_locations_delete_own" on public.live_locations;
create policy "live_locations_delete_own"
  on public.live_locations
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- If a session ends in DB, clear pointer from live_locations (safety net).
create or replace function public.clear_live_location_on_session_end()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('ended', 'cancelled') and old.status = 'active' then
    update public.live_locations
    set
      active_date_session_id = null,
      status = case when status = 'on_date' then 'normal' else status end,
      updated_at = now()
    where user_id = new.user_id
      and active_date_session_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_clear_live_on_session_end on public.date_sessions;
create trigger trg_clear_live_on_session_end
  after update of status on public.date_sessions
  for each row
  when (old.status is distinct from new.status)
  execute procedure public.clear_live_location_on_session_end();

-- RPC: atomic start (end stale active, insert session, upsert live row).
create or replace function public.start_date_session(
  p_roster_person_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_timer_minutes int default null,
  p_accuracy double precision default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid;
  sid uuid;
  companion text;
begin
  me := auth.uid();
  if me is null then
    raise exception 'Not authenticated';
  end if;

  select trim(display_name) into companion
  from public.roster_people
  where id = p_roster_person_id
    and owner_id = me
    and archived_at is null;

  if companion is null or companion = '' then
    raise exception 'Roster person not found';
  end if;

  update public.date_sessions
  set status = 'ended',
      ended_at = now()
  where user_id = me
    and status = 'active';

  insert into public.date_sessions (
    user_id,
    roster_person_id,
    companion_display_name,
    status,
    timer_minutes,
    last_known_lat,
    last_known_lng
  )
  values (
    me,
    p_roster_person_id,
    companion,
    'active',
    case
      when p_timer_minutes is not null and p_timer_minutes > 0 and p_timer_minutes <= 24 * 60
      then p_timer_minutes
      else null
    end,
    p_lat,
    p_lng
  )
  returning id into sid;

  insert into public.live_locations (
    user_id,
    lat,
    lng,
    accuracy,
    status,
    active_date_session_id,
    updated_at
  )
  values (me, p_lat, p_lng, p_accuracy, 'on_date', sid, now())
  on conflict (user_id) do update set
    lat = excluded.lat,
    lng = excluded.lng,
    accuracy = excluded.accuracy,
    status = 'on_date',
    active_date_session_id = excluded.active_date_session_id,
    updated_at = now();

  return sid;
end;
$$;

create or replace function public.end_date_session()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid;
begin
  me := auth.uid();
  if me is null then
    raise exception 'Not authenticated';
  end if;

  update public.date_sessions
  set status = 'ended',
      ended_at = now()
  where user_id = me
    and status = 'active';

  update public.live_locations
  set
    status = 'normal',
    active_date_session_id = null,
    updated_at = now()
  where user_id = me;
end;
$$;

create or replace function public.update_my_live_location(
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid;
begin
  me := auth.uid();
  if me is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.live_locations (user_id, lat, lng, accuracy, status, updated_at)
  values (me, p_lat, p_lng, p_accuracy, 'normal', now())
  on conflict (user_id) do update set
    lat = excluded.lat,
    lng = excluded.lng,
    accuracy = excluded.accuracy,
    updated_at = now();
end;
$$;

create or replace function public.list_friends_map_snapshots()
returns table (
  profile_id uuid,
  first_name text,
  username text,
  lat double precision,
  lng double precision,
  accuracy double precision,
  status text,
  active_date_session_id uuid,
  companion_display_name text,
  timer_minutes int,
  session_started_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with me as (
    select auth.uid() as id
  ),
  friends as (
    select
      case
        when f.requester_id = me.id then f.addressee_id
        else f.requester_id
      end as friend_id
    from public.friendships f
    cross join me
    where f.status = 'accepted'
      and (f.requester_id = me.id or f.addressee_id = me.id)
  )
  select
    p.id as profile_id,
    p.first_name,
    p.username,
    ll.lat,
    ll.lng,
    ll.accuracy,
    coalesce(ll.status, 'normal') as status,
    ll.active_date_session_id,
    ds.companion_display_name,
    ds.timer_minutes,
    ds.started_at as session_started_at,
    ll.updated_at
  from friends fr
  join public.profiles p on p.id = fr.friend_id
  left join public.live_locations ll on ll.user_id = fr.friend_id
  left join public.date_sessions ds
    on ds.id = ll.active_date_session_id
    and ds.status = 'active'
    and ds.user_id = ll.user_id;
$$;

revoke all on function public.start_date_session(uuid, double precision, double precision, int, double precision) from public;
revoke all on function public.end_date_session() from public;
revoke all on function public.update_my_live_location(double precision, double precision, double precision) from public;
revoke all on function public.list_friends_map_snapshots() from public;
grant execute on function public.start_date_session(uuid, double precision, double precision, int, double precision) to authenticated;
grant execute on function public.end_date_session() to authenticated;
grant execute on function public.update_my_live_location(double precision, double precision, double precision) to authenticated;
grant execute on function public.list_friends_map_snapshots() to authenticated;

-- Realtime: friend markers update when rows change.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'live_locations'
  ) then
    alter publication supabase_realtime add table public.live_locations;
  end if;
end
$$;
