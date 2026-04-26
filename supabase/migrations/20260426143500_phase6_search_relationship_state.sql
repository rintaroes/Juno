drop function if exists public.search_friend_profiles(text);
drop function if exists public.list_circle_relationships();

create function public.search_friend_profiles(p_query text)
returns table (
  profile_id uuid,
  first_name text,
  username text,
  city text,
  search_email text,
  matched_on text,
  relationship_status text,
  relationship_direction text
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
      p.search_email,
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
      and (
        (p.username is not null and p.discoverable_by_username and lower(p.username) like lower('%' || q || '%'))
        or (p.search_email is not null and p.discoverable_by_email and lower(p.search_email) like lower('%' || q || '%'))
        or (p.phone_e164 is not null and p.discoverable_by_phone and p.phone_e164 like '%' || q || '%')
        or (p.first_name is not null and lower(p.first_name) like lower('%' || q || '%'))
      )
  ),
  rel as (
    select
      c.id as profile_id,
      f.status as relationship_status,
      case
        when f.id is null then null
        when f.status = 'accepted' then 'friend'
        when f.requester_id = me.id then 'outgoing'
        else 'incoming'
      end as relationship_direction
    from candidates c
    cross join me
    left join public.friendships f
      on (
        (f.requester_id = me.id and f.addressee_id = c.id)
        or (f.requester_id = c.id and f.addressee_id = me.id)
      )
  )
  select
    c.id as profile_id,
    c.first_name,
    c.username,
    c.city,
    c.search_email,
    c.matched_on,
    r.relationship_status,
    r.relationship_direction
  from candidates c
  left join rel r on r.profile_id = c.id
  where c.matched_on is not null
    and (
      c.first_name is not null
      or c.username is not null
      or c.search_email is not null
    )
    and (
      coalesce(r.relationship_status, '') <> 'pending'
      or coalesce(r.relationship_direction, '') <> 'incoming'
      or exists (
        select 1
        from public.profiles p2
        where p2.id = c.id and p2.allow_friend_requests
      )
    )
  order by c.username nulls last, c.first_name nulls last
  limit 25;
end;
$$;

create function public.list_circle_relationships()
returns table (
  friendship_id uuid,
  status text,
  direction text,
  profile_id uuid,
  first_name text,
  username text,
  city text,
  search_email text
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
    p.city,
    p.search_email
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
    coalesce(p.username, p.first_name, p.search_email, '') asc;
$$;

revoke all on function public.search_friend_profiles(text) from public;
revoke all on function public.list_circle_relationships() from public;
grant execute on function public.search_friend_profiles(text) to authenticated;
grant execute on function public.list_circle_relationships() to authenticated;
