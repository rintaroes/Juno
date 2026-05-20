/**
 * Juno launch palette — warm linen paper, claret CTAs, sage safety.
 */
export const colors = {
  paper: '#F8F4EF',
  surfaceSecondary: '#F0E8E1',
  card: '#FFFFFF',

  ink: '#1A1118',
  inkBody: '#3A2A33',
  meta: '#7A6770',

  cta: '#A8355A',
  ctaGradientStart: '#B43D63',
  ctaGradientEnd: '#962E4F',
  ctaShadow: 'rgba(123, 37, 64, 0.32)',

  sage: '#4A8C6F',
  sageGradientStart: '#5B9B7E',
  sageGradientEnd: '#3F7A60',

  alert: '#B05448',
  alertGradientStart: '#B05448',
  alertGradientEnd: '#8C3D33',

  disabledFill: '#7A6770',
  disabledOnFill: '#FBF6EF',

  ghostFill: 'rgba(26, 17, 24, 0.04)',
  ghostBorder: 'rgba(26, 17, 24, 0.10)',
  outlineBorder: 'rgba(26, 17, 24, 0.18)',

  white: '#FFFFFF',

  /** Screen-top wash stops */
  screenGradient0: '#ECCFD3',
  screenGradient28: '#F2DAD9',
  screenGradient55: '#F6E6E1',
  screenGradient100: '#F8F4EF',

  /** Subtle pink surfaces (circle sheet, soft panels) — between paper and screenGradient55 */
  blush: '#FAF6F5',

  // —— Legacy aliases (map old token names → new palette) ——
  cream: '#F8F4EF',
  surface: '#F8F4EF',
  surfaceBright: '#F8F4EF',
  surfaceContainerLow: '#F0E8E1',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainer: '#F0E8E1',
  surfaceContainerHigh: '#F0E8E1',
  surfaceContainerHighest: '#F0E8E1',
  surfaceVariant: '#F0E8E1',
  surfaceDim: '#F0E8E1',
  charcoal: '#1A1118',
  stone: '#7A6770',
  onSurface: '#1A1118',
  onSurfaceVariant: '#7A6770',
  onBackground: '#1A1118',
  tertiary: '#7A6770',
  primary: '#A8355A',
  primaryContainer: '#B43D63',
  onPrimary: '#FFFFFF',
  onPrimaryContainer: '#962E4F',
  tertiaryFixed: '#F0E8E1',
  tertiaryFixedDim: '#F0E8E1',
  primaryFixed: '#ECCFD3',
  primaryFixedDim: '#F2DAD9',
  secondary: '#4A8C6F',
  secondaryContainer: '#5B9B7E',
  onSecondaryContainer: '#3F7A60',
  outline: 'rgba(26, 17, 24, 0.18)',
  outlineVariant: 'rgba(26, 17, 24, 0.10)',
  indigo500: '#4A8C6F',
  indigo600: '#3F7A60',
  indigo50: '#F0E8E1',
  indigo100: '#ECCFD3',
  slate400: '#7A6770',
  slate500: '#7A6770',
  coral: '#B43D63',
  sienna: '#962E4F',
  error: '#B05448',
  errorContainer: '#F6E6E1',
  onErrorContainer: '#8C3D33',
  riskLowBg: '#E8F3ED',
  riskLowInk: '#3F7A60',
  riskAttentionBg: '#F6E6E1',
  riskAttentionInk: '#B05448',
} as const;

export type Colors = typeof colors;

export type ColorToken = keyof Colors;
