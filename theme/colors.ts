/**
 * Aura Safety / M3 tokens (Tailwind mock).
 */
export const colors = {
  primary: '#5f4bbe',
  tertiary: '#5d5d68',
  tertiaryFixed: '#e3e1ee',
  tertiaryFixedDim: '#c6c5d2',
  surfaceBright: '#fbf8ff',
  surface: '#fbf8ff',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f5f2f9',
  surfaceContainer: '#efedf3',
  surfaceContainerHigh: '#eae7ee',
  surfaceContainerHighest: '#e4e1e8',
  surfaceVariant: '#e4e1e8',
  surfaceDim: '#dbd9df',
  onSurface: '#1b1b20',
  onSurfaceVariant: '#484553',
  onBackground: '#1b1b20',
  outline: '#797584',
  outlineVariant: '#c9c4d5',
  primaryFixed: '#e6deff',
  primaryFixedDim: '#c9beff',
  primaryContainer: '#9c89ff',
  onPrimary: '#ffffff',
  secondaryContainer: '#fcd43e',
  onSecondaryContainer: '#715b00',
  /** Header / accents (Tailwind indigo) */
  indigo500: '#6366f1',
  indigo600: '#4f46e5',
  indigo50: '#eef2ff',
  indigo100: '#e0e7ff',
  slate400: '#94a3b8',
  slate500: '#64748b',
  white: '#ffffff',
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',
  riskLowBg: '#dcf3de',
  riskLowInk: '#1f6f3a',
  riskAttentionBg: '#ffe4d4',
  riskAttentionInk: '#c23d0a',
} as const;

export type Colors = typeof colors;

export type ColorToken = keyof Colors;
