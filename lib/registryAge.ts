/**
 * Age from a DOB string using the environment's local calendar (device on RN; server TZ in Edge).
 * Parses `YYYY-MM-DD` as that civil date — avoids `new Date('YYYY-MM-DD')` UTC-midnight skew.
 */
export function ageFromIsoDobLocal(iso?: string | null): number | null {
  if (iso == null) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const birthMonth = Number(m[2]);
  const birthDay = Number(m[3]);
  if (![y, birthMonth, birthDay].every((n) => Number.isFinite(n))) return null;
  if (birthMonth < 1 || birthMonth > 12 || birthDay < 1 || birthDay > 31) return null;
  const birth = new Date(y, birthMonth - 1, birthDay);
  if (
    birth.getFullYear() !== y ||
    birth.getMonth() !== birthMonth - 1 ||
    birth.getDate() !== birthDay
  ) {
    return null;
  }
  const today = new Date();
  const ty = today.getFullYear();
  const tm = today.getMonth() + 1;
  const td = today.getDate();
  let age = ty - y;
  if (tm < birthMonth || (tm === birthMonth && td < birthDay)) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}
