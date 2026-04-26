-- Phase 8: Expo push targets + idempotency columns for circle date notifications.

create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null,
  platform text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists push_devices_user_token_uidx
  on public.push_devices (user_id, expo_push_token);

create index if not exists push_devices_user_id_idx on public.push_devices (user_id);

comment on table public.push_devices is 'Expo push tokens per device; used by Edge Functions to notify circle members.';

alter table public.date_sessions
  add column if not exists started_push_sent_at timestamptz,
  add column if not exists timer_push_sent_at timestamptz;

comment on column public.date_sessions.started_push_sent_at is 'Set when circle was notified that date mode started (idempotent).';
comment on column public.date_sessions.timer_push_sent_at is 'Set when circle was notified that check-in timer elapsed.';

alter table public.push_devices enable row level security;

revoke all on public.push_devices from anon;
grant select, insert, update, delete on public.push_devices to authenticated;
grant all on public.push_devices to service_role;

drop policy if exists "push_devices_select_own" on public.push_devices;
create policy "push_devices_select_own"
  on public.push_devices
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "push_devices_insert_own" on public.push_devices;
create policy "push_devices_insert_own"
  on public.push_devices
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "push_devices_update_own" on public.push_devices;
create policy "push_devices_update_own"
  on public.push_devices
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "push_devices_delete_own" on public.push_devices;
create policy "push_devices_delete_own"
  on public.push_devices
  for delete
  to authenticated
  using (auth.uid() = user_id);
