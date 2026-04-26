// @ts-nocheck
/**
 * Intended to be invoked on a schedule (pg_cron + pg_net) with:
 *   Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 * See supabase/cron-examples/invoke-check-date-timers.sql
 */
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

  const authHeader = req.headers.get('Authorization')?.trim();
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  const supabaseUrl = Deno.env.get('SUPABASE_URL');

  if (!authHeader || !serviceRoleKey || !supabaseUrl) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  if (authHeader !== `Bearer ${serviceRoleKey}`) {
    return jsonResponse(401, { error: 'Invalid service authorization' });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: due, error: qErr } = await adminClient.rpc('list_expired_date_timer_sessions');
  if (qErr) {
    if (qErr.message?.includes('function') && qErr.message?.includes('does not exist')) {
      return jsonResponse(500, {
        error:
          'Run migration: function public.list_expired_date_timer_sessions is missing (re-apply latest migrations).',
      });
    }
    console.error(JSON.stringify({ stage: 'list_expired', error: qErr }));
    return jsonResponse(500, { error: 'Query failed' });
  }

  const rows = (due ?? []) as {
    session_id: string;
    user_id: string;
    companion_display_name: string;
    first_name: string | null;
  }[];

  let totalSent = 0;

  for (const row of rows) {
    const senderLabel = row.first_name?.trim() || 'Your friend';

    const { data: friendships } = await adminClient
      .from('friendships')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${row.user_id},addressee_id.eq.${row.user_id}`);

    const friendIds = new Set<string>();
    for (const fr of friendships ?? []) {
      const other =
        fr.requester_id === row.user_id ? fr.addressee_id : fr.requester_id;
      if (other) friendIds.add(other);
    }

    if (!friendIds.size) {
      await adminClient
        .from('date_sessions')
        .update({ timer_push_sent_at: new Date().toISOString() })
        .eq('id', row.session_id);
      continue;
    }

    const { data: devices } = await adminClient
      .from('push_devices')
      .select('expo_push_token')
      .in('user_id', [...friendIds]);

    const tokens = [...new Set((devices ?? []).map((d) => d.expo_push_token).filter(Boolean))];
    const title = 'Date timer';
    const bodyText = `${senderLabel}'s check-in timer ended (date with ${row.companion_display_name}).`;

    const payload = tokens.map((to) => ({
      to,
      title,
      body: bodyText,
      sound: 'default',
      priority: 'high',
      data: { type: 'date_timer_ended', sessionId: row.session_id },
    }));

    const pushResult = await sendExpoPush(payload);
    if (!pushResult.ok) {
      console.error(JSON.stringify({ stage: 'expo', session: row.session_id, pushResult }));
      continue;
    }

    totalSent += tokens.length;
    await adminClient
      .from('date_sessions')
      .update({ timer_push_sent_at: new Date().toISOString() })
      .eq('id', row.session_id);
  }

  return jsonResponse(200, { ok: true, sessions: rows.length, pushes: totalSent });
});
