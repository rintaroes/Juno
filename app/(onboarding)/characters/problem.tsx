import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import {
  OnboardingBody,
  OnboardingButton,
  OnboardingCharacter,
  OnboardingHeader,
  OnboardingScreen,
} from '../../../components/onboarding';
import { useOnboardingStep } from '../useOnboardingStep';

export default function ProblemScreen() {
  const router = useRouter();
  useOnboardingStep(5, 'problem');
  return (
    <OnboardingScreen step={5}>
      <View style={styles.main}>
        <OnboardingHeader size={32}>
          Most dating safety advice ends at &apos;just be careful.&apos;
        </OnboardingHeader>
        <OnboardingBody>
          You already are. You screenshot his profile, send it to your group chat, search his name
          on Instagram, drop a pin to your friend, hope she sees it. That&apos;s not a system.
          That&apos;s a workaround.
        </OnboardingBody>
        <OnboardingCharacter variant="concerned" size={280} />
      </View>
      <OnboardingButton label="Continue" onPress={() => router.push('/(onboarding)/difference')} />
    </OnboardingScreen>
  );
}
const styles = StyleSheet.create({ main: { flex: 1, gap: 16, alignItems: 'center' } });
