import { Platform, type ViewStyle } from 'react-native';

import { colors } from './colors';

/** Primary CTA — rgba(123,37,64,0.32) 16px blur, 6px y-offset */
export const primaryBtnShadow: ViewStyle = Platform.select<ViewStyle>({
  ios: {
    shadowColor: colors.ctaShadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
  },
  android: { elevation: 6 },
  default: {},
}) ?? {};

/** @deprecated Use primaryBtnShadow */
export const ambientBtn = primaryBtnShadow;

export const ambientCard: ViewStyle = Platform.select<ViewStyle>({
  ios: {
    shadowColor: 'rgba(26, 17, 24, 0.12)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
  },
  android: { elevation: 3 },
  default: {},
}) ?? {};

export const cardShadowSoft = ambientCard;

export const headerShadow: ViewStyle = ambientCard;

export const heroIconShadow: ViewStyle = ambientCard;

export const ctaYellowShadow: ViewStyle = ambientCard;

export const pinGlow: ViewStyle = Platform.select<ViewStyle>({
  ios: {
    shadowColor: colors.ctaGradientStart,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
  },
  android: { elevation: 6 },
  default: {},
}) ?? {};

export const dockShadowUp: ViewStyle = Platform.select<ViewStyle>({
  ios: {
    shadowColor: 'rgba(26, 17, 24, 0.08)',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 12,
  },
  android: { elevation: 8 },
  default: {},
}) ?? {};
