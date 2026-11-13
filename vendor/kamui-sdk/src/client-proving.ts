// Client-proof orchestration. Only first deployment authentication sends a JWT to the API.
import { hash, shortString, type RpcProvider } from 'starknet';
import { httpRecoverBackend, type RecoverBackend, type RecoverRequest, type RecoveryPollingOptions } from './login';
import { KamuiReader } from './reader';
import { identity, accountAddress } from './address';
import { decodeIdToken } from './login';
import { sameFelt } from './utils';

export const V2_PROGRAM = '0x1c7be3225dfb33359b3ba9ffbe1542b7da27879b6d89f47b967e512463fd324';
// V4 OS config: Sepolia chain ID and STRK fee token, pinned with this V2 profile.
export const V2_SEPOLIA_CONFIG = '0x57ed4d5e20d617d8cc087a5882eae4f71d005172326be6439b2e1fd8b4dc57';
export const V2_HEADER = '020400098446bd35fd2272efe19bf43aac7037b3b7e25e86d94170d95198245bbb8dc7';
export type ClientProof = { proof: string; proofFacts: string[] };
const FIELD = (1n << 251n) + 17n * (1n << 192n) + 1n;
const felt = (v: unknown): v is string => typeof v === 'string' && /^0x[0-9a-f]{1,64}$/i.test(v) && BigInt(v) < FIELD;
const outputMismatch = () => new Error('prover: recovery output mismatch');
export type ClientProver = (request: RecoverRequest, anchor: string) => Promise<ClientProof>;

export function recoveryMessage(account: string, accountIdentity: string, newKey: string, anchor: string): string {
  return hash.computePoseidonHashOnElements([account, '0x0', '0x5', account, accountIdentity, newKey, anchor, '0x0']);
}

/** Validate the bootloader preimage before any proof reaches the paid submission endpoint. */
export function clientProofFacts(preimage: string[], expectedMessage: string): string[] {
  if (!Array.isArray(preimage) || preimage.length !== 9 || !preimage.every(felt)) throw outputMismatch();
  const facts = [shortString.encodeShortString('PROOF2'), shortString.encodeShortString('VIRTUAL_SNOS'), ...preimage.slice(2)];
  if (BigInt(preimage[0]!) !== 1n || BigInt(preimage[1]!) !== 8n ||
      !sameFelt(facts[2]!, V2_PROGRAM) ||
      !sameFelt(facts[3]!, shortString.encodeShortString('VIRTUAL_SNOS0')) ||
      BigInt(facts[4]!) > BigInt(Number.MAX_SAFE_INTEGER) ||
      !sameFelt(facts[6]!, V2_SEPOLIA_CONFIG) ||
      BigInt(facts[7]!) !== 1n || !sameFelt(facts[8]!, expectedMessage)) throw outputMismatch();
  return facts;
}

/** Defense in depth for adapters: reject incompatible profiles and extra prover-owned data. */
function checkedProof(proof: ClientProof, expectedMessage: string): ClientProof {
  if (!proof || typeof proof.proof !== 'string' || proof.proof.length % 4 !== 0 ||
      proof.proof.length > 640_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(proof.proof)) throw new Error('prover: incompatible proof profile');
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(atob(proof.proof), c => c.charCodeAt(0)); }
  catch { throw new Error('prover: incompatible proof profile'); }
  const header = Uint8Array.from(V2_HEADER.match(/../g)!, b => Number.parseInt(b, 16));
  if (bytes.length <= header.length || bytes.length > 480_000 || !header.every((b, i) => bytes[i] === b)) throw new Error('prover: incompatible proof profile');
  if (!Array.isArray(proof.proofFacts) || proof.proofFacts.length !== 9 || !proof.proofFacts.every(felt) ||
      !sameFelt(proof.proofFacts[0]!, shortString.encodeShortString('PROOF2')) ||
      !sameFelt(proof.proofFacts[1]!, shortString.encodeShortString('VIRTUAL_SNOS'))) throw outputMismatch();
  const proofFacts = clientProofFacts(['0x1', '0x8', ...proof.proofFacts.slice(2)], expectedMessage);
  return { proof: proof.proof, proofFacts };
}

export function browserRecoverBackend(args: {
  apiUrl: string; provider: RpcProvider; classHash: string; prove: ClientProver;
  polling?: RecoveryPollingOptions; send?: Parameters<typeof httpRecoverBackend>[1];
  onStatus?: (message: string) => void;
  /** Local proving is complete; submission may now broadcast and cannot be cancelled. */
  onSubmitting?: () => void;
  /** Called before any first-deployment authentication or paid work. */
  assertSupported?: () => void;
}): RecoverBackend {
  return { async recover(request) {
    args.assertSupported?.();
    const claims = decodeIdToken(request.jwt);
    if (claims.exp - Date.now() / 1000 < 15 * 60) throw new Error('Sign in again: this token expires too soon for browser proving.');
    const id = identity(claims, request.pepper);
    if (!sameFelt(accountAddress(args.classHash, claims.aud, id), request.account)) throw new Error('prover: account mismatch');
    const reader = new KamuiReader(args.provider, request.account);
    if (!(await reader.isDeployed())) {
      args.onStatus?.('Deploying your account…');
      const deployed = await httpRecoverBackend(args.apiUrl, args.send, args.polling, '/deploy/authenticated').recover(request);
      if (BigInt(deployed.transaction_hash) !== 0n) await args.provider.waitForTransaction(deployed.transaction_hash);
    }
    const anchor = await reader.ownersAnchor();
    // A changed owner set invalidates the ownership signature prepared by completeLogin.
    if (request.ownersAnchor !== undefined && (!felt(request.ownersAnchor) || !sameFelt(request.ownersAnchor, anchor))) {
      throw new Error('prover: owners changed; start a fresh sign-in before proving');
    }
    const expected = recoveryMessage(request.account, id, request.newPubkey, anchor);
    const proof = checkedProof(await args.prove(request, anchor), expected);
    args.onSubmitting?.();
    args.onStatus?.('Submitting your proof…');
    return httpRecoverBackend<ClientProof & { account: string; newPubkey: string; signature: string[]; override: false }>(args.apiUrl, args.send, args.polling, '/relay').recover({
      account: request.account, newPubkey: request.newPubkey, signature: request.signature, override: false, ...proof,
    });
  } };
}
