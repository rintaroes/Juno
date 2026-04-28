import { ReactNode } from 'react';
import { Text, StyleSheet } from 'react-native';
import { colors, fontFamily, lineHeight } from '../../theme';

export function OnboardingHeader({
  children,
  size = 36,
}: {
  children: ReactNode;
  size?: number;
}) {
  return <Text style={[styles.header, { fontSize: size, lineHeight: lineHeight(size, 1.15) }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  header: {
    color: colors.primary,
    fontFamily: fontFamily.bold,
    letterSpacing: -0.24,
  },
});
