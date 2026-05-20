/**
 * Newsreader — display headings & accent words.
 * Manrope — body, buttons, inputs, labels.
 * JetBrains Mono — micro labels (timestamps, status chips).
 */
export const fontFamily = {
  display: 'Newsreader_400Regular',
  displayMedium: 'Newsreader_500Medium',
  displaySemiBold: 'Newsreader_600SemiBold',
  displayBold: 'Newsreader_700Bold',
  displayItalic: 'Newsreader_400Regular_Italic',
  displayMediumItalic: 'Newsreader_500Medium_Italic',
  displaySemiBoldItalic: 'Newsreader_600SemiBold_Italic',

  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semiBold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extraBold: 'Manrope_800ExtraBold',

  mono: 'JetBrainsMono_500Medium',
  monoRegular: 'JetBrainsMono_400Regular',
  monoSemiBold: 'JetBrainsMono_600SemiBold',

  /** @deprecated Use `regular` / Manrope */
  inter: 'Manrope_400Regular',
  /** @deprecated Use `medium` */
  interMedium: 'Manrope_500Medium',
  /** @deprecated Use `display` */
  fraunces: 'Newsreader_400Regular',
} as const;

export const typeScale = {
  displayLg: 40,
  headlineLg: 32,
  headlineMd: 24,
  titleLg: 20,
  bodyLg: 18,
  bodyMd: 16,
  labelMd: 14,
  labelSm: 12,
  wordmark: 24,
  dockLabel: 11,
  button: 15,
  micro: 11,
} as const;

export type TypeScale = typeof typeScale;

export function lineHeight(size: number, mult: number): number {
  return Math.round(size * mult);
}

/** Micro labels: timestamps, ACTIVE DATE, etc. */
export const microLabelStyle = {
  fontFamily: fontFamily.mono,
  fontSize: typeScale.micro,
  letterSpacing: 0.8,
  textTransform: 'uppercase' as const,
};
