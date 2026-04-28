import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  OnboardingBody,
  OnboardingButton,
  OnboardingCharacter,
  OnboardingHeader,
  OnboardingScreen,
} from '../../../components/onboarding';
import { trackOnboardingEvent } from '../../../lib/onboardingAnalytics';
import { colors, fontFamily } from '../../../theme';
import { useOnboardingStep } from '../useOnboardingStep';

const loadingFrames = [
  'Searching public records...',
  'Cross-referencing socials...',
  'Compiling results...',
];

export default function FirstCheckScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [frame, setFrame] = useState(0);
  const [showResult, setShowResult] = useState(false);
  useOnboardingStep(15, 'first_check');

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => setFrame((value) => (value + 1) % loadingFrames.length), 800);
    const done = setTimeout(() => {
      setLoading(false);
      setShowResult(true);
    }, 2600);
    return () => {
      clearInterval(interval);
      clearTimeout(done);
    };
  }, [loading]);

  return (
    <OnboardingScreen step={15}>
      <View style={styles.main}>
        <OnboardingHeader>Try it on someone.</OnboardingHeader>
        <OnboardingBody>Run your first check on us. Type a name - anyone. Even yourself.</OnboardingBody>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Type a name..."
          placeholderTextColor={colors.stone}
          style={styles.input}
        />
        <Pressable><Text style={styles.upload}>Or upload a photo</Text></Pressable>
        <View style={styles.characterWrap}>
          <OnboardingCharacter variant="peeking" size={300} />
        </View>
      </View>
      <OnboardingButton
        label={loading ? loadingFrames[frame] : 'Run check'}
        onPress={() => {
          void trackOnboardingEvent('onboarding_first_check_started', { hasName: !!name.trim() });
          setLoading(true);
        }}
      />

      {showResult ? (
        <View style={styles.resultOverlay}>
          <OnboardingCharacter variant="settled" size={260} />
          <Text style={styles.resultTitle}>Possible matches in 2 states</Text>
          <Text style={styles.resultBody}>This was a demo. Your real checks unlock with Juno Plus.</Text>
          <OnboardingButton
            label="See what Juno Plus unlocks"
            onPress={() => {
              setShowResult(false);
              router.push('/(onboarding)/paywall');
            }}
          />
        </View>
      ) : null}
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  main: { gap: 14 },
  input: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stone,
    backgroundColor: colors.cream,
    paddingHorizontal: 16,
    fontFamily: fontFamily.inter,
    fontSize: 17,
    color: colors.charcoal,
  },
  upload: { fontFamily: fontFamily.inter, fontSize: 14, color: colors.stone, textDecorationLine: 'underline' },
  characterWrap: { alignItems: 'center', marginTop: 4 },
  resultOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: colors.cream,
    paddingHorizontal: 24,
    paddingTop: 120,
    gap: 14,
  },
  resultTitle: { fontFamily: fontFamily.fraunces, fontSize: 30, color: colors.charcoal },
  resultBody: { fontFamily: fontFamily.inter, fontSize: 14, color: colors.stone, lineHeight: 20 },
});
