import { getSupabase } from './supabase';
import type { Tables, TablesUpdate } from './database.types';

export type RegistryCheck = Tables<'registry_checks'>;

export async function getRegistryCheck(ownerId: string, checkId: string) {
  const { data, error } = await getSupabase()
    .from('registry_checks')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('id', checkId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listRegistryChecksForRoster(
  ownerId: string,
  rosterPersonId: string,
) {
  const { data, error } = await getSupabase()
    .from('registry_checks')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('roster_person_id', rosterPersonId)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  return data ?? [];
}

export async function linkRegistryCheckToRoster(
  ownerId: string,
  checkId: string,
  rosterPersonId: string,
) {
  const patch: TablesUpdate<'registry_checks'> = { roster_person_id: rosterPersonId };
  const { data, error } = await getSupabase()
    .from('registry_checks')
    .update(patch)
    .eq('owner_id', ownerId)
    .eq('id', checkId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
