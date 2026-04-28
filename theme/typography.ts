/**
 * Plus Jakarta Sans — matches mockup `font-plus-jakarta-sans`.
 * Load via `useFonts` in `app/_layout.tsx`.
 */
export const fontFamily = {
  fraunces: 'Fraunces_400Regular',
  inter: 'Inter_400Regular',
  interMedium: 'Inter_500Medium',
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extraBold: 'PlusJakartaSans_800ExtraBold',
} as const;

/** Mockup fontSize tokens (px). */
export const typeScale = {
  displayLg: 40,
  headlineLg: 32,
  headlineMd: 24,
  titleLg: 20,
  bodyLg: 18,
  bodyMd: 16,
  labelMd: 14,
  labelSm: 12,
  /** Header wordmark */
  wordmark: 24,
  /** Bottom dock */
  dockLabel: 11,
} as const;

export type TypeScale = typeof typeScale;

export function lineHeight(size: number, mult: number): number {
  return Math.round(size * mult);
}
