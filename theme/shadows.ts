import { Platform, type ViewStyle } from 'react-native';

/** Header: shadow-[0_4px_20px_rgba(156,137,255,0.1)] */
export const headerShadow: ViewStyle = Platform.select<ViewStyle>({
  ios: {
    shadowColor: '#9c89ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  android: { elevation: 4 },
  default: {},
}) ?? {};

/** `.ambient-shadow-card` — rgba(156,137,255,0.08) */
export const ambientCard: ViewStyle = Platform.select<ViewStyle>({
  ios: {
    shadowColor: '#9c89ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
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
    shadowColor: '#9c89ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  android: { elevation: 4 },
  default: {},
}) ?? {};

/** `.ambient-shadow-btn` — rgba(156,137,255,0.15) */
export const ambientBtn: ViewStyle = Platform.select<ViewStyle>({
  ios: {
    shadowColor: '#9c89ff',
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

/** Bottom nav — rgba(156,137,255,0.12) */
export const dockShadowUp: ViewStyle = Platform.select<ViewStyle>({
  ios: {
    shadowColor: '#9c89ff',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 30,
  },
  android: { elevation: 10 },
  default: {},
}) ?? {};
