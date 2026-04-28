import { ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, View } from 'react-native';
import { colors, containerMargin, spacing } from '../../theme';
import { OnboardingProgressDots } from './OnboardingProgressDots';

type Props = {
  children: ReactNode;
  step?: number;
  showProgress?: boolean;
  noScroll?: boolean;
};

export function OnboardingScreen({ children, step = 1, showProgress = true, noScroll }: Props) {
  const content = (
    <View style={styles.inner}>
      {showProgress ? <OnboardingProgressDots currentStep={step} /> : null}
      {children}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {noScroll ? (
        content
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {content}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  scroll: { flexGrow: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: containerMargin,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
  },
});
