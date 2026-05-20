import { LinearGradient } from 'expo-linear-gradient';
import { type LucideIcon } from 'lucide-react-native';
import { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  buttonGradients,
  buttonMetrics,
  colors,
  fontFamily,
  primaryBtnShadow,
  radii,
} from '../../theme';

export type ButtonVariant = 'primary' | 'sage' | 'alert' | 'ghost' | 'outline';

type Props = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: LucideIcon;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

const GRADIENT_VARIANTS: ButtonVariant[] = ['primary', 'sage', 'alert'];

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon: Icon,
  style,
  accessibilityLabel,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const isGradient = GRADIENT_VARIANTS.includes(variant);
  const isInactive = disabled || loading;

  const animatePressIn = () => {
    if (isInactive) return;
    Animated.timing(scale, {
      toValue: buttonMetrics.pressScale,
      duration: buttonMetrics.pressDurationMs,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  const animatePressOut = () => {
    if (isInactive) return;
    Animated.timing(scale, {
      toValue: 1,
      duration: buttonMetrics.pressDurationMs,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  const gradientColors =
    variant === 'sage'
      ? buttonGradients.sage
      : variant === 'alert'
        ? buttonGradients.alert
        : buttonGradients.primary;

  const labelColor =
    isGradient && !isInactive
      ? colors.white
      : isGradient && isInactive
        ? 'rgba(251, 246, 239, 0.7)'
        : isInactive
          ? 'rgba(26, 17, 24, 0.35)'
          : colors.ink;

  const content = (
    <View style={styles.content}>
      {loading ? (
        <ActivityIndicator color={labelColor} size="small" />
      ) : (
        <>
          {Icon ? <Icon color={labelColor} size={18} strokeWidth={2} /> : null}
          <Text style={[styles.label, { color: labelColor }]} numberOfLines={1}>
            {label}
          </Text>
        </>
      )}
    </View>
  );

  const inner = isGradient ? (
    isInactive ? (
      <View style={[styles.fill, styles.disabledFill]}>{content}</View>
    ) : (
      <LinearGradient
        colors={[...gradientColors]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.fill}
      >
        {content}
      </LinearGradient>
    )
  ) : (
    <View
      style={[
        styles.fill,
        variant === 'ghost' ? styles.ghostFill : styles.outlineFill,
        isInactive && styles.flatInactive,
      ]}
    >
      {content}
    </View>
  );

  return (
    <Animated.View
      style={[
        styles.outer,
        variant === 'primary' && !isInactive && primaryBtnShadow,
        { transform: [{ scale }] },
        isInactive && styles.noShadow,
        style,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: isInactive }}
        disabled={isInactive}
        onPress={onPress}
        onPressIn={animatePressIn}
        onPressOut={animatePressOut}
        style={({ pressed }) => [
          styles.pressable,
          !isInactive && pressed && { opacity: buttonMetrics.pressOpacity },
        ]}
      >
        {inner}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: {
    height: buttonMetrics.height,
    borderRadius: radii.button,
    overflow: 'hidden',
    width: '100%',
  },
  noShadow: {
    shadowOpacity: 0,
    elevation: 0,
  },
  pressable: {
    flex: 1,
  },
  fill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: buttonMetrics.paddingHorizontal,
    borderRadius: radii.button,
  },
  disabledFill: {
    backgroundColor: colors.disabledFill,
    opacity: 0.5,
  },
  ghostFill: {
    backgroundColor: colors.ghostFill,
    borderWidth: 1,
    borderColor: colors.ghostBorder,
  },
  outlineFill: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.outlineBorder,
  },
  flatInactive: {
    borderColor: `rgba(26, 17, 24, 0.35)`,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: buttonMetrics.iconGap,
    maxWidth: '100%',
  },
  icon: {
    flexShrink: 0,
  },
  label: {
    fontFamily: fontFamily.semiBold,
    fontSize: buttonMetrics.fontSize,
    letterSpacing: buttonMetrics.letterSpacing,
    flexShrink: 1,
  },
});
