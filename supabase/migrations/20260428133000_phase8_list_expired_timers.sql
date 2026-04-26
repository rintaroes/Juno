-- RPC for Edge Function check-date-timers: active sessions whose check-in timer has elapsed, not yet notified.

create or replace function public.list_expired_date_timer_sessions()
returns table (
  session_id uuid,
  user_id uuid,
  companion_display_name text,
  first_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ds.id as session_id,
    ds.user_id,
    ds.companion_display_name,
    p.first_name
  from public.date_sessions ds
  left join public.profiles p on p.id = ds.user_id
  where ds.status = 'active'
    and ds.timer_minutes is not null
    and ds.timer_minutes > 0
    and ds.timer_push_sent_at is null
    and ds.started_at + (ds.timer_minutes * interval '1 minute') <= now();
$$;

comment on function public.list_expired_date_timer_sessions() is 'Used by check-date-timers Edge Function (service role only).';

revoke all on function public.list_expired_date_timer_sessions() from public;
grant execute on function public.list_expired_date_timer_sessions() to service_role;
