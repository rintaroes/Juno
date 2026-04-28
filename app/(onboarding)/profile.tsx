import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { OnboardingButton, OnboardingHeader, OnboardingScreen } from '../../components/onboarding';
import { trackOnboardingEvent } from '../../lib/onboardingAnalytics';
import { getSupabase } from '../../lib/supabase';
import { colors, fontFamily } from '../../theme';
import { useOnboardingStep } from './useOnboardingStep';

export default function ProfileScreen() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [pending, setPending] = useState(false);
  useOnboardingStep(12, 'profile');

  const onContinue = async () => {
    setPending(true);
    try {
      const {
        data: { user },
      } = await getSupabase().auth.getUser();
      if (user?.id) {
        await getSupabase().from('profiles').upsert({ id: user.id, first_name: firstName.trim() });
      }
      void trackOnboardingEvent('onboarding_profile_saved');
      router.push('/(onboarding)/circle');
    } finally {
      setPending(false);
    }
  };

  return (
    <OnboardingScreen step={12}>
      <View style={styles.main}>
        <OnboardingHeader>What should we call you?</OnboardingHeader>
        <TextInput
          style={styles.input}
          placeholder="First name"
          placeholderTextColor={colors.stone}
          value={firstName}
          onChangeText={setFirstName}
        />
        <TextInput
          style={styles.input}
          placeholder="Last name"
          placeholderTextColor={colors.stone}
          value={lastName}
          onChangeText={setLastName}
        />
        <Text style={styles.hint}>Optional - only used when inviting your circle.</Text>
      </View>
      <OnboardingButton label={pending ? 'Saving...' : 'Continue'} onPress={() => void onContinue()} disabled={!firstName.trim() || pending} />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, gap: 12 },
  input: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stone,
    backgroundColor: colors.cream,
    paddingHorizontal: 16,
    fontFamily: fontFamily.inter,
    fontSize: 16,
    color: colors.charcoal,
  },
  hint: { fontFamily: fontFamily.inter, color: colors.stone, fontSize: 13 },
});
