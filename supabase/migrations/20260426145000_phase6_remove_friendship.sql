create or replace function public.remove_friendship(p_friendship_id uuid)
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

  delete from public.friendships
  where id = p_friendship_id
    and (requester_id = me or addressee_id = me);

  if not found then
    raise exception 'Friendship not found';
  end if;
end;
$$;

revoke all on function public.remove_friendship(uuid) from public;
grant execute on function public.remove_friendship(uuid) to authenticated;
