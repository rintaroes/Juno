import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { screenTopGradient } from '../../theme';

type Props = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Soft 4-stop wash at the top of screens (#ECCFD3 → paper).
 * Place as the first child inside a full-screen container.
 */
export function ScreenGradient({ children, style }: Props) {
  return (
    <View style={[styles.root, style]} pointerEvents="none">
      <LinearGradient
        colors={[...screenTopGradient.colors]}
        locations={[...screenTopGradient.locations]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
});
