import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, lineHeight, radii, typeScale } from '../theme';

export function AppErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonLabel}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
    backgroundColor: colors.surface,
  },
  title: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.titleLg,
    lineHeight: lineHeight(typeScale.titleLg, 1.3),
    color: colors.onSurface,
  },
  message: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.4),
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  buttonLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelMd,
    color: colors.onPrimary,
  },
  pressed: {
    opacity: 0.85,
  },
});
