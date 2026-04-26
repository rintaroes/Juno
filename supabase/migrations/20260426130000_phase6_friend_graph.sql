alter table public.profiles
  add column if not exists username text,
  add column if not exists phone_e164 text,
  add column if not exists search_email text,
  add column if not exists allow_friend_requests boolean not null default true,
  add column if not exists discoverable_by_username boolean not null default true,
  add column if not exists discoverable_by_email boolean not null default true,
  add column if not exists discoverable_by_phone boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_username_format_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_username_format_check
      check (
        username is null
        or (
          char_length(username) between 3 and 30
          and username ~ '^[A-Za-z0-9_]+$'
        )
      );
  end if;
end
$$;

create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username))
  where username is not null;

create unique index if not exists profiles_phone_e164_unique_idx
  on public.profiles (phone_e164)
  where phone_e164 is not null;

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'declined')),
  declined_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

comment on table public.friendships is 'Friend requests and accepted circle connections.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'friendships_not_self'
      and conrelid = 'public.friendships'::regclass
  ) then
    alter table public.friendships
      add constraint friendships_not_self
      check (requester_id <> addressee_id);
  end if;
end
$$;

create unique index if not exists friendships_pair_unique_idx
  on public.friendships (
    least(requester_id::text, addressee_id::text),
    greatest(requester_id::text, addressee_id::text)
  );

create index if not exists friendships_requester_idx on public.friendships (requester_id);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id);
create index if not exists friendships_status_idx on public.friendships (status);

alter table public.friendships enable row level security;

drop policy if exists "friendships_select_participants" on public.friendships;
create policy "friendships_select_participants"
  on public.friendships
  for select
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

revoke all on public.friendships from anon;
grant select on public.friendships to authenticated;
grant all on public.friendships to service_role;

create or replace function public.search_friend_profiles(p_query text)
returns table (
  profile_id uuid,
  first_name text,
  username text,
  city text,
  matched_on text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  q text;
begin
  q := nullif(trim(p_query), '');
  if q is null then
    return;
  end if;

  return query
  with me as (
    select auth.uid() as id
  ),
  candidates as (
    select
      p.id,
      p.first_name,
      p.username,
      p.city,
      case
        when p.username is not null
          and p.discoverable_by_username
          and lower(p.username) like lower('%' || q || '%') then 'username'
        when p.search_email is not null
          and p.discoverable_by_email
          and lower(p.search_email) like lower('%' || q || '%') then 'email'
        when p.phone_e164 is not null
          and p.discoverable_by_phone
          and p.phone_e164 like '%' || q || '%' then 'phone'
        when p.first_name is not null
          and lower(p.first_name) like lower('%' || q || '%') then 'name'
        else null
      end as matched_on
    from public.profiles p
    cross join me
    where p.id <> me.id
      and p.allow_friend_requests
      and (
        (p.username is not null and p.discoverable_by_username and lower(p.username) like lower('%' || q || '%'))
        or (p.search_email is not null and p.discoverable_by_email and lower(p.search_email) like lower('%' || q || '%'))
        or (p.phone_e164 is not null and p.discoverable_by_phone and p.phone_e164 like '%' || q || '%')
        or (p.first_name is not null and lower(p.first_name) like lower('%' || q || '%'))
      )
  )
  select
    c.id as profile_id,
    c.first_name,
    c.username,
    c.city,
    c.matched_on
  from candidates c
  where c.matched_on is not null
    and not exists (
      select 1
      from public.friendships f
      cross join me
      where (
        (f.requester_id = me.id and f.addressee_id = c.id)
        or (f.requester_id = c.id and f.addressee_id = me.id)
      )
      and f.status in ('pending', 'accepted')
    )
  order by c.username nulls last, c.first_name nulls last
  limit 25;
end;
$$;

create or replace function public.request_friendship(target_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid;
  row_existing public.friendships%rowtype;
begin
  me := auth.uid();
  if me is null then
    raise exception 'Not authenticated';
  end if;

  if target_profile_id is null or target_profile_id = me then
    raise exception 'Invalid friend request target';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = target_profile_id
      and p.allow_friend_requests
  ) then
    raise exception 'Target user cannot receive friend requests';
  end if;

  select *
  into row_existing
  from public.friendships f
  where (
    (f.requester_id = me and f.addressee_id = target_profile_id)
    or (f.requester_id = target_profile_id and f.addressee_id = me)
  )
  for update;

  if found then
    if row_existing.status = 'accepted' then
      return row_existing.id;
    end if;

    if row_existing.status = 'pending' then
      if row_existing.addressee_id = me then
        update public.friendships
        set status = 'accepted',
            responded_at = now(),
            declined_by = null
        where id = row_existing.id;
        return row_existing.id;
      end if;
      raise exception 'Friend request already pending';
    end if;

    update public.friendships
    set requester_id = me,
        addressee_id = target_profile_id,
        status = 'pending',
        declined_by = null,
        created_at = now(),
        responded_at = null
    where id = row_existing.id;
    return row_existing.id;
  end if;

  insert into public.friendships (requester_id, addressee_id, status)
  values (me, target_profile_id, 'pending')
  returning id into row_existing.id;

  return row_existing.id;
end;
$$;

create or replace function public.respond_to_friend_request(
  p_friendship_id uuid,
  p_accept boolean
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

  update public.friendships
  set status = case when p_accept then 'accepted' else 'declined' end,
      declined_by = case when p_accept then null else me end,
      responded_at = now()
  where id = p_friendship_id
    and status = 'pending'
    and addressee_id = me;

  if not found then
    raise exception 'No pending request found';
  end if;
end;
$$;

create or replace function public.list_circle_relationships()
returns table (
  friendship_id uuid,
  status text,
  direction text,
  profile_id uuid,
  first_name text,
  username text,
  city text
)
language sql
security definer
set search_path = public
as $$
  with me as (
    select auth.uid() as id
  )
  select
    f.id as friendship_id,
    f.status,
    case
      when f.status = 'accepted' then 'friend'
      when f.requester_id = me.id then 'outgoing'
      else 'incoming'
    end as direction,
    p.id as profile_id,
    p.first_name,
    p.username,
    p.city
  from public.friendships f
  join me on true
  join public.profiles p
    on p.id = case when f.requester_id = me.id then f.addressee_id else f.requester_id end
  where f.requester_id = me.id or f.addressee_id = me.id
  order by
    case
      when f.status = 'accepted' then 0
      when f.addressee_id = me.id and f.status = 'pending' then 1
      else 2
    end,
    coalesce(p.username, p.first_name, '') asc;
$$;

revoke all on function public.search_friend_profiles(text) from public;
revoke all on function public.request_friendship(uuid) from public;
revoke all on function public.respond_to_friend_request(uuid, boolean) from public;
revoke all on function public.list_circle_relationships() from public;
grant execute on function public.search_friend_profiles(text) to authenticated;
grant execute on function public.request_friendship(uuid) to authenticated;
grant execute on function public.respond_to_friend_request(uuid, boolean) to authenticated;
grant execute on function public.list_circle_relationships() to authenticated;
