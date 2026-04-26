import { getSupabase } from './supabase';

export type CircleSearchResult = {
  profile_id: string;
  first_name: string | null;
  username: string | null;
  city: string | null;
  search_email: string | null;
  matched_on: string;
  relationship_status: 'pending' | 'accepted' | 'declined' | null;
  relationship_direction: 'friend' | 'incoming' | 'outgoing' | null;
};

export type CircleRelationship = {
  friendship_id: string;
  status: 'pending' | 'accepted' | 'declined';
  direction: 'friend' | 'incoming' | 'outgoing';
  profile_id: string;
  first_name: string | null;
  username: string | null;
  city: string | null;
  search_email: string | null;
};

export type CirclePrivacySettings = {
  first_name: string | null;
  username: string | null;
  phone_e164: string | null;
  search_email: string | null;
  allow_friend_requests: boolean;
  discoverable_by_username: boolean;
  discoverable_by_email: boolean;
  discoverable_by_phone: boolean;
};

export async function searchFriendProfiles(query: string) {
  const normalized = query.trim();
  if (!normalized) return [];
  const { data, error } = await getSupabase().rpc('search_friend_profiles', {
    p_query: normalized,
  });
  if (error) throw error;
  return (data ?? []) as CircleSearchResult[];
}

export async function requestFriendship(targetProfileId: string) {
  const { error } = await getSupabase().rpc('request_friendship', {
    target_profile_id: targetProfileId,
  });
  if (error) throw error;
}

export async function respondToFriendRequest(friendshipId: string, accept: boolean) {
  const { error } = await getSupabase().rpc('respond_to_friend_request', {
    p_friendship_id: friendshipId,
    p_accept: accept,
  });
  if (error) throw error;
}

export async function removeFriendship(friendshipId: string) {
  const { error } = await getSupabase().rpc('remove_friendship', {
    p_friendship_id: friendshipId,
  });
  if (error) throw error;
}

export async function listCircleRelationships() {
  const { data, error } = await getSupabase().rpc('list_circle_relationships');
  if (error) throw error;
  return (data ?? []) as CircleRelationship[];
}

export async function getCirclePrivacySettings(ownerId: string) {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select(
      'first_name, username, phone_e164, search_email, allow_friend_requests, discoverable_by_username, discoverable_by_email, discoverable_by_phone',
    )
    .eq('id', ownerId)
    .maybeSingle();
  if (error) throw error;
  return data as CirclePrivacySettings | null;
}

export async function updateCirclePrivacySettings(
  ownerId: string,
  payload: Partial<CirclePrivacySettings>,
) {
  const { error } = await getSupabase()
    .from('profiles')
    .upsert(
      {
        id: ownerId,
        ...payload,
      },
      { onConflict: 'id' },
    );
  if (error) throw error;
}
