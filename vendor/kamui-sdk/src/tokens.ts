// What a token is called and how its amounts read, for approval screens.
//
// A token's name comes from the token contract itself, so any contract can claim any name. That
// is why there are three outcomes and the screen must treat them differently:
//
//   known        the address is one this SDK lists; its symbol and decimals are built in
//   unverified   the contract answered `symbol()` and `decimals()`, but anyone could deploy a
//                contract that answers the same; show what it claims, and say it is a claim
//   unknown      the contract did not answer like a token; only raw amounts can be shown
import type { ProviderInterface } from 'starknet';
import { sameFelt } from './utils';

export type TokenInfo =
  | { status: 'known'; address: string; symbol: string; decimals: number }
  | { status: 'unverified'; address: string; symbol: string; decimals: number }
  | { status: 'unknown'; address: string };

/**
 * Tokens recognised by address. STRK and ETH have the same address on Starknet mainnet and
 * Sepolia. Anything else is at best "unverified".
 */
export const KNOWN_TOKENS: readonly { address: string; symbol: string; decimals: number }[] = [
  { address: '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d', symbol: 'STRK', decimals: 18 },
  { address: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7', symbol: 'ETH', decimals: 18 },
];

/** Largest values an "unlimited" allowance is usually written as. */
const MAX_U256 = (1n << 256n) - 1n;
const MAX_U128 = (1n << 128n) - 1n;

/** Whether an amount is one of the conventional "no limit" values. */
export function isUnlimitedAmount(amount: bigint): boolean {
  return amount === MAX_U256 || amount === MAX_U128;
}

/**
 * An amount in a token's smallest unit, written in whole units. Exact: no floating point, no
 * rounding. `formatTokenAmount(1500000000000000000n, 18)` is "1.5".
 */
export function formatTokenAmount(amount: bigint, decimals: number): string {
  if (amount < 0n) throw new Error('token amount: negative');
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 77) throw new Error('token amount: bad decimals');
  const digits = amount.toString().padStart(decimals + 1, '0');
  const whole = digits.slice(0, digits.length - decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = digits.slice(digits.length - decimals).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

/** A symbol fit to show: 1 to 12 letters, digits, dots, dashes or underscores. Anything else is dropped. */
function cleanSymbol(text: string): string | null {
  return /^[A-Za-z0-9._-]{1,12}$/.test(text) ? text : null;
}

/**
 * The bytes of a felt as text, most significant byte first. Done here and not with
 * starknet.js's `decodeShortString`, which returns "0" for the felt 0.
 */
function feltToText(felt: string): string {
  let value = BigInt(felt);
  let text = '';
  while (value > 0n) {
    text = String.fromCharCode(Number(value & 0xffn)) + text;
    value >>= 8n;
  }
  return text;
}

/** `symbol()` answers either one short-string felt or a Cairo byte array. */
function decodeSymbol(result: string[]): string | null {
  try {
    if (result.length === 1) return cleanSymbol(feltToText(result[0]!));
    // ByteArray: [number of 31-byte words, ...words, pending word, pending length]
    const words = Number(BigInt(result[0]!));
    if (words > 1 || result.length !== words + 3) return null;
    const pendingLength = Number(BigInt(result[words + 2]!));
    let text = '';
    for (let i = 1; i <= words; i++) text += feltToText(result[i]!);
    if (pendingLength > 0) text += feltToText(result[words + 1]!);
    return cleanSymbol(text);
  } catch {
    return null;
  }
}

/** Looks a token up: by address first, then by asking the contract. Never throws. */
export async function readTokenInfo(provider: ProviderInterface, address: string): Promise<TokenInfo> {
  const known = KNOWN_TOKENS.find((token) => sameFelt(token.address, address));
  if (known) return { status: 'known', address, symbol: known.symbol, decimals: known.decimals };
  try {
    const [symbolResult, decimalsResult] = await Promise.all([
      provider.callContract({ contractAddress: address, entrypoint: 'symbol', calldata: [] }),
      provider.callContract({ contractAddress: address, entrypoint: 'decimals', calldata: [] }),
    ]);
    const symbol = decodeSymbol(symbolResult);
    const decimals = decimalsResult.length === 1 ? Number(BigInt(decimalsResult[0]!)) : NaN;
    if (!symbol || !Number.isInteger(decimals) || decimals < 0 || decimals > 36) return { status: 'unknown', address };
    return { status: 'unverified', address, symbol, decimals };
  } catch {
    return { status: 'unknown', address };
  }
}

/**
 * An amount as an approval screen should say it. For a known token "1.5 STRK"; for an
 * unverified one the same with the claimed symbol; for an unknown one the raw number of units.
 */
export function describeAmount(amount: bigint, token: TokenInfo): string {
  if (isUnlimitedAmount(amount)) return token.status === 'unknown' ? 'an unlimited amount' : `an unlimited amount of ${token.symbol}`;
  if (token.status === 'unknown') return `${amount.toString()} units`;
  return `${formatTokenAmount(amount, token.decimals)} ${token.symbol}`;
}
