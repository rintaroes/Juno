// @ts-nocheck
import { createClient } from 'jsr:@supabase/supabase-js@2';

type RequestPayload = {
  name?: string;
  age?: number;
  dob?: string;
  city?: string;
  state?: string;
  zip?: string;
  rosterPersonId?: string;
};

type MatchRow = {
  name: string;
  age?: string;
  dob?: string;
  state?: string;
  zip?: string;
  mugshotUrl?: string;
  sourceId?: string;
};

type NormalizedResult = {
  status: 'clear' | 'possible_match' | 'match' | 'error';
  matches: MatchRow[];
  disclaimer: string;
};

const DISCLAIMER =
  'Results may include people with the same or similar name. This is not a definitive identity match.';

const STATE_MAP: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
  DC: 'District of Columbia',
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      Connection: 'keep-alive',
    },
  });
}

/** Local calendar age; parses `YYYY-MM-DD` as civil date (not UTC `Date` string parsing). */
function ageFromDob(dobInput: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dobInput.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const birthMonth = Number(match[2]);
  const birthDay = Number(match[3]);
  if (![y, birthMonth, birthDay].every((n) => Number.isFinite(n))) return null;
  if (birthMonth < 1 || birthMonth > 12 || birthDay < 1 || birthDay > 31) return null;
  const birth = new Date(y, birthMonth - 1, birthDay);
  if (
    birth.getFullYear() !== y ||
    birth.getMonth() !== birthMonth - 1 ||
    birth.getDate() !== birthDay
  ) {
    return null;
  }
  const today = new Date();
  const ty = today.getFullYear();
  const tm = today.getMonth() + 1;
  const td = today.getDate();
  let age = ty - y;
  if (tm < birthMonth || (tm === birthMonth && td < birthDay)) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

/** Deterministic stub when no vendor API is configured. */
function stubRegistryLookup(name: string): NormalizedResult {
  const n = name.toLowerCase().trim();
  if (n.includes('demo_error')) {
    return { status: 'error', matches: [], disclaimer: DISCLAIMER };
  }
  if (n.includes('demo_match')) {
    return {
      status: 'possible_match',
      matches: [
        {
          name: name.trim(),
          age: '40',
          dob: '1985-06-12',
          state: 'NY',
          zip: '10001',
          sourceId: 'stub-registry-1',
        },
      ],
      disclaimer: DISCLAIMER,
    };
  }
  return { status: 'clear', matches: [], disclaimer: DISCLAIMER };
}

async function callVendorRegistry(
  payload: {
    name: string;
    age?: number;
    dob?: string;
    city?: string;
    state?: string;
    zip?: string;
  },
): Promise<NormalizedResult | null> {
  const url = Deno.env.get('REGISTRY_LOOKUP_URL')?.trim();
  const key = Deno.env.get('REGISTRY_LOOKUP_API_KEY')?.trim();
  if (!url) return null;
  if (!key) {
    return { status: 'error', matches: [], disclaimer: DISCLAIMER };
  }

  const [firstName, ...rest] = payload.name.trim().split(/\s+/);
  const lastName = rest.join(' ').trim();
  const stateRaw = payload.state?.trim() || '';
  const stateValue =
    stateRaw.length === 2 ? STATE_MAP[stateRaw.toUpperCase()] ?? stateRaw : stateRaw;

  const requestUrl = new URL(url);
  requestUrl.searchParams.set('key', key);
  if (firstName) requestUrl.searchParams.set('firstName', firstName);
  if (lastName) requestUrl.searchParams.set('lastName', lastName);
  if (payload.dob) requestUrl.searchParams.set('dob', payload.dob);
  if (payload.city?.trim()) requestUrl.searchParams.set('city', payload.city.trim());
  if (stateValue) requestUrl.searchParams.set('state', stateValue);
  if (payload.zip) requestUrl.searchParams.set('zipcode', payload.zip);

  const res = await fetch(requestUrl.toString(), { method: 'GET' });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return { status: 'error', matches: [], disclaimer: DISCLAIMER };
  }

  const offenders = Array.isArray((data as { offenders?: unknown })?.offenders)
    ? ((data as { offenders: Array<Record<string, unknown>> }).offenders ?? [])
    : [];

  const matches: MatchRow[] = offenders.slice(0, 20).map((row) => {
    let mug: string | undefined;
    const imgRaw = row.offenderImageUrl;
    if (typeof imgRaw === 'string') {
      const t = imgRaw.trim();
      if (t && t !== 'null' && /^https?:\/\//i.test(t)) mug = t;
    }
    let ageStr: string | undefined;
    const ageRaw = row.age;
    if (typeof ageRaw === 'number' && Number.isFinite(ageRaw)) {
      ageStr = String(Math.round(ageRaw));
    } else if (typeof ageRaw === 'string') {
      const a = ageRaw.trim();
      if (a) ageStr = a.replace(/[^\d]/g, '') || a;
    }
    const dobStr = typeof row.dob === 'string' ? row.dob.slice(0, 10) : undefined;
    const ageFromDobVal = dobStr ? ageFromDob(dobStr) : null;
    if (ageFromDobVal != null) {
      ageStr = String(ageFromDobVal);
    }
    return {
      name: String(row.name ?? '').trim(),
      age: ageStr,
      dob: dobStr,
      state: typeof row.state === 'string' ? row.state : undefined,
      zip: typeof row.zipcode === 'string' ? row.zipcode : undefined,
      mugshotUrl: mug,
      sourceId: typeof row.personUuid === 'string' ? row.personUuid : undefined,
    };
  }).filter((m) => m.name.length > 0);

  if (!matches.length) {
    return { status: 'clear', matches: [], disclaimer: DISCLAIMER };
  }

  const normalizedQueryName = payload.name.trim().toLowerCase();
  const hasExactName = matches.some(
    (m) => m.name.trim().toLowerCase() === normalizedQueryName,
  );
  const hasDobMatch = payload.dob
    ? matches.some((m) => (m.dob ?? '') === payload.dob)
    : false;

  const status = hasExactName && hasDobMatch ? 'match' : 'possible_match';
  return { status, matches, disclaimer: DISCLAIMER };
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse(401, { error: 'Missing Authorization header' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonResponse(500, { error: 'Missing required environment secrets.' });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  let body: RequestPayload;
  try {
    body = (await req.json()) as RequestPayload;
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const name = body.name?.trim();
  if (!name) {
    return jsonResponse(400, { error: 'name is required' });
  }

  let rosterPersonId: string | null = body.rosterPersonId?.trim() || null;
  if (rosterPersonId) {
    const { data: row, error: rpErr } = await adminClient
      .from('roster_people')
      .select('id')
      .eq('id', rosterPersonId)
      .eq('owner_id', user.id)
      .maybeSingle();
    if (rpErr || !row) {
      return jsonResponse(404, { error: 'Roster person not found' });
    }
  }

  const ageInput =
    typeof body.age === 'number' && Number.isFinite(body.age)
      ? Math.round(body.age)
      : null;
  const dobTrim = body.dob?.trim() || null;
  const dobDerivedAge = dobTrim ? ageFromDob(dobTrim) : null;
  const queryAge = dobDerivedAge != null ? dobDerivedAge : ageInput;
  const city = body.city?.trim() || null;
  const state = body.state?.trim() || null;
  const zip = body.zip?.trim() || null;

  let normalized: NormalizedResult;
  try {
    const vendor = await callVendorRegistry({
      name,
      age: queryAge ?? undefined,
      dob: dobTrim ?? undefined,
      city: city ?? undefined,
      state: state ?? undefined,
      zip: zip ?? undefined,
    });
    normalized = vendor ?? stubRegistryLookup(name);
  } catch {
    normalized = { status: 'error', matches: [], disclaimer: DISCLAIMER };
  }

  const primary = normalized.matches[0];
  const matchedDob = primary?.dob ? primary.dob.slice(0, 10) : null;

  const { data: inserted, error: insErr } = await adminClient
    .from('registry_checks')
    .insert({
      owner_id: user.id,
      roster_person_id: rosterPersonId,
      query_name: name,
      query_age: queryAge,
      query_state: state,
      query_zip: zip,
      status: normalized.status,
      raw_result: {
        input: { name, age: queryAge, dob: dobTrim, city, state, zip },
        vendor: normalized,
      },
      matched_name: primary?.name ?? null,
      matched_dob: matchedDob,
      matched_state: primary?.state ?? null,
      matched_zip: primary?.zip ?? null,
      mugshot_url: primary?.mugshotUrl ?? null,
    })
    .select('id')
    .single();

  if (insErr || !inserted?.id) {
    console.error(JSON.stringify({ stage: 'registry_insert_failed', error: insErr }));
    return jsonResponse(500, { error: 'Could not save registry check' });
  }

  const responseStatus =
    normalized.status === 'clear' ||
    normalized.status === 'possible_match' ||
    normalized.status === 'match'
      ? normalized.status
      : 'error';

  return jsonResponse(200, {
    registryCheckId: inserted.id,
    status: responseStatus === 'error' ? 'error' : responseStatus,
    matches: normalized.matches,
    disclaimer: normalized.disclaimer,
  });
});
