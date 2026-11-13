/** Shared input parsing for the playgrounds. Throws a readable Error; never returns a bad value. */

/** A non-negative integer, from decimal or 0x-hex text. */
export function parseNonNegativeInt(text: string, field: string): bigint {
  const trimmed = text.trim();
  if (trimmed === '') throw new Error(`${field}: empty`);
  let value: bigint;
  try {
    value = BigInt(trimmed);
  } catch {
    throw new Error(`${field}: '${text}' is not an integer`);
  }
  if (value < 0n) throw new Error(`${field}: negative`);
  return value;
}

/** A positive JavaScript integer (for window lengths, maxCalls, and similar). */
export function parsePositiveNumber(value: string | number, field: string): number {
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${field}: must be a positive integer`);
  return n;
}

/**
 * The sponsor gateway the app should POST to: an explicit URL if given, otherwise
 * `{apiUrl}/sponsor`. Either argument may be empty.
 */
export function resolveSponsorUrl(explicit: string, apiUrl: string): string {
  const given = explicit.trim().replace(/\/$/, '');
  if (given) return given;
  const api = apiUrl.trim().replace(/\/$/, '');
  return api ? `${api}/sponsor` : '';
}
