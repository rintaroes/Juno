import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { OnboardingButton, OnboardingHeader, OnboardingScreen } from '../../components/onboarding';
import { trackOnboardingEvent } from '../../lib/onboardingAnalytics';
import { colors, fontFamily } from '../../theme';
import { useOnboardingStep } from './useOnboardingStep';

export default function ProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const seedEmail = Array.isArray(params.email) ? params.email[0] ?? '' : params.email ?? '';
  const [email, setEmail] = useState(seedEmail);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  useOnboardingStep(11, 'profile');
  const canContinue = useMemo(
    () => firstName.trim().length > 0 && email.trim().includes('@'),
    [email, firstName],
  );

  const onContinue = async () => {
    void trackOnboardingEvent('onboarding_profile_saved');
    router.push({
      pathname: '/(onboarding)/password',
      params: {
        email: email.trim().toLowerCase(),
        firstName: firstName.trim(),
      },
    });
  };

  return (
    <OnboardingScreen step={11}>
      <View style={styles.main}>
        <OnboardingHeader>What should we call you?</OnboardingHeader>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.stone}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
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
      <OnboardingButton label="Continue" onPress={() => void onContinue()} disabled={!canContinue} />
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
