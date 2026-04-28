import { getSupabase } from './supabase';
import type { InviteFriend } from '../stores/onboardingStore';

function generateInviteCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

export async function sendOnboardingInvites(
  friends: InviteFriend[],
  inviteMessage: string,
): Promise<void> {
  const payload = friends.map((friend) => ({
    name: friend.name,
    phone: friend.phone,
    invite_code: generateInviteCode(),
    channel: 'sms',
    message: inviteMessage,
  }));

  await getSupabase().from('invitations' as never).insert(payload as never);

  const { error } = await getSupabase().functions.invoke('send-circle-invites', {
    body: { invites: payload },
  });
  if (error) throw error;
}
