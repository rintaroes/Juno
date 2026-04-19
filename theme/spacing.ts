export const baseSpacingUnit = 4 as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export type Spacing = typeof spacing;

export type SpacingToken = keyof Spacing;
