create table if not exists public.chat_uploads (
  id uuid primary key default gen_random_uuid(),
  roster_person_id uuid not null references public.roster_people(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  screenshot_url text not null,
  ocr_text text,
  ai_summary text,
  opening_line text,
  red_flags text[] not null default '{}',
  green_flags text[] not null default '{}',
  created_at timestamptz not null default now()
);

comment on table public.chat_uploads is 'Chat screenshot uploads and AI summaries linked to roster people.';

alter table public.chat_uploads enable row level security;

drop policy if exists "chat_uploads_select_own" on public.chat_uploads;
drop policy if exists "chat_uploads_insert_own" on public.chat_uploads;
drop policy if exists "chat_uploads_update_own" on public.chat_uploads;
drop policy if exists "chat_uploads_delete_own" on public.chat_uploads;

create policy "chat_uploads_select_own"
  on public.chat_uploads
  for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "chat_uploads_insert_own"
  on public.chat_uploads
  for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "chat_uploads_update_own"
  on public.chat_uploads
  for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "chat_uploads_delete_own"
  on public.chat_uploads
  for delete
  to authenticated
  using (auth.uid() = owner_id);

revoke all on public.chat_uploads from anon;
grant select, insert, update, delete on public.chat_uploads to authenticated;
grant all on public.chat_uploads to service_role;

insert into storage.buckets (id, name, public)
select 'chat-screenshots', 'chat-screenshots', false
where not exists (
  select 1 from storage.buckets where id = 'chat-screenshots'
);

drop policy if exists "chat_screenshots_select_own" on storage.objects;
drop policy if exists "chat_screenshots_insert_own" on storage.objects;
drop policy if exists "chat_screenshots_update_own" on storage.objects;
drop policy if exists "chat_screenshots_delete_own" on storage.objects;

create policy "chat_screenshots_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'chat-screenshots'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "chat_screenshots_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'chat-screenshots'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "chat_screenshots_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'chat-screenshots'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'chat-screenshots'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "chat_screenshots_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'chat-screenshots'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
