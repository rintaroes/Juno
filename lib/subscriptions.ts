import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';
import { getSupabase } from './supabase';

let configured = false;

export async function configureRevenueCat() {
  if (configured) return;
  const apiKey =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
  if (!apiKey) return;
  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);
  await Purchases.configure({ apiKey });
  configured = true;
}

export async function startSubscriptionTrial(selectedTier: 'annual' | 'monthly') {
  await configureRevenueCat();
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  if (!current) throw new Error('No active RevenueCat offering found.');
  const candidate = current.availablePackages.find((pkg) =>
    selectedTier === 'annual'
      ? pkg.packageType === 'ANNUAL'
      : pkg.packageType === 'MONTHLY',
  );
  if (!candidate) throw new Error(`No ${selectedTier} package available right now.`);

  await Purchases.purchasePackage(candidate);
  const {
    data: { user },
  } = await getSupabase().auth.getUser();
  if (!user?.id) return;
  await getSupabase()
    .from('profiles')
    .update({ subscription_status: 'trial' } as never)
    .eq('id', user.id);
}
