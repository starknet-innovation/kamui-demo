import { ec, num, uint256, type BigNumberish } from 'starknet';

export const toHex = (value: BigNumberish): string => num.toHex(value);

/** Whether two felts are equal, whatever their formatting. */
export const sameFelt = (a: BigNumberish, b: BigNumberish): boolean => BigInt(a) === BigInt(b);

/** A u256 as the two felts Cairo expects: low, then high. */
export function u256Calldata(value: BigNumberish): [string, string] {
  const { low, high } = uint256.bnToUint256(value);
  return [toHex(low), toHex(high)];
}

/** 31 random bytes as a felt: always below the field prime, and a valid Stark private key. */
export function randomFelt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(31));
  return '0x' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export type KeyPair = { privateKey: string; publicKey: string };

export function keyPairFromPrivateKey(privateKey: string): KeyPair {
  return { privateKey, publicKey: ec.starkCurve.getStarkKey(privateKey) };
}

export function newKeyPair(): KeyPair {
  return keyPairFromPrivateKey(randomFelt());
}

/** A Stark-curve signature as `[r, s]`. */
export function signHash(hash: string, privateKey: string): [string, string] {
  const { r, s } = ec.starkCurve.sign(hash, privateKey);
  return [toHex(r), toHex(s)];
}
