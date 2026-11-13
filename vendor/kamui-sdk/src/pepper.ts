// Pepper export: a recovery file a user can keep.
//
// The pepper service's key lives only in AWS KMS and has no backup (services/pepper/DESIGN.md,
// section 13). If it were ever lost, a user without a working device could not reach their
// account again, unless they kept their pepper. This file is that copy.
//
// What the file gives away: whoever holds it learns the user's account address. It gives no
// access to the account. Recovery still needs a login token from the issuer and a proof.
import type { BigNumberish } from 'starknet';
import { accountAddressFromLogin, type LoginClaims } from './address';
import { sameFelt, toHex } from './utils';

/** Peppers are 250-bit values (services/pepper/src/derive.ts). */
const MAX_PEPPER = (1n << 250n) - 1n;

export type PepperFile = {
  kind: 'kamui-pepper';
  version: 1;
  /** Chain id felt, for example SN_MAIN as hex. */
  chainId: string;
  /** Class hash the account was deployed with. The address depends on it. */
  classHash: string;
  /** The account this pepper belongs to. */
  account: string;
  iss: string;
  aud: string;
  pepper: string;
  /** Key version the pepper service reported. */
  keyVersion: number;
  /** ISO 8601 timestamp. */
  exportedAt: string;
};

/**
 * Builds the recovery file after a login. `claims` are the login token's; the `sub` is used to
 * compute the account address and is not written to the file.
 */
export function exportPepper(args: {
  chainId: string;
  classHash: string;
  claims: LoginClaims;
  pepper: BigNumberish;
  keyVersion: number;
  now?: Date;
}): PepperFile {
  const pepper = BigInt(args.pepper);
  if (pepper <= 0n || pepper > MAX_PEPPER) throw new Error('pepper: out of range (0 is not a pepper)');
  return {
    kind: 'kamui-pepper',
    version: 1,
    chainId: toHex(args.chainId),
    classHash: toHex(args.classHash),
    account: accountAddressFromLogin(args.classHash, args.claims, pepper),
    iss: args.claims.iss,
    aud: args.claims.aud,
    pepper: toHex(pepper),
    keyVersion: args.keyVersion,
    exportedAt: (args.now ?? new Date()).toISOString(),
  };
}

export function serializePepperFile(file: PepperFile): string {
  return JSON.stringify(file, null, 2) + '\n';
}

const isHexFelt = (value: unknown): value is string => typeof value === 'string' && /^0x[0-9a-fA-F]{1,64}$/.test(value);

/** Parses and validates a recovery file. Throws with a readable reason. */
export function parsePepperFile(text: string): PepperFile {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('pepper file: not valid JSON');
  }
  if (data?.kind !== 'kamui-pepper') throw new Error('pepper file: not a Kamui pepper file');
  if (data.version !== 1) throw new Error(`pepper file: unsupported version ${data.version}`);
  for (const field of ['chainId', 'classHash', 'account', 'pepper'] as const) {
    if (!isHexFelt(data[field])) throw new Error(`pepper file: bad ${field}`);
  }
  for (const field of ['iss', 'aud', 'exportedAt'] as const) {
    if (typeof data[field] !== 'string' || data[field].length === 0) throw new Error(`pepper file: bad ${field}`);
  }
  if (!Number.isInteger(data.keyVersion) || data.keyVersion < 1) throw new Error('pepper file: bad keyVersion');
  const pepper = BigInt(data.pepper);
  if (pepper <= 0n || pepper > MAX_PEPPER) throw new Error('pepper file: pepper out of range');
  return {
    kind: 'kamui-pepper',
    version: 1,
    chainId: data.chainId,
    classHash: data.classHash,
    account: data.account,
    iss: data.iss,
    aud: data.aud,
    pepper: data.pepper,
    keyVersion: data.keyVersion,
    exportedAt: data.exportedAt,
  };
}

/**
 * Whether the file is this user's, on this chain. Check before using its pepper for a login:
 * the token's claims and the file's pepper must give the file's account address. A file for
 * another user, another `aud`, another class or another chain fails.
 */
export function pepperFileMatchesLogin(file: PepperFile, claims: LoginClaims, chainId: string): boolean {
  return (
    sameFelt(file.chainId, chainId) &&
    file.iss === claims.iss &&
    file.aud === claims.aud &&
    sameFelt(accountAddressFromLogin(file.classHash, claims, file.pepper), file.account)
  );
}
