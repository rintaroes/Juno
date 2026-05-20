import { ReactNode } from 'react';
import { Text, StyleSheet } from 'react-native';
import { colors, fontFamily, lineHeight } from '../../theme';

export function OnboardingHeader({
  children,
  size = 36,
  italic = false,
}: {
  children: ReactNode;
  size?: number;
  italic?: boolean;
}) {
  return (
    <Text
      style={[
        styles.header,
        {
          fontSize: size,
          lineHeight: lineHeight(size, 1.12),
          fontFamily: italic ? fontFamily.displayItalic : fontFamily.display,
        },
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  header: {
    color: colors.ink,
    letterSpacing: -0.3,
  },
});
