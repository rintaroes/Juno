import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database, TablesInsert } from './database.types';

let client: SupabaseClient<Database> | null = null;

/** Call when you need the client; throws if `EXPO_PUBLIC_SUPABASE_*` are unset. */
export function getSupabase(): SupabaseClient<Database> {
  if (client) return client;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Add them to .env (see .env.example).',
    );
  }
  client = createClient<Database>(url, anonKey, {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

type UpsertProfileInput = Pick<TablesInsert<'profiles'>, 'id' | 'first_name' | 'city'>;

export async function upsertProfile(values: UpsertProfileInput) {
  const { error } = await getSupabase()
    .from('profiles')
    .upsert(values, { onConflict: 'id' });
  if (error) throw error;
}
