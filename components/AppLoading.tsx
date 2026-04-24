import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, lineHeight, typeScale } from '../theme';

export function AppLoading({ label = 'Loading Juno...' }: { label?: string }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.surface,
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.4),
    color: colors.onSurfaceVariant,
  },
});
