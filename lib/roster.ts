import { getSupabase } from './supabase';
import type { Tables, TablesInsert, TablesUpdate } from './database.types';

export type RosterPerson = Tables<'roster_people'>;

type RosterCreateInput = Pick<
  TablesInsert<'roster_people'>,
  'display_name' | 'estimated_age' | 'dob' | 'state' | 'zip' | 'notes'
> & {
  owner_id: string;
};

type RosterUpdateInput = Pick<
  TablesUpdate<'roster_people'>,
  'display_name' | 'estimated_age' | 'dob' | 'state' | 'zip' | 'notes'
>;

export async function listRosterPeople(ownerId: string, includeArchived = false) {
  let query = getSupabase()
    .from('roster_people')
    .select('*')
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false });

  if (!includeArchived) {
    query = query.is('archived_at', null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getRosterPerson(ownerId: string, personId: string) {
  const { data, error } = await getSupabase()
    .from('roster_people')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('id', personId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createRosterPerson(input: RosterCreateInput) {
  const payload: TablesInsert<'roster_people'> = {
    owner_id: input.owner_id,
    display_name: input.display_name.trim(),
    estimated_age: input.estimated_age ?? null,
    dob: input.dob || null,
    state: input.state?.trim() || null,
    zip: input.zip?.trim() || null,
    notes: input.notes?.trim() || null,
    source: 'manual',
  };

  const { data, error } = await getSupabase()
    .from('roster_people')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateRosterPerson(
  ownerId: string,
  personId: string,
  input: RosterUpdateInput,
) {
  const payload: TablesUpdate<'roster_people'> = {
    display_name: input.display_name?.trim(),
    estimated_age: input.estimated_age ?? null,
    dob: input.dob || null,
    state: input.state?.trim() || null,
    zip: input.zip?.trim() || null,
    notes: input.notes?.trim() || null,
  };

  const { data, error } = await getSupabase()
    .from('roster_people')
    .update(payload)
    .eq('owner_id', ownerId)
    .eq('id', personId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function setRosterArchived(
  ownerId: string,
  personId: string,
  shouldArchive: boolean,
) {
  const { error } = await getSupabase()
    .from('roster_people')
    .update({ archived_at: shouldArchive ? new Date().toISOString() : null })
    .eq('owner_id', ownerId)
    .eq('id', personId);
  if (error) throw error;
}

export async function deleteRosterPerson(ownerId: string, personId: string) {
  const { error } = await getSupabase()
    .from('roster_people')
    .delete()
    .eq('owner_id', ownerId)
    .eq('id', personId);
  if (error) throw error;
}
