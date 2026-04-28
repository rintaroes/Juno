import { ReactNode } from 'react';
import { Text, StyleSheet } from 'react-native';
import { colors, fontFamily, lineHeight } from '../../theme';

export function OnboardingBody({ children, size = 15 }: { children: ReactNode; size?: number }) {
  return <Text style={[styles.body, { fontSize: size, lineHeight: lineHeight(size, 1.5) }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  body: {
    color: colors.tertiary,
    fontFamily: fontFamily.regular,
  },
});
