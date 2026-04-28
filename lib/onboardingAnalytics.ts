import { getSupabase } from './supabase';

type Payload = Record<string, unknown>;

export async function trackOnboardingEvent(event: string, payload: Payload = {}) {
  try {
    await getSupabase().from('analytics_events' as never).insert({
      event_name: event,
      source: 'onboarding',
      payload,
    } as never);
  } catch (error) {
    console.log('onboarding analytics fallback', event, payload, error);
  }
}
