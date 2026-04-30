import { Redirect } from 'expo-router';
import { CIRCLES_MESSAGING_ENABLED } from '../../lib/featureFlags';

export default function CirclesIndexScreen() {
  if (!CIRCLES_MESSAGING_ENABLED) {
    return <Redirect href="/circles/settings" />;
  }

  return <Redirect href="/circles/settings" />;
}
