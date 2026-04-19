export const radii = {
  full: 9999,
  md: 16,
  lg: 24,
  /** Card `rounded-xl` in mock (3rem) */
  xl: 48,
  /** Inputs `rounded-[32px]` */
  input: 32,
  /** Bottom nav top corners */
  dockTop: 32,
} as const;

export type Radii = typeof radii;
