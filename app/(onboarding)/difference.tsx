import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import {
  OnboardingBody,
  OnboardingButton,
  OnboardingCharacter,
  OnboardingHeader,
  OnboardingScreen,
} from '../../components/onboarding';
import { useOnboardingStep } from './useOnboardingStep';

export default function DifferenceScreen() {
  const router = useRouter();
  useOnboardingStep(6, 'difference');
  return (
    <OnboardingScreen step={6}>
      <View style={styles.main}>
        <OnboardingHeader>Juno turns your group chat into a safety net.</OnboardingHeader>
        <OnboardingBody>
          Real searches. Real-time location. Real intel shared between you and your closest friends
          - with no awkward &apos;are you home yet?&apos; texts at midnight.
        </OnboardingBody>
        <OnboardingCharacter variant="heart" size={260} />
      </View>
      <OnboardingButton label="Continue" onPress={() => router.push('/(onboarding)/roster')} />
    </OnboardingScreen>
  );
}
const styles = StyleSheet.create({ main: { flex: 1, gap: 16 } });
