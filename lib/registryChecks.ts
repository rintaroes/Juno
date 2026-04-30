import { getSupabase } from './supabase';
import type { Tables, TablesUpdate } from './database.types';

export type RegistryCheck = Tables<'registry_checks'>;
type LinkRegistryInput = {
  rosterPersonId: string;
  selectedMatch?: {
    name: string;
    dob?: string | null;
    state?: string | null;
    zip?: string | null;
    mugshotUrl?: string | null;
  } | null;
};

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
  input: LinkRegistryInput,
) {
  const patch: TablesUpdate<'registry_checks'> = {
    roster_person_id: input.rosterPersonId,
    matched_name: input.selectedMatch?.name?.trim() || null,
    matched_dob: input.selectedMatch?.dob?.trim()?.slice(0, 10) || null,
    matched_state: input.selectedMatch?.state?.trim() || null,
    matched_zip: input.selectedMatch?.zip?.trim() || null,
    mugshot_url: input.selectedMatch?.mugshotUrl?.trim() || null,
  };
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
