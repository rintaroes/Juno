import { getSupabase } from './supabase';
import type { Tables } from './database.types';

export type LiveLocationRow = Tables<'live_locations'>;
export type DateSessionRow = Tables<'date_sessions'>;

export type FriendMapSnapshot = {
  profile_id: string;
  first_name: string | null;
  username: string | null;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  status: string;
  active_date_session_id: string | null;
  companion_display_name: string | null;
  companion_ai_summary: string | null;
  timer_minutes: number | null;
  session_started_at: string | null;
  updated_at: string | null;
};

export async function listFriendsMapSnapshots(): Promise<FriendMapSnapshot[]> {
  const { data, error } = await getSupabase().rpc('list_friends_map_snapshots');
  if (error) throw error;
  return (data ?? []) as FriendMapSnapshot[];
}

export async function getMyLiveLocation(userId: string): Promise<LiveLocationRow | null> {
  const { data, error } = await getSupabase()
    .from('live_locations')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getMyActiveDateSession(userId: string): Promise<DateSessionRow | null> {
  const { data, error } = await getSupabase()
    .from('date_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateMyLiveLocation(
  lat: number,
  lng: number,
  accuracy: number | null,
): Promise<void> {
  const { error } = await getSupabase().rpc('update_my_live_location', {
    p_lat: lat,
    p_lng: lng,
    p_accuracy: accuracy,
  });
  if (error) throw error;
}

export async function startDateSession(input: {
  rosterPersonId: string;
  timerMinutes: number | null;
  lat: number;
  lng: number;
  accuracy: number | null;
}): Promise<string> {
  const { data, error } = await getSupabase().rpc('start_date_session', {
    p_roster_person_id: input.rosterPersonId,
    p_lat: input.lat,
    p_lng: input.lng,
    p_timer_minutes: input.timerMinutes,
    p_accuracy: input.accuracy,
  });
  if (error) throw error;
  return data as string;
}

export async function endDateSession(): Promise<void> {
  const { error } = await getSupabase().rpc('end_date_session');
  if (error) throw error;
}

async function parseFunctionInvokeError(error: unknown): Promise<string> {
  let detail =
    error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
      ? error.message
      : 'Request failed';
  const maybeContext = error as { context?: { json?: () => Promise<unknown> } };
  if (maybeContext.context?.json) {
    try {
      const payload = (await maybeContext.context.json()) as { error?: string };
      if (payload?.error) detail = payload.error;
    } catch {
      /* ignore */
    }
  }
  return detail;
}

/** Best-effort: notifies accepted friends that date mode started (idempotent server-side). */
export async function notifyCircleDateModeStarted(sessionId: string): Promise<void> {
  const { error } = await getSupabase().functions.invoke('notify-date-mode-started', {
    body: { sessionId },
  });
  if (error) {
    console.warn('[juno] notify-date-mode-started', await parseFunctionInvokeError(error));
  }
}

export type DateSafetyKind = 'im_safe' | 'alert_circle';

export async function sendDateSafetySignal(
  sessionId: string,
  kind: DateSafetyKind,
): Promise<number> {
  const { data, error } = await getSupabase().functions.invoke('date-safety-signal', {
    body: { sessionId, kind },
  });
  if (error) throw new Error(await parseFunctionInvokeError(error));
  const sent = (data as { sent?: number } | null)?.sent;
  return typeof sent === 'number' ? sent : 0;
}
