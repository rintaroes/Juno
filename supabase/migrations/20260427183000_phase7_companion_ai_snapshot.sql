-- Snapshot roster AI summary on date start (friends see it without roster RLS).

alter table public.date_sessions
  add column if not exists companion_ai_summary text;

comment on column public.date_sessions.companion_ai_summary is 'Copy of roster_people.ai_summary at session start for circle context.';

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
  summary text;
begin
  me := auth.uid();
  if me is null then
    raise exception 'Not authenticated';
  end if;

  select
    trim(display_name),
    left(nullif(trim(coalesce(r.ai_summary, '')), ''), 6000)
  into companion, summary
  from public.roster_people r
  where r.id = p_roster_person_id
    and r.owner_id = me
    and r.archived_at is null;

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
    companion_ai_summary,
    status,
    timer_minutes,
    last_known_lat,
    last_known_lng
  )
  values (
    me,
    p_roster_person_id,
    companion,
    summary,
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

-- Postgres cannot change RETURNS TABLE shape with CREATE OR REPLACE; drop then recreate.
drop function if exists public.list_friends_map_snapshots();

create function public.list_friends_map_snapshots()
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
  companion_ai_summary text,
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
    ds.companion_ai_summary,
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

revoke all on function public.list_friends_map_snapshots() from public;
grant execute on function public.list_friends_map_snapshots() to authenticated;
