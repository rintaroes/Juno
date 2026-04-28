import { StyleSheet, View } from 'react-native';
import { AnimatedCharacter } from '../AnimatedCharacter';

export function OnboardingCharacter({
  variant = 'default',
  size = 220,
}: {
  variant?: string;
  size?: number;
}) {
  return (
    <View style={styles.wrap}>
      <AnimatedCharacter variant={variant} size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
