import { LinearGradient } from 'expo-linear-gradient';
import {
  HeartHandshake,
  ImagePlus,
  MapPinned,
  MessageCircle,
  UsersRound,
} from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ambientBtn,
  ambientCard,
  colors,
  containerMargin,
  dockPaddingBottom,
  dockPaddingTop,
  dockShadowUp,
  fontFamily,
  lineHeight,
  radii,
  spacing,
  typeScale,
} from '../theme';

type DockTabId = 'protect' | 'map' | 'circles' | 'chat';

const DOCK: { id: DockTabId; label: string; icon: typeof HeartHandshake }[] = [
  { id: 'protect', label: 'Protect', icon: HeartHandshake },
  { id: 'map', label: 'Map', icon: MapPinned },
  { id: 'circles', label: 'Circles', icon: UsersRound },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
];

const tertiaryFieldBg = 'rgba(227, 225, 238, 0.3)';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [firstName, setFirstName] = useState('');
  const [city, setCity] = useState('');
  const [nameFocused, setNameFocused] = useState(false);
  const [cityFocused, setCityFocused] = useState(false);

  const dockInsetBottom = Math.max(insets.bottom, spacing.sm);
  const dockHeight =
    dockPaddingTop + 52 + dockPaddingBottom + dockInsetBottom;
  const topPad = insets.top + spacing.md;

  const onVerify = useCallback(() => {
    console.log('verify profile', { firstName, city });
  }, [firstName, city]);

  const onUploadPress = useCallback(() => {
    console.log('upload screenshot tap');
  }, []);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: topPad,
            paddingBottom: dockHeight + spacing.md,
            paddingHorizontal: containerMargin,
          },
        ]}
      >
        <View style={styles.column}>
          <Text style={styles.brand}>Juno</Text>

          <Text
            accessibilityRole="header"
            style={styles.heroTitle}
          >
            Safety Check
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={onUploadPress}
            style={({ pressed }) => [
              styles.uploadCard,
              ambientCard,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.uploadIconWrap}>
              <ImagePlus color={colors.primary} size={27} strokeWidth={2} />
            </View>
            <Text style={styles.uploadTitle}>Upload Screenshot</Text>
            <Text style={styles.uploadHint}>PNG or JPG up to 10MB</Text>
          </Pressable>

          <View style={styles.fieldBlock}>
            <Text
              accessibilityElementsHidden
              importantForAccessibility="no"
              nativeID="labelFirstName"
              style={styles.label}
            >
              First name
            </Text>
            <TextInput
              accessibilityLabelledBy="labelFirstName"
              value={firstName}
              onChangeText={setFirstName}
              placeholder="e.g. Alex"
              placeholderTextColor={colors.tertiary}
              onFocus={() => {
                setNameFocused(true);
              }}
              onBlur={() => {
                setNameFocused(false);
              }}
              style={[
                styles.input,
                nameFocused && styles.inputFocused,
              ]}
            />

            <Text nativeID="labelCity" style={[styles.label, styles.labelSpaced]}>
              City or neighborhood
            </Text>
            <View style={styles.inputWrap}>
              <View style={styles.inputIcon} pointerEvents="none">
                <MapPinned color={colors.tertiary} size={22} strokeWidth={2} />
              </View>
              <TextInput
                accessibilityLabelledBy="labelCity"
                value={city}
                onChangeText={setCity}
                placeholder="e.g. Brooklyn"
                placeholderTextColor={colors.tertiary}
                onFocus={() => {
                  setCityFocused(true);
                }}
                onBlur={() => {
                  setCityFocused(false);
                }}
                style={[
                  styles.input,
                  styles.inputWithIcon,
                  cityFocused && styles.inputFocused,
                ]}
              />
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={onVerify}
            style={({ pressed }) => [
              styles.gradientOuter,
              ambientBtn,
              pressed && styles.gradientPressed,
            ]}
          >
            <LinearGradient
              colors={[colors.primaryContainer, colors.primary]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.gradientInner}
            >
              <HeartHandshake
                color={colors.onPrimary}
                size={21}
                strokeWidth={2}
              />
              <Text style={styles.verifyLabel}>Verify Profile</Text>
            </LinearGradient>
          </Pressable>

          <Text style={styles.disclaimer}>
            Searches are completely anonymous. We never notify the person you
            are searching.
          </Text>
        </View>
      </ScrollView>

      <View
        style={[
          styles.dock,
          dockShadowUp,
          {
            paddingTop: dockPaddingTop,
            paddingBottom: dockPaddingBottom + dockInsetBottom,
          },
        ]}
      >
        {DOCK.map((tab) => {
          const active = tab.id === 'protect';
          const Icon = tab.icon;
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => {
                console.log('dock', tab.id);
              }}
              style={({ pressed }) => [
                styles.dockItem,
                active && styles.dockItemActive,
                pressed && styles.pressed,
              ]}
            >
              <Icon
                color={active ? colors.indigo600 : colors.slate400}
                size={22}
                strokeWidth={2}
              />
              <Text
                style={[styles.dockLabel, active && styles.dockLabelActive]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  column: {
    width: '100%',
    maxWidth: 448,
    alignItems: 'center',
    gap: 20,
  },
  brand: {
    fontFamily: fontFamily.extraBold,
    fontSize: typeScale.bodyLg,
    lineHeight: lineHeight(typeScale.bodyLg, 1.2),
    color: colors.indigo500,
    letterSpacing: -0.35,
    marginBottom: spacing.xs,
  },
  heroTitle: {
    fontFamily: fontFamily.bold,
    fontSize: typeScale.headlineMd,
    lineHeight: lineHeight(typeScale.headlineMd, 1.25),
    letterSpacing: -0.24,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  uploadCard: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.primaryFixed,
    borderStyle: 'dashed',
    paddingVertical: 28,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  uploadIconWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.full,
    backgroundColor: colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.bodyLg,
    lineHeight: lineHeight(typeScale.bodyLg, 1.35),
    color: colors.primary,
    textAlign: 'center',
  },
  uploadHint: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.4),
    color: colors.tertiary,
    textAlign: 'center',
  },
  fieldBlock: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    gap: 6,
  },
  label: {
    alignSelf: 'stretch',
    textAlign: 'center',
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.43),
    letterSpacing: 0.14,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.xs,
  },
  labelSpaced: {
    marginTop: spacing.sm,
  },
  inputWrap: {
    position: 'relative',
    width: '100%',
  },
  inputIcon: {
    position: 'absolute',
    left: spacing.lg,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 1,
  },
  input: {
    width: '100%',
    minHeight: 50,
    borderRadius: radii.input,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    fontFamily: fontFamily.regular,
    fontSize: typeScale.bodyMd,
    lineHeight: lineHeight(typeScale.bodyMd, 1.5),
    color: colors.onSurface,
    backgroundColor: tertiaryFieldBg,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputWithIcon: {
    paddingLeft: 56,
  },
  inputFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceContainerLowest,
  },
  gradientOuter: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    borderRadius: radii.full,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  gradientInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 15,
    minHeight: 52,
  },
  gradientPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.98 }],
  },
  verifyLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.bodyLg,
    lineHeight: lineHeight(typeScale.bodyLg, 1.35),
    color: colors.onPrimary,
  },
  disclaimer: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelSm,
    lineHeight: lineHeight(typeScale.labelSm, 1.35),
    color: colors.tertiary,
    textAlign: 'center',
    maxWidth: 300,
    alignSelf: 'center',
    opacity: 0.7,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
    borderTopLeftRadius: radii.dockTop,
    borderTopRightRadius: radii.dockTop,
  },
  dockItem: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    minWidth: 0,
    flex: 1,
    maxWidth: 100,
  },
  dockItemActive: {
    backgroundColor: colors.indigo50,
  },
  dockLabel: {
    marginTop: 4,
    fontFamily: fontFamily.medium,
    fontSize: typeScale.dockLabel,
    color: colors.slate400,
  },
  dockLabelActive: {
    color: colors.indigo600,
  },
  pressed: {
    opacity: 0.88,
  },
});
