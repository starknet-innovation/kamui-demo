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

/** A non-negative felt (token address, account, …) as decimal or 0x-hex text. Returns the trimmed input. */
export function parseFelt(text: string, field: string): string {
  const trimmed = text.trim();
  parseNonNegativeInt(trimmed, field);
  return trimmed;
}

/** Stark field prime. Calldata and keychain addresses must be strictly less than this. */
export const FELT_PRIME = 0x800000000000011000000000000000000000000000000000000000000000001n;

/**
 * A felt normalised to `0x` + lowercase hex, as `parseExecuteRequest` requires.
 * Accepts decimal or hex input (`123` and `0x7b` both become `0x7b`).
 */
export function parseHexFelt(text: string, field: string): string {
  const value = parseNonNegativeInt(text, field);
  if (value >= FELT_PRIME) throw new Error(`${field}: out of felt range`);
  return '0x' + value.toString(16);
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
