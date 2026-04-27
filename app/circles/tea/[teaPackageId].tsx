import { ArrowLeft } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTeaPackageDetail, type TeaPackageDetail } from '../../../lib/circleChat';
import { colors, containerMargin, fontFamily, lineHeight, radii, spacing, typeScale } from '../../../theme';

export default function TeaPackageDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ teaPackageId: string }>();
  const teaPackageId = Array.isArray(params.teaPackageId) ? params.teaPackageId[0] : params.teaPackageId;
  const [item, setItem] = useState<TeaPackageDetail | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!teaPackageId) return;
    void getTeaPackageDetail(teaPackageId)
      .then(setItem)
      .catch((error) => {
        setErrorMsg(error instanceof Error ? error.message : 'Failed to load tea package.');
      });
  }, [teaPackageId]);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <ArrowLeft color={colors.onSurface} size={20} strokeWidth={2} />
        </Pressable>
        <Text style={styles.topTitle}>Tea Package</Text>
        <View style={styles.spacer} />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingHorizontal: containerMargin, paddingBottom: spacing.xl },
        ]}
      >
        {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
        {!item ? <Text style={styles.hint}>Loading tea package...</Text> : null}
        {item ? (
          <View style={styles.card}>
            <Text style={styles.heading}>{item.roster_people?.display_name ?? 'Unknown person'}</Text>
            <Text style={styles.meta}>
              Sent {new Date(item.created_at).toLocaleString()}
            </Text>
            {item.note ? (
              <>
                <Text style={styles.label}>Personal Note</Text>
                <Text style={styles.body}>{item.note}</Text>
              </>
            ) : null}
            {item.ai_digest ? (
              <>
                <Text style={styles.label}>AI Digest</Text>
                <Text style={styles.body}>{item.ai_digest}</Text>
              </>
            ) : null}
            <Text style={styles.label}>Included Data</Text>
            <Text style={styles.body}>
              Registry: {item.include_registry ? 'Yes' : 'No'} | Profile Summary:{' '}
              {item.include_profile_summary ? 'Yes' : 'No'} | Chat Summary:{' '}
              {item.include_chat_summary ? 'Yes' : 'No'}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  topBar: {
    paddingBottom: spacing.sm,
    paddingHorizontal: containerMargin,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
  },
  topTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: typeScale.titleLg,
    color: colors.onSurface,
  },
  spacer: { width: 36, height: 36 },
  scroll: { paddingTop: spacing.md },
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.surfaceContainerHighest,
    backgroundColor: colors.surfaceContainerLowest,
    padding: spacing.md,
    gap: spacing.sm,
  },
  heading: { fontFamily: fontFamily.bold, fontSize: typeScale.headlineMd, color: colors.onSurface },
  meta: { fontFamily: fontFamily.regular, fontSize: typeScale.labelSm, color: colors.onSurfaceVariant },
  label: { fontFamily: fontFamily.semiBold, fontSize: typeScale.labelMd, color: colors.onSurface },
  body: { fontFamily: fontFamily.regular, fontSize: typeScale.bodyMd, lineHeight: lineHeight(typeScale.bodyMd, 1.45), color: colors.onSurface },
  hint: { fontFamily: fontFamily.regular, fontSize: typeScale.labelMd, color: colors.onSurfaceVariant },
  error: { fontFamily: fontFamily.medium, fontSize: typeScale.labelMd, color: colors.error },
  pressed: { opacity: 0.86 },
});
