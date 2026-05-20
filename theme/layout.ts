/** Mockup `container-margin` */
export const containerMargin = 20 as const;

/** Mockup `gutter` / horizontal padding */
export const gutter = 16 as const;

export const headerHeight = 64 as const;

/** Dock top padding (icon row) */
export const dockPaddingTop = 10 as const;

/** Per-tab block: icon + label + indicator slot (excludes safe area). */
export const dockTabBlockHeight = 56 as const;

/**
 * Total height of the fixed bottom dock (content + safe area inset only).
 * No extra bottom padding beyond the device home indicator.
 */
export function getDockOuterHeight(insetBottom: number, floating = false): number {
  const extra = floating ? 8 : 0;
  return dockPaddingTop + dockTabBlockHeight + insetBottom + extra;
}

export const circleAvatarSize = 56 as const;

export const cardPadding = 24 as const;

/** @deprecated Use getDockOuterHeight — no separate bottom content padding */
export const dockPaddingBottom = 0 as const;
