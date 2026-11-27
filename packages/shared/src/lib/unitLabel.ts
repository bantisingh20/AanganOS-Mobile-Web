/**
 * THE way to show a unit in any dropdown / label: "{communityCode}-{unitNumber}", e.g. A-101.
 *
 * Unit numbers are normally SAVED with the wing prefix already (bulk add and society registration
 * store "A-101", "A101" or "A/101"), so this only adds the code when the saved number lacks it:
 * - No code on the community → the number as saved.
 * - Number already starts with the code ("A-101", "A/101", "A 101", or "A101" when the code ends in
 *   a letter) → the number as saved, never "A-A-101".
 * - Plain number ("101", e.g. typed by hand) → "A-101".
 */
export function unitLabel(unit: { unitNumber: string; communityCode?: string | null } | null | undefined): string {
  if (!unit) return '';
  const number = unit.unitNumber?.trim() ?? '';
  const code = unit.communityCode?.trim();
  if (!code) return number;
  const lower = number.toLowerCase();
  const c = code.toLowerCase();
  if (lower === c) return number;
  if (lower.startsWith(c)) {
    const next = lower.charAt(c.length);
    if (next === '-' || next === '/' || next === ' ') return number;
    // "A101": code ends in a letter and the number continues with a digit.
    if (/[a-z]$/.test(c) && /[0-9]/.test(next)) return number;
  }
  return `${code}-${number}`;
}
