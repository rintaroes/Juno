import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Fingerprint,
  Globe,
  Plus,
  Scale,
  ShieldCheck,
} from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ambientCard,
  colors,
  containerMargin,
  fontFamily,
  lineHeight,
  radii,
  spacing,
  typeScale,
} from '../theme';

type SocialLink = { id: string; label: string; handle: string; url: string };

type CircleMember = { id: string; name: string };

const MOCK_CIRCLE: CircleMember[] = [
  { id: '1', name: 'Mom' },
  { id: '2', name: 'Sarah' },
  { id: '3', name: 'Marcus Chen' },
  { id: '4', name: 'Elena Rodriguez' },
];

const MOCK_SOCIALS: SocialLink[] = [
  {
    id: 'ig',
    label: 'Instagram',
    handle: '@alex.mercer',
    url: 'https://instagram.com/',
  },
  {
    id: 'li',
    label: 'LinkedIn',
    handle: '/in/alexmercer',
    url: 'https://www.linkedin.com/',
  },
  {
    id: 'x',
    label: 'X',
    handle: '@alexmercer',
    url: 'https://x.com/',
  },
];

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    const w = parts[0];
    return w.slice(0, Math.min(2, w.length)).toUpperCase();
  }
  const a = parts[0][0] ?? '';
  const b = parts[parts.length - 1][0] ?? '';
  return `${a}${b}`.toUpperCase();
}

const AVATAR_OUTER = 64;
const AVATAR_INNER = 60;

function CircleMemberTile({
  member,
  selected,
  onToggle,
}: {
  member: CircleMember;
  selected: boolean;
  onToggle: () => void;
}) {
  const initials = initialsFromName(member.name);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onToggle}
      style={({ pressed }) => [styles.circleTileCol, pressed && styles.pressed]}
    >
      <View style={styles.circleTileAvatarWrap}>
        {selected ? (
          <LinearGradient
            colors={[colors.primary, colors.primaryContainer]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.circleGradientRing}
          >
            <View style={styles.circleInnerRing}>
              <View style={[styles.circleFaceFill, styles.circleFaceFallback]}>
                <Text style={styles.circleInitials}>{initials}</Text>
              </View>
            </View>
          </LinearGradient>
        ) : (
          <View style={styles.circleUnselectedOuter}>
            <View style={[styles.circleFaceFill, styles.circleFaceFallback]}>
              <Text style={styles.circleInitialsMuted}>{initials}</Text>
            </View>
          </View>
        )}
        {selected ? (
          <View style={styles.circleCheckBadge}>
            <CheckCircle2
              color={colors.primary}
              size={16}
              strokeWidth={2}
              fill={colors.primary}
            />
          </View>
        ) : null}
      </View>
      <Text style={styles.circleTileLabel} numberOfLines={1}>
        {member.name}
      </Text>
    </Pressable>
  );
}

