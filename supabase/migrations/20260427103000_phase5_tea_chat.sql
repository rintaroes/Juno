create table if not exists public.tea_packages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  roster_person_id uuid not null references public.roster_people(id) on delete cascade,
  note text,
  include_registry boolean not null default true,
  include_profile_summary boolean not null default true,
  include_chat_summary boolean not null default true,
  ai_digest text,
  created_at timestamptz not null default now()
);

create table if not exists public.tea_package_recipients (
  id uuid primary key default gen_random_uuid(),
  tea_package_id uuid not null references public.tea_packages(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (tea_package_id, recipient_id)
);

create table if not exists public.circle_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text,
  tea_package_id uuid references public.tea_packages(id) on delete set null,
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id),
  check (
    (body is not null and length(trim(body)) > 0)
    or tea_package_id is not null
  )
);

create index if not exists tea_packages_sender_created_idx
  on public.tea_packages (sender_id, created_at desc);
create index if not exists tea_packages_roster_idx
  on public.tea_packages (roster_person_id);
create index if not exists tea_package_recipients_recipient_idx
  on public.tea_package_recipients (recipient_id, created_at desc);
create index if not exists tea_package_recipients_package_idx
  on public.tea_package_recipients (tea_package_id);
create index if not exists circle_messages_sender_created_idx
  on public.circle_messages (sender_id, created_at desc);
create index if not exists circle_messages_recipient_created_idx
  on public.circle_messages (recipient_id, created_at desc);
create index if not exists circle_messages_pair_created_idx
  on public.circle_messages (
    least(sender_id::text, recipient_id::text),
    greatest(sender_id::text, recipient_id::text),
    created_at desc
  );

alter table public.tea_packages enable row level security;
alter table public.tea_package_recipients enable row level security;
alter table public.circle_messages enable row level security;

drop policy if exists "tea_packages_select_participants" on public.tea_packages;
drop policy if exists "tea_packages_insert_sender" on public.tea_packages;

create policy "tea_packages_select_participants"
  on public.tea_packages
  for select
  to authenticated
  using (
    (select auth.uid()) = sender_id
    or exists (
      select 1
      from public.tea_package_recipients tpr
      where tpr.tea_package_id = id
        and tpr.recipient_id = (select auth.uid())
    )
  );

create policy "tea_packages_insert_sender"
  on public.tea_packages
  for insert
  to authenticated
  with check ((select auth.uid()) = sender_id);

drop policy if exists "tea_package_recipients_select_participants" on public.tea_package_recipients;
drop policy if exists "tea_package_recipients_insert_sender" on public.tea_package_recipients;

create policy "tea_package_recipients_select_participants"
  on public.tea_package_recipients
  for select
  to authenticated
  using (
    recipient_id = (select auth.uid())
    or exists (
      select 1
      from public.tea_packages tp
      where tp.id = tea_package_id
        and tp.sender_id = (select auth.uid())
    )
  );

create policy "tea_package_recipients_insert_sender"
  on public.tea_package_recipients
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.tea_packages tp
      where tp.id = tea_package_id
        and tp.sender_id = (select auth.uid())
    )
  );

drop policy if exists "circle_messages_select_participants" on public.circle_messages;
drop policy if exists "circle_messages_insert_sender" on public.circle_messages;

create policy "circle_messages_select_participants"
  on public.circle_messages
  for select
  to authenticated
  using ((select auth.uid()) = sender_id or (select auth.uid()) = recipient_id);

create policy "circle_messages_insert_sender"
  on public.circle_messages
  for insert
  to authenticated
  with check ((select auth.uid()) = sender_id);

revoke all on public.tea_packages from anon;
revoke all on public.tea_package_recipients from anon;
revoke all on public.circle_messages from anon;
grant select, insert on public.tea_packages to authenticated;
grant select, insert on public.tea_package_recipients to authenticated;
grant select, insert on public.circle_messages to authenticated;
grant all on public.tea_packages to service_role;
grant all on public.tea_package_recipients to service_role;
grant all on public.circle_messages to service_role;

