// Owner keys: one per device, at most MAX_OWNERS. See contracts/src/owners.cairo.
import { hash, shortString, type BigNumberish, type Call } from 'starknet';
import { signHash, toHex } from './utils';

/**
 * What a key signs to become an owner: `poseidon('StarkNet Message', 'accept_ownership',
 * account, anchor)`. The anchor is the account's `get_owners_anchor()`; it changes with every
 * change of the owner set, so the signature cannot be reused later.
 */
export function newOwnerMessageHash(account: string, anchor: BigNumberish): string {
  return hash.computePoseidonHashOnElements([
    shortString.encodeShortString('StarkNet Message'),
    shortString.encodeShortString('accept_ownership'),
    account,
    toHex(anchor),
  ]);
}

/** The new key's signature accepting ownership, for `add_owner` and for `recover`. */
export function signNewOwner(account: string, anchor: BigNumberish, newOwnerPrivateKey: string): [string, string] {
  return signHash(newOwnerMessageHash(account, anchor), newOwnerPrivateKey);
}

/**
 * Adds an owner key. Must be sent by the account itself, signed by an existing owner.
 * Every session is revoked when the owners change.
 */
export function addOwnerCall(account: string, newOwnerPublicKey: string, signature: [string, string]): Call {
  return {
    contractAddress: account,
    entrypoint: 'add_owner',
    calldata: [newOwnerPublicKey, '0x2', ...signature],
  };
}

/** Removes an owner key (never the last one). Every session is revoked. */
export function removeOwnerCall(account: string, ownerPublicKey: string): Call {
  return { contractAddress: account, entrypoint: 'remove_owner', calldata: [ownerPublicKey] };
}