export default function ReportScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ firstName?: string; city?: string }>();
  const [socialExpanded, setSocialExpanded] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(
    () => new Set(),
  );

  const subjectName = useMemo(() => {
    const raw = params.firstName;
    const s = Array.isArray(raw) ? raw[0] : raw;
    const n = typeof s === 'string' ? s.trim() : '';
    return n.length > 0 ? n : 'Alex Mercer';
  }, [params.firstName]);

  const subjectInitials = useMemo(() => initialsFromName(subjectName), [subjectName]);

  const cityLine = useMemo(() => {
    const raw = params.city;
    const s = Array.isArray(raw) ? raw[0] : raw;
    const c = typeof s === 'string' ? s.trim() : '';
    return c.length > 0 ? ` · ${c}` : '';
  }, [params.city]);

  const onBack = useCallback(() => {
    router.back();
  }, [router]);

  const openShareModal = useCallback(() => {
    setSelectedMemberIds(new Set());
    setShareModalOpen(true);
  }, []);

  const closeShareModal = useCallback(() => {
    setShareModalOpen(false);
  }, []);

  const toggleMember = useCallback((id: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const confirmShareWithCircle = useCallback(async () => {
    const names = MOCK_CIRCLE.filter((m) => selectedMemberIds.has(m.id)).map(
      (m) => m.name,
    );
    setShareModalOpen(false);
    try {
      await Share.share({
        title: 'Background check',
        message: `Background check for ${subjectName} (Juno) — shared with: ${names.join(', ')}`,
      });
    } catch {
      /* user dismissed */
    }
  }, [selectedMemberIds, subjectName]);

  const openSocial = useCallback((url: string) => {
    Linking.openURL(url).catch(() => {
      console.log('open url failed', url);
    });
  }, []);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + spacing.md,
            paddingBottom: insets.bottom + spacing.xl,
            paddingHorizontal: containerMargin,
          },
        ]}
      >
        <Text style={styles.brand}>Juno</Text>

        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [styles.backRow, pressed && styles.pressed]}
        >
          <ArrowLeft color={colors.primary} size={20} strokeWidth={2} />
          <Text style={styles.backLabel}>Back to Protect</Text>
        </Pressable>

        <Text style={styles.headline}>Background Check</Text>
        <Text style={styles.subhead}>
          Report for{' '}
          <Text style={styles.subheadStrong}>{subjectName}</Text>
          {cityLine ? (
            <Text style={styles.subheadMuted}>{cityLine}</Text>
          ) : null}
        </Text>

        <View style={[styles.summaryCard, ambientCard]}>
          <View style={styles.subjectAvatar}>
            <Text style={styles.subjectInitials}>{subjectInitials}</Text>
          </View>
          <View style={styles.summaryBody}>
            <View style={styles.summaryTitleRow}>
              <Text style={styles.summaryTitle}>Overall Status</Text>
              <ShieldCheck color={colors.primary} size={24} strokeWidth={2} />
            </View>
            <Text style={styles.summaryCopy}>
              No immediate red flags detected based on public records and verified
              databases.
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Verification Details</Text>

        <View style={[styles.detailCard, styles.detailShadow]}>
          <View style={styles.detailIconWrap}>
            <Fingerprint color={colors.primary} size={24} strokeWidth={2} />
          </View>
          <View style={styles.detailMain}>
            <Text style={styles.detailTitle}>Identity verification</Text>
            <Text style={styles.detailBody}>
              Name and age match provided details.
            </Text>
          </View>
          <CheckCircle2 color={colors.primary} size={24} strokeWidth={2} />
        </View>

        <View style={[styles.detailCard, styles.detailShadow]}>
          <View style={styles.detailIconWrap}>
            <Scale color={colors.primary} size={24} strokeWidth={2} />
          </View>
          <View style={styles.detailMain}>
            <Text style={styles.detailTitle}>Sex offender registry</Text>
            <Text style={styles.detailBody}>
              No match in national or state sex offender registries for this name
              and region.
            </Text>
          </View>
          <CheckCircle2 color={colors.primary} size={24} strokeWidth={2} />
        </View>

        <View style={[styles.detailCard, styles.detailShadow]}>
          <View style={styles.detailIconWrap}>
            <Globe color={colors.primary} size={24} strokeWidth={2} />
          </View>
          <View style={styles.detailMain}>
            <Text style={styles.detailTitle}>Social media footprint</Text>
            <Text style={styles.detailBody}>
              Profiles that may match this search.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: socialExpanded }}
              onPress={() => {
                setSocialExpanded((o) => !o);
              }}
              style={({ pressed }) => [styles.socialToggle, pressed && styles.pressed]}
            >
              <Text style={styles.socialToggleText}>
                {socialExpanded
                  ? 'Hide profiles'
                  : `Show ${MOCK_SOCIALS.length} profiles found`}
              </Text>
              <View
                style={{
                  transform: [{ rotate: socialExpanded ? '180deg' : '0deg' }],
                }}
              >
                <ChevronDown color={colors.primary} size={22} strokeWidth={2} />
              </View>
            </Pressable>
            {socialExpanded ? (
              <View style={styles.socialList} accessibilityLabel="Social profiles">
                {MOCK_SOCIALS.map((s) => (
                  <Pressable
                    key={s.id}
                    accessibilityRole="link"
                    onPress={() => {
                      openSocial(s.url);
                    }}
                    style={({ pressed }) => [
                      styles.socialChip,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.socialChipLabel}>{s.label}</Text>
                    <Text style={styles.socialChipHandle}>{s.handle}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={openShareModal}
          style={({ pressed }) => [styles.shareCta, pressed && styles.pressed]}
        >
          <Text style={styles.shareCtaText}>Share report with Circle</Text>
        </Pressable>

        <Text style={styles.footerNote}>
          Remember, this report is based on public data and is just one tool for your
          safety. Always trust your instincts.
        </Text>
      </ScrollView>

      <Modal
        visible={shareModalOpen}
        animationType="slide"
        transparent
        onRequestClose={closeShareModal}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            style={styles.modalBackdropPressable}
            onPress={closeShareModal}
          >
            <BlurView
              intensity={Platform.OS === 'ios' ? 48 : 32}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.modalDimOverlay} pointerEvents="none" />
          </Pressable>
          <View
            style={[
              styles.modalSheet,
              {
                paddingBottom: Math.max(insets.bottom, 12) + spacing.md,
              },
            ]}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.notifyCard}>
              <View style={styles.notifyHeader}>
                <Text style={styles.notifyTitle}>Share with Circle</Text>
                <View style={styles.selectedPill}>
                  <Text style={styles.selectedPillText}>
                    {selectedMemberIds.size} Selected
                  </Text>
                </View>
              </View>
              <Text style={styles.notifyHint}>
                Tap someone to include them in this share.
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.notifyScrollContent}
              >
                {MOCK_CIRCLE.map((m) => (
                  <CircleMemberTile
                    key={m.id}
                    member={m}
                    selected={selectedMemberIds.has(m.id)}
                    onToggle={() => {
                      toggleMember(m.id);
                    }}
                  />
                ))}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add circle member"
                  onPress={() => {
                    console.log('add circle member');
                  }}
                  style={({ pressed }) => [styles.addCircleCol, pressed && styles.pressed]}
                >
                  <View style={styles.addCircleButton}>
                    <Plus color={colors.outline} size={28} strokeWidth={2} />
                  </View>
                  <Text style={styles.circleTileLabel}>Add</Text>
                </Pressable>
              </ScrollView>
            </View>
            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                onPress={closeShareModal}
                style={({ pressed }) => [
                  styles.modalBtnSecondary,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={selectedMemberIds.size === 0}
                onPress={confirmShareWithCircle}
                style={({ pressed }) => [
                  styles.modalBtnPrimary,
                  selectedMemberIds.size === 0 && styles.modalBtnDisabled,
                  pressed && selectedMemberIds.size > 0 && styles.pressed,
                ]}
              >
                <Text style={styles.modalBtnPrimaryText}>Share</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scroll: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    gap: spacing.lg,
  },
  brand: {
    alignSelf: 'center',
    fontFamily: fontFamily.extraBold,
    fontSize: typeScale.bodyLg,
    lineHeight: lineHeight(typeScale.bodyLg, 1.2),
    color: colors.indigo500,
    letterSpacing: -0.35,
    marginBottom: spacing.xs,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    marginBottom: spacing.xs,
  },
  backLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.43),
    letterSpacing: 0.14,
    color: colors.primary,
  },
  headline: {
    fontFamily: fontFamily.bold,
    fontSize: typeScale.headlineLg,
    lineHeight: lineHeight(typeScale.headlineLg, 1.25),
    letterSpacing: -0.32,
    color: colors.onSurface,
  },
  subhead: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.bodyMd,
    lineHeight: lineHeight(typeScale.bodyMd, 1.5),
    color: colors.onSurfaceVariant,
  },
  subheadStrong: {
    fontFamily: fontFamily.semiBold,
    color: colors.onSurface,
  },
  subheadMuted: {
    fontFamily: fontFamily.regular,
    color: colors.onSurfaceVariant,
  },
  summaryCard: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.surfaceContainerHighest,
  },
  subjectAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryFixed,
    borderWidth: 1,
    borderColor: 'rgba(201, 196, 213, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectInitials: {
    fontFamily: fontFamily.bold,
    fontSize: 28,
    color: colors.primary,
  },
  summaryBody: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  summaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.titleLg,
    lineHeight: lineHeight(typeScale.titleLg, 1.35),
    color: colors.onSurface,
  },
  summaryCopy: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.bodyMd,
    lineHeight: lineHeight(typeScale.bodyMd, 1.5),
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  sectionTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.titleLg,
    lineHeight: lineHeight(typeScale.titleLg, 1.35),
    color: colors.onSurface,
    marginTop: spacing.sm,
  },
  detailCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.surfaceContainer,
  },
  detailShadow: {
    ...Platform.select({
      ios: {
        shadowColor: '#9c89ff',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  detailIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailMain: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  detailTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.bodyMd,
    lineHeight: lineHeight(typeScale.bodyMd, 1.35),
    color: colors.onSurface,
  },
  detailBody: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.45),
    color: colors.onSurfaceVariant,
  },
  socialToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    gap: spacing.sm,
  },
  socialToggleText: {
    flex: 1,
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.43),
    color: colors.primary,
  },
  socialList: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  socialChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  socialChipLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelSm,
    lineHeight: lineHeight(typeScale.labelSm, 1.33),
    color: colors.primary,
  },
  socialChipHandle: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelSm,
    lineHeight: lineHeight(typeScale.labelSm, 1.33),
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  shareCta: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: 20,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.32,
        shadowRadius: 18,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  shareCtaText: {
    textAlign: 'center',
    fontFamily: fontFamily.bold,
    fontSize: typeScale.bodyLg,
    lineHeight: lineHeight(typeScale.bodyLg, 1.35),
    letterSpacing: 0.02,
    color: colors.onPrimary,
  },
  footerNote: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelMd,
    lineHeight: lineHeight(typeScale.labelMd, 1.45),
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 400,
    alignSelf: 'center',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdropPressable: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  modalDimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18, 14, 24, 0.58)',
  },
  modalSheet: {
    zIndex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: containerMargin,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: { elevation: 16 },
      default: {},
    }),
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.outlineVariant,
    marginBottom: spacing.md,
    opacity: 0.85,
  },
  notifyCard: {
    backgroundColor: 'transparent',
    paddingBottom: spacing.sm,
  },
  notifyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  notifyTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.titleLg,
    lineHeight: lineHeight(typeScale.titleLg, 1.35),
    color: colors.onSurface,
  },
  selectedPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: colors.primaryFixed,
  },
  selectedPillText: {
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelSm,
    lineHeight: lineHeight(typeScale.labelSm, 1.33),
    color: colors.onPrimaryContainer,
  },
  notifyHint: {
    fontFamily: fontFamily.regular,
    fontSize: typeScale.labelSm,
    lineHeight: lineHeight(typeScale.labelSm, 1.35),
    color: colors.onSurfaceVariant,
    marginBottom: spacing.md,
  },
  notifyScrollContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  circleTileCol: {
    width: 72,
    alignItems: 'center',
    gap: 8,
  },
  circleTileAvatarWrap: {
    position: 'relative',
    width: AVATAR_OUTER + 8,
    height: AVATAR_OUTER + 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleGradientRing: {
    width: AVATAR_OUTER,
    height: AVATAR_OUTER,
    borderRadius: AVATAR_OUTER / 2,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleInnerRing: {
    width: AVATAR_INNER,
    height: AVATAR_INNER,
    borderRadius: AVATAR_INNER / 2,
    borderWidth: 2,
    borderColor: colors.white,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainer,
  },
  circleFaceFill: {
    width: '100%',
    height: '100%',
  },
  circleFaceFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleInitials: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    color: colors.primary,
  },
  circleUnselectedOuter: {
    width: AVATAR_OUTER,
    height: AVATAR_OUTER,
    borderRadius: AVATAR_OUTER / 2,
    borderWidth: 2,
    borderColor: colors.outlineVariant,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainerLow,
  },
  circleInitialsMuted: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    color: colors.onSurfaceVariant,
  },
  circleCheckBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 2,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  circleTileLabel: {
    width: 72,
    textAlign: 'center',
    fontFamily: fontFamily.medium,
    fontSize: typeScale.labelSm,
    lineHeight: lineHeight(typeScale.labelSm, 1.33),
    color: colors.onSurfaceVariant,
  },
  addCircleCol: {
    width: 72,
    alignItems: 'center',
    gap: 8,
  },
  addCircleButton: {
    width: AVATAR_OUTER,
    height: AVATAR_OUTER,
    borderRadius: AVATAR_OUTER / 2,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
  },
  modalBtnSecondary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surface,
  },
  modalBtnSecondaryText: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.labelMd,
    color: colors.onSurface,
  },
  modalBtnPrimary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  modalBtnDisabled: {
    opacity: 0.45,
  },
  modalBtnPrimaryText: {
    fontFamily: fontFamily.bold,
    fontSize: typeScale.labelMd,
    color: colors.onPrimary,
  },
  pressed: {
    opacity: 0.88,
  },
});