create or replace function public.list_circle_threads()
returns table (
  friend_id uuid,
  friend_name text,
  friend_username text,
  friend_city text,
  friend_email text,
  last_message_id uuid,
  last_message_preview text,
  last_message_type text,
  last_message_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with me as (
    select auth.uid() as id
  ),
  peers as (
    select
      case when f.requester_id = me.id then f.addressee_id else f.requester_id end as friend_id
    from public.friendships f
    join me on true
    where (f.requester_id = me.id or f.addressee_id = me.id)
      and f.status = 'accepted'
  ),
  latest_message as (
    select distinct on (
      least(cm.sender_id::text, cm.recipient_id::text),
      greatest(cm.sender_id::text, cm.recipient_id::text)
    )
      cm.id,
      cm.sender_id,
      cm.recipient_id,
      cm.body,
      cm.tea_package_id,
      cm.created_at
    from public.circle_messages cm
    join me on true
    where cm.sender_id = me.id or cm.recipient_id = me.id
    order by
      least(cm.sender_id::text, cm.recipient_id::text),
      greatest(cm.sender_id::text, cm.recipient_id::text),
      cm.created_at desc
  )
  select
    p.friend_id,
    coalesce(pr.first_name, pr.search_email, 'Unknown user') as friend_name,
    pr.username as friend_username,
    pr.city as friend_city,
    pr.search_email as friend_email,
    lm.id as last_message_id,
    case
      when lm.id is null then null
      when lm.tea_package_id is not null then '[Tea Package]'
      else lm.body
    end as last_message_preview,
    case
      when lm.id is null then 'none'
      when lm.tea_package_id is not null then 'tea_package'
      else 'text'
    end as last_message_type,
    lm.created_at as last_message_at
  from peers p
  join public.profiles pr on pr.id = p.friend_id
  left join latest_message lm
    on (
      (lm.sender_id = p.friend_id and lm.recipient_id = (select id from me))
      or (lm.sender_id = (select id from me) and lm.recipient_id = p.friend_id)
    )
  order by lm.created_at desc nulls last, coalesce(pr.first_name, pr.search_email, '') asc;
$$;

create or replace function public.list_circle_messages(p_friend_id uuid)
returns table (
  message_id uuid,
  sender_id uuid,
  recipient_id uuid,
  body text,
  tea_package_id uuid,
  created_at timestamptz
)
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

  if not exists (
    select 1
    from public.friendships f
    where (
      (f.requester_id = me and f.addressee_id = p_friend_id)
      or (f.requester_id = p_friend_id and f.addressee_id = me)
    )
      and f.status = 'accepted'
  ) then
    raise exception 'Not friends with this user';
  end if;

  return query
  select
    cm.id as message_id,
    cm.sender_id,
    cm.recipient_id,
    cm.body,
    cm.tea_package_id,
    cm.created_at
  from public.circle_messages cm
  where
    (cm.sender_id = me and cm.recipient_id = p_friend_id)
    or (cm.sender_id = p_friend_id and cm.recipient_id = me)
  order by cm.created_at asc
  limit 500;
end;
$$;

create or replace function public.send_circle_text_message(
  p_friend_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid;
  new_id uuid;
begin
  me := auth.uid();
  if me is null then
    raise exception 'Not authenticated';
  end if;

  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'Message body required';
  end if;

  if not exists (
    select 1
    from public.friendships f
    where (
      (f.requester_id = me and f.addressee_id = p_friend_id)
      or (f.requester_id = p_friend_id and f.addressee_id = me)
    )
      and f.status = 'accepted'
  ) then
    raise exception 'Not friends with this user';
  end if;

  insert into public.circle_messages (sender_id, recipient_id, body)
  values (me, p_friend_id, trim(p_body))
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.send_tea_package_message(
  p_recipient_id uuid,
  p_roster_person_id uuid,
  p_note text default null,
  p_include_registry boolean default true,
  p_include_profile_summary boolean default true,
  p_include_chat_summary boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid;
  tea_id uuid;
  digest text;
  roster_name text;
  roster_summary text;
  latest_chat_summary text;
begin
  me := auth.uid();
  if me is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.friendships f
    where (
      (f.requester_id = me and f.addressee_id = p_recipient_id)
      or (f.requester_id = p_recipient_id and f.addressee_id = me)
    )
      and f.status = 'accepted'
  ) then
    raise exception 'Not friends with recipient';
  end if;

  select rp.display_name, rp.ai_summary
  into roster_name, roster_summary
  from public.roster_people rp
  where rp.id = p_roster_person_id
    and rp.owner_id = me;

  if not found then
    raise exception 'Roster person not found';
  end if;

  select cu.ai_summary
  into latest_chat_summary
  from public.chat_uploads cu
  where cu.roster_person_id = p_roster_person_id
    and cu.owner_id = me
  order by cu.created_at desc
  limit 1;

  digest := 'Tea package for ' || roster_name
    || case when p_include_profile_summary and roster_summary is not null then ': ' || roster_summary else '' end
    || case when p_include_chat_summary and latest_chat_summary is not null then ' | Chat: ' || latest_chat_summary else '' end
    || case when p_note is not null and length(trim(p_note)) > 0 then ' | Note: ' || trim(p_note) else '' end;

  insert into public.tea_packages (
    sender_id,
    roster_person_id,
    note,
    include_registry,
    include_profile_summary,
    include_chat_summary,
    ai_digest
  )
  values (
    me,
    p_roster_person_id,
    nullif(trim(p_note), ''),
    p_include_registry,
    p_include_profile_summary,
    p_include_chat_summary,
    digest
  )
  returning id into tea_id;

  insert into public.tea_package_recipients (tea_package_id, recipient_id)
  values (tea_id, p_recipient_id);

  insert into public.circle_messages (sender_id, recipient_id, tea_package_id)
  values (me, p_recipient_id, tea_id);

  return tea_id;
end;
$$;

revoke all on function public.list_circle_threads() from public;
revoke all on function public.list_circle_messages(uuid) from public;
revoke all on function public.send_circle_text_message(uuid, text) from public;
revoke all on function public.send_tea_package_message(uuid, uuid, text, boolean, boolean, boolean) from public;

grant execute on function public.list_circle_threads() to authenticated;
grant execute on function public.list_circle_messages(uuid) to authenticated;
grant execute on function public.send_circle_text_message(uuid, text) to authenticated;
grant execute on function public.send_tea_package_message(uuid, uuid, text, boolean, boolean, boolean) to authenticated;
