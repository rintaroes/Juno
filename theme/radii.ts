export const radii = {
  full: 9999,
  button: 14,
  md: 16,
  lg: 24,
  xl: 48,
  input: 32,
  dockTop: 32,
} as const;

export type Radii = typeof radii;
