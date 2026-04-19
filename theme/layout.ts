/** Mockup `container-margin` */
export const containerMargin = 20 as const;

/** Mockup `gutter` / horizontal padding */
export const gutter = 16 as const;

export const headerHeight = 64 as const;

/** Bottom dock vertical padding (pt-3 pb-6 style) */
export const dockPaddingTop = 12 as const;

/** Mock `pb-8` on dock */
export const dockPaddingBottom = 32 as const;

/** Total height of the fixed bottom dock (content + safe inset). */
export function getDockOuterHeight(insetBottom: number): number {
  const b = Math.max(insetBottom, 8);
  return dockPaddingTop + 56 + dockPaddingBottom + b;
}

export const circleAvatarSize = 56 as const;

export const cardPadding = 24 as const;
