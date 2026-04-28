import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { OnboardingBody, OnboardingButton, OnboardingHeader, OnboardingScreen } from '../../components/onboarding';
import { colors, fontFamily } from '../../theme';
import { useOnboardingStep } from './useOnboardingStep';

const quotes = [
  { text: 'I made my whole group chat download this.', author: 'Maya, 24' },
  { text: 'Found out he had two other Hinge profiles. One name. Two ages.', author: 'Anonymous' },
  { text: "My circle texts me 'tea?' every Sunday. This is the answer.", author: 'Coco, 26' },
];

export default function ProofScreen() {
  const router = useRouter();
  useOnboardingStep(3, 'proof');
  return (
    <OnboardingScreen step={3}>
      <View style={styles.main}>
        <OnboardingHeader>Built by women, for women.</OnboardingHeader>
        <OnboardingBody>
          Because &apos;just text me when you get home&apos; was never enough. Juno gives you and your
          friends real eyes on each other - and real info on him.
        </OnboardingBody>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {quotes.map((quote) => (
            <View key={quote.text} style={styles.card}>
              <Text style={styles.quote}>&ldquo;{quote.text}&rdquo;</Text>
              <Text style={styles.author}>{quote.author}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
      <OnboardingButton label="Continue" onPress={() => router.push('/(onboarding)/why-here')} />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, gap: 16 },
  row: { gap: 12, paddingVertical: 8, paddingRight: 8 },
  card: {
    width: 290,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: 24,
    padding: 16,
    backgroundColor: colors.surfaceContainerLowest,
    justifyContent: 'space-between',
    minHeight: 154,
    gap: 12,
  },
  quote: { fontFamily: fontFamily.medium, color: colors.onSurface, fontSize: 16, lineHeight: 24 },
  author: { fontFamily: fontFamily.regular, color: colors.tertiary, fontSize: 13 },
});
