// @ts-nocheck
import { createClient } from 'jsr:@supabase/supabase-js@2';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', Connection: 'keep-alive' },
  });
}

async function sendExpoPush(messages: Record<string, unknown>[]) {
  if (!messages.length) return { ok: true, sent: 0 };
  const expoAccess = Deno.env.get('EXPO_ACCESS_TOKEN')?.trim();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (expoAccess) headers.Authorization = `Bearer ${expoAccess}`;
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error('expo_push_error', res.status, text);
    return { ok: false, error: text };
  }
  return { ok: true, sent: messages.length };
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

  let body: { sessionId?: string; kind?: string };
  try {
    body = (await req.json()) as { sessionId?: string; kind?: string };
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const sessionId = body.sessionId?.trim();
  const kind = body.kind?.trim();
  if (!sessionId || (kind !== 'im_safe' && kind !== 'alert_circle')) {
    return jsonResponse(400, { error: 'sessionId and kind (im_safe | alert_circle) are required' });
  }

  const { data: session, error: sErr } = await adminClient
    .from('date_sessions')
    .select('id, user_id, status, companion_display_name')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (sErr || !session) {
    return jsonResponse(404, { error: 'Active date session not found' });
  }

  const { data: meProfile } = await adminClient
    .from('profiles')
    .select('first_name')
    .eq('id', user.id)
    .maybeSingle();
  const senderLabel = meProfile?.first_name?.trim() || 'Your friend';

  const { data: friendships, error: fErr } = await adminClient
    .from('friendships')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  if (fErr) {
    return jsonResponse(500, { error: 'Could not load circle' });
  }

  const friendIds = new Set<string>();
  for (const row of friendships ?? []) {
    const other =
      row.requester_id === user.id ? row.addressee_id : row.requester_id;
    if (other) friendIds.add(other);
  }

  if (!friendIds.size) {
    return jsonResponse(200, { ok: true, sent: 0 });
  }

  const { data: devices } = await adminClient
    .from('push_devices')
    .select('expo_push_token')
    .in('user_id', [...friendIds]);

  const tokens = [...new Set((devices ?? []).map((d) => d.expo_push_token).filter(Boolean))];
  const title = kind === 'im_safe' ? 'Check-in' : 'Alert';
  const bodyText =
    kind === 'im_safe'
      ? `${senderLabel} marked safe during a date (with ${session.companion_display_name}).`
      : `${senderLabel} sent an alert from a date (with ${session.companion_display_name}). Open Juno.`;

  const payload = tokens.map((to) => ({
    to,
    title,
    body: bodyText,
    sound: 'default',
    priority: 'high',
    data: { type: kind, sessionId },
  }));

  const pushResult = await sendExpoPush(payload);
  if (!pushResult.ok) {
    return jsonResponse(502, { error: 'Expo push failed', detail: pushResult.error });
  }

  return jsonResponse(200, { ok: true, sent: tokens.length });
});
