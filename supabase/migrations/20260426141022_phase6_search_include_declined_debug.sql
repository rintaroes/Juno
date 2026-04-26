-- Reconciliation migration: this name exists in remote migration history.
-- Keep function definition idempotent and equivalent to current behavior.
create or replace function public.search_friend_profiles(p_query text)
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
