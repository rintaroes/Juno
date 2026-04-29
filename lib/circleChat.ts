import { getSupabase } from './supabase';
import type { Tables } from './database.types';

export type CircleThread = {
  friend_id: string;
  friend_name: string;
  friend_username: string | null;
  friend_city: string | null;
  friend_email: string | null;
  last_message_id: string | null;
  last_message_preview: string | null;
  last_message_type: 'none' | 'text' | 'tea_package';
  last_message_at: string | null;
};

export type CircleMessage = {
  message_id: string;
  sender_id: string;
  recipient_id: string;
  body: string | null;
  tea_package_id: string | null;
  created_at: string;
};

export type TeaPackageDetail = Tables<'tea_packages'> & {
  roster_display_name: string | null;
};

export async function listCircleThreads() {
  const { data, error } = await getSupabase().rpc('list_circle_threads');
  if (error) throw error;
  return (data ?? []) as CircleThread[];
}

export async function listCircleMessages(friendId: string) {
  const { data, error } = await getSupabase().rpc('list_circle_messages', {
    p_friend_id: friendId,
  });
  if (error) throw error;
  return (data ?? []) as CircleMessage[];
}

export async function sendCircleTextMessage(friendId: string, body: string) {
  const { error } = await getSupabase().rpc('send_circle_text_message', {
    p_friend_id: friendId,
    p_body: body,
  });
  if (error) throw error;
}

export async function sendTeaPackageMessage(args: {
  recipientId: string;
  rosterPersonId: string;
  note?: string;
  includeRegistry?: boolean;
  includeProfileSummary?: boolean;
  includeChatSummary?: boolean;
}) {
  const { data, error } = await getSupabase().rpc('send_tea_package_message', {
    p_recipient_id: args.recipientId,
    p_roster_person_id: args.rosterPersonId,
    p_note: args.note ?? null,
    p_include_registry: args.includeRegistry ?? true,
    p_include_profile_summary: args.includeProfileSummary ?? true,
    p_include_chat_summary: args.includeChatSummary ?? true,
  });
  if (error) throw error;
  return data as string;
}

export async function listRosterForTea(ownerId: string) {
  const { data, error } = await getSupabase()
    .from('roster_people')
    .select('id, display_name, ai_summary, notes')
    .eq('owner_id', ownerId)
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function getTeaPackageDetail(teaPackageId: string) {
  const { data, error } = await getSupabase()
    .from('tea_packages')
    .select(
      'id, sender_id, roster_person_id, note, include_registry, include_profile_summary, include_chat_summary, ai_digest, created_at',
    )
    .eq('id', teaPackageId)
    .single();
  if (error) {
    console.log('[tea] getTeaPackageDetail tea_packages error', {
      teaPackageId,
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    throw error;
  }
  const { data: rosterRow } = await getSupabase()
    .from('roster_people')
    .select('display_name')
    .eq('id', data.roster_person_id)
    .maybeSingle();
  return {
    ...(data as Tables<'tea_packages'>),
    roster_display_name: rosterRow?.display_name ?? null,
  } as TeaPackageDetail;
}
