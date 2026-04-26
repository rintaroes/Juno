import { getSupabase } from '../supabase';

export type RegistryMatch = {
  name: string;
  /** Display age; server prefers value computed from `dob` when DOB is present. */
  age?: string;
  dob?: string;
  state?: string;
  zip?: string;
  mugshotUrl?: string;
  sourceId?: string;
};

export type LookupRegistryInput = {
  name: string;
  age?: number;
  dob?: string;
  city?: string;
  state?: string;
  zip?: string;
  rosterPersonId?: string;
};

export type LookupRegistryResponse = {
  registryCheckId: string;
  status: 'clear' | 'possible_match' | 'match' | 'error';
  matches: RegistryMatch[];
  disclaimer: string;
};

async function readFunctionErrorMessage(fnError: {
  message: string;
  context?: { json?: () => Promise<unknown> };
}): Promise<string> {
  let detail = fnError.message;
  if (fnError.context?.json) {
    try {
      const payload = (await fnError.context.json()) as { error?: string };
      if (payload?.error) detail = payload.error;
    } catch {
      // ignore
    }
  }
  return detail;
}

export async function lookupRegistry(
  input: LookupRegistryInput,
): Promise<LookupRegistryResponse> {
  const { data, error } = await getSupabase().functions.invoke('lookup-registry', {
    body: input,
  });
  if (error) {
    throw new Error(await readFunctionErrorMessage(error));
  }
  const body = data as Partial<LookupRegistryResponse> | null;
  if (
    !body?.registryCheckId ||
    !body.status ||
    !Array.isArray(body.matches) ||
    typeof body.disclaimer !== 'string'
  ) {
    throw new Error('Unexpected response from registry lookup.');
  }
  return body as LookupRegistryResponse;
}
