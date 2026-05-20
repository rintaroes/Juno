/**
 * Shared roster list / profile visuals (initials + deterministic avatar tint).
 */

const ROSTER_AVATAR_PALETTE = [
  '#BFA895',
  '#C28E82',
  '#A3B1C6',
  '#9B8BA8',
  '#8B9F88',
  '#C4A574',
  '#C17F59',
  '#6B7B8C',
  '#9B7B9C',
  '#5C8F7A',
] as const;

export function rosterAvatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return ROSTER_AVATAR_PALETTE[Math.abs(h) % ROSTER_AVATAR_PALETTE.length];
}

export function rosterInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }
  const t = displayName.trim();
  if (t.length >= 2) return t.slice(0, 2).toUpperCase();
  return t ? `${t.charAt(0)}?`.toUpperCase() : '??';
}
