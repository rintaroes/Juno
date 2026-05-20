import { colors } from './colors';

/** Top-of-screen 4-stop wash (0 / 28 / 55 / 100%). */
export const screenTopGradient = {
  colors: [
    colors.screenGradient0,
    colors.screenGradient28,
    colors.screenGradient55,
    colors.screenGradient100,
  ] as const,
  locations: [0, 0.28, 0.55, 1] as const,
};

export const buttonGradients = {
  primary: [colors.ctaGradientStart, colors.ctaGradientEnd] as const,
  sage: [colors.sageGradientStart, colors.sageGradientEnd] as const,
  alert: [colors.alertGradientStart, colors.alertGradientEnd] as const,
};
