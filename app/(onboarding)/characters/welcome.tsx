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

export default function WelcomeScreen() {
  const router = useRouter();
  useOnboardingStep(1, 'welcome');

  return (
    <OnboardingScreen step={1}>
      <View style={styles.main}>
        <OnboardingHeader size={40}>For the girls.</OnboardingHeader>
        <OnboardingBody>
          Juno is the safety app you&apos;ll actually use - because your friends use it too.
        </OnboardingBody>
        <View style={styles.characterWrap}>
          <OnboardingCharacter variant="trio" size={350} />
        </View>
      </View>
      <View>
        <OnboardingButton label="Get started" onPress={() => router.push('/(onboarding)/pitch')} />
        <OnboardingButton
          variant="ghost"
          label="Already have an account? Sign in"
          onPress={() => router.push('/auth')}
        />
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, gap: 16 },
  characterWrap: { marginTop: 4, alignItems: 'center', justifyContent: 'center', flex: 1 },
});
