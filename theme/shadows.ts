import { Platform, type ViewStyle } from 'react-native';

import { colors } from './colors';

/** Header */
export const headerShadow: ViewStyle = Platform.select<ViewStyle>({
  ios: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
  },
  android: { elevation: 4 },
  default: {},
}) ?? {};

/** `.ambient-shadow-card` */
export const ambientCard: ViewStyle = Platform.select<ViewStyle>({
  ios: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  android: { elevation: 3 },
  default: {},
}) ?? {};

/** Legacy alias */
export const cardShadowSoft = ambientCard;

/** Hero icon ring */
export const heroIconShadow: ViewStyle = Platform.select<ViewStyle>({
  ios: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  android: { elevation: 4 },
  default: {},
}) ?? {};

/** `.ambient-shadow-btn` */
export const ambientBtn: ViewStyle = Platform.select<ViewStyle>({
  ios: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
  },
  android: { elevation: 8 },
  default: {},
}) ?? {};

/** Primary yellow CTA (legacy) */
export const ctaYellowShadow: ViewStyle = Platform.select<ViewStyle>({
  ios: {
    shadowColor: '#fcd43e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  android: { elevation: 6 },
  default: {},
}) ?? {};

/** Bottom nav */
/** Map avatar / pin ring */
export const pinGlow: ViewStyle = Platform.select<ViewStyle>({
  ios: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
  },
  android: { elevation: 8 },
  default: {},
}) ?? {};

export const dockShadowUp: ViewStyle = Platform.select<ViewStyle>({
  ios: {
    shadowColor: colors.primaryContainer,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.14,
    shadowRadius: 30,
  },
  android: { elevation: 10 },
  default: {},
}) ?? {};
