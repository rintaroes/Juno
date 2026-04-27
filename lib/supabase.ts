import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createClient,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js';
import type { Database, TablesInsert } from './database.types';

let client: SupabaseClient<Database> | null = null;

/** Call when you need the client; throws if `EXPO_PUBLIC_SUPABASE_*` are unset. */
export function getSupabase(): SupabaseClient<Database> {
  if (client) return client;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, '');
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Add them to .env (see .env.example).',
    );
  }
  client = createClient<Database>(url, anonKey, {
    auth: {
      storage: AsyncStorage,
      // Persisted session required so background location task can call `update_my_live_location`.
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

type UpsertProfileInput = Pick<TablesInsert<'profiles'>, 'id' | 'search_email'> &
  Partial<Pick<TablesInsert<'profiles'>, 'first_name' | 'city'>>;

export async function upsertProfile(values: UpsertProfileInput) {
  const { error } = await getSupabase()
    .from('profiles')
    .upsert(values, { onConflict: 'id' });
  if (error) throw error;
}

export async function ensureProfileForUser(user: User) {
  await upsertProfile({
    id: user.id,
    search_email: user.email?.toLowerCase() ?? null,
  });
}
