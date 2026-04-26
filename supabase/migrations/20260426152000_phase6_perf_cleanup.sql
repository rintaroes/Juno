-- Non-behavioral performance hardening for existing schema/policies.
create index if not exists chat_uploads_owner_id_idx on public.chat_uploads (owner_id);
create index if not exists chat_uploads_roster_person_id_idx on public.chat_uploads (roster_person_id);
create index if not exists friendships_declined_by_idx on public.friendships (declined_by);

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "roster_people_select_own" on public.roster_people;
drop policy if exists "roster_people_insert_own" on public.roster_people;
drop policy if exists "roster_people_update_own" on public.roster_people;
drop policy if exists "roster_people_delete_own" on public.roster_people;

create policy "roster_people_select_own"
  on public.roster_people
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "roster_people_insert_own"
  on public.roster_people
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "roster_people_update_own"
  on public.roster_people
  for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "roster_people_delete_own"
  on public.roster_people
  for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "chat_uploads_select_own" on public.chat_uploads;
drop policy if exists "chat_uploads_insert_own" on public.chat_uploads;
drop policy if exists "chat_uploads_update_own" on public.chat_uploads;
drop policy if exists "chat_uploads_delete_own" on public.chat_uploads;

create policy "chat_uploads_select_own"
  on public.chat_uploads
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "chat_uploads_insert_own"
  on public.chat_uploads
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "chat_uploads_update_own"
  on public.chat_uploads
  for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "chat_uploads_delete_own"
  on public.chat_uploads
  for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "friendships_select_participants" on public.friendships;
create policy "friendships_select_participants"
  on public.friendships
  for select
  to authenticated
  using ((select auth.uid()) = requester_id or (select auth.uid()) = addressee_id);

drop policy if exists "registry_checks_select_own" on public.registry_checks;
drop policy if exists "registry_checks_update_own" on public.registry_checks;

create policy "registry_checks_select_own"
  on public.registry_checks
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "registry_checks_update_own"
  on public.registry_checks
  for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
