// Where a Kamui account lives. The derivation is the one in keep-starknet-strange/social-account
// (MIT), which Kamui's account keeps: see `identity` in contracts/src/jwt/types.cairo.
import { CallData, Deployer, byteArray, hash, type BigNumberish, type Call } from 'starknet';
import { toHex } from './utils';

/** The claims of a login token that identify the user. */
export type LoginClaims = { iss: string; aud: string; sub: string };

/** No pepper. Only for testnets: with it, anyone who knows a user's `sub` can find their account. */
export const NO_PEPPER = '0x0';

/**
 * `poseidon(iss, aud, sub, pepper)`, with the strings serialized as Cairo byte arrays.
 * The pepper comes from the pepper service and must be the same for every `aud`.
 */
export function identity(claims: LoginClaims, pepper: BigNumberish): string {
  return hash.computePoseidonHashOnElements(
    CallData.compile([
      ...[claims.iss, claims.aud, claims.sub].map(byteArray.byteArrayFromString),
      toHex(pepper),
    ]),
  );
}

/** Constructor calldata of `KamuiAccount(aud: ByteArray, identity: felt252)`. */
export function constructorCalldata(aud: string, accountIdentity: BigNumberish): string[] {
  return CallData.compile([byteArray.byteArrayFromString(aud), toHex(accountIdentity)]);
}

/**
 * The account's address: deployed through the UDC from zero, with the identity as salt.
 * It depends on the class hash, so it changes if the account class changes (Kamui accounts are
 * not upgradeable).
 */
export function accountAddress(classHash: string, aud: string, accountIdentity: BigNumberish): string {
  return hash.calculateContractAddressFromHash(
    toHex(accountIdentity),
    classHash,
    constructorCalldata(aud, accountIdentity),
    0,
  );
}

/** The account a login maps to. */
export function accountAddressFromLogin(classHash: string, claims: LoginClaims, pepper: BigNumberish): string {
  return accountAddress(classHash, claims.aud, identity(claims, pepper));
}

/** The UDC call that deploys the account. Anyone can send it; the sender is not part of the address. */
export function deployAccountCall(classHash: string, aud: string, accountIdentity: BigNumberish): Call {
  return new Deployer().buildDeployerCall(
    {
      classHash,
      salt: toHex(accountIdentity),
      unique: false,
      constructorCalldata: constructorCalldata(aud, accountIdentity),
    },
    '0x0',
  ).calls[0]!;
}
