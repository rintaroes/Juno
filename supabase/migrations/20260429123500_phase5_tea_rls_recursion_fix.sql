-- Fix recursive RLS evaluation between tea_packages and tea_package_recipients.
drop policy if exists "tea_packages_select_participants" on public.tea_packages;
drop policy if exists "tea_package_recipients_select_participants" on public.tea_package_recipients;

create or replace function public.can_read_tea_package(p_tea_package_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tea_package_recipients tpr
    where tpr.tea_package_id = p_tea_package_id
      and tpr.recipient_id = (select auth.uid())
  );
$$;

revoke all on function public.can_read_tea_package(uuid) from public;
grant execute on function public.can_read_tea_package(uuid) to authenticated;

create policy "tea_packages_select_participants"
  on public.tea_packages
  for select
  to authenticated
  using (
    sender_id = (select auth.uid())
    or public.can_read_tea_package(id)
  );

-- Keep recipients table readable by recipients only to avoid policy cycles.
create policy "tea_package_recipients_select_participants"
  on public.tea_package_recipients
  for select
  to authenticated
  using (recipient_id = (select auth.uid()));
