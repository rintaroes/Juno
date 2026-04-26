import { getSupabase } from './supabase';
import type { Tables } from './database.types';

export type ChatUpload = Tables<'chat_uploads'>;

export async function listChatUploads(ownerId: string, rosterPersonId: string) {
  const { data, error } = await getSupabase()
    .from('chat_uploads')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('roster_person_id', rosterPersonId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
