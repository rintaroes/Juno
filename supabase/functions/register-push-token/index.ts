// @ts-nocheck
import { createClient } from 'jsr:@supabase/supabase-js@2';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', Connection: 'keep-alive' },
  });
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

  let body: { expo_push_token?: string; platform?: string };
  try {
    body = (await req.json()) as { expo_push_token?: string; platform?: string };
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const token = body.expo_push_token?.trim();
  if (!token || !token.startsWith('ExponentPushToken[')) {
    return jsonResponse(400, { error: 'Valid expo_push_token is required' });
  }

  const platform = body.platform?.trim() || null;

  const { error } = await adminClient.from('push_devices').upsert(
    {
      user_id: user.id,
      expo_push_token: token,
      platform,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,expo_push_token' },
  );

  if (error) {
    console.error(JSON.stringify({ stage: 'push_device_upsert', error }));
    return jsonResponse(500, { error: 'Could not save push token' });
  }

  return jsonResponse(200, { ok: true });
});
