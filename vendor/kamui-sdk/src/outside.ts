// Sponsored calls: SNIP-9 v2 outside execution, signed by an owner or by a session and sent by
// anyone (a relayer or paymaster). See contracts/src/core.cairo.
import {
  CallData,
  OutsideExecutionVersion,
  hash,
  outsideExecution,
  typedData,
  type BigNumberish,
  type Call,
} from 'starknet';
import { ANY_CALLER } from './constants';
import type { KamuiReader } from './reader';
import { sessionSignature } from './sessions';
import { randomFelt, signHash, toHex } from './utils';

export type OutsideWindow = {
  /** Who may submit it. Defaults to anyone. */
  caller?: string;
  /** Unix seconds; the call is valid strictly after this. Defaults to 0. */
  executeAfter?: number;
  /** Unix seconds; the call is valid strictly before this. */
  executeBefore: number;
};

const windowOf = (w: OutsideWindow) => ({
  caller: w.caller ?? ANY_CALLER,
  executeAfter: w.executeAfter ?? 0,
  executeBefore: w.executeBefore,
});

/** The SNIP-12 hash an owner or session signs for an outside execution. */
export function outsideExecutionHash(
  chainId: string,
  account: string,
  calls: Call[],
  nonce: BigNumberish,
  window: OutsideWindow,
): string {
  const w = windowOf(window);
  const data = outsideExecution.getTypedData(
    chainId as Parameters<typeof outsideExecution.getTypedData>[0],
    { caller: w.caller, execute_after: w.executeAfter, execute_before: w.executeBefore },
    toHex(nonce),
    calls,
    OutsideExecutionVersion.V2,
  );
  return typedData.getMessageHash(data, account);
}

/** The `execute_from_outside_v2` call a relayer sends, given the signature. */
export function outsideExecutionCall(
  account: string,
  calls: Call[],
  nonce: BigNumberish,
  window: OutsideWindow,
  signature: string[],
): Call {
  const w = windowOf(window);
  const flat = calls.flatMap((call) => {
    const data = CallData.compile(call.calldata ?? []).map((felt) => toHex(felt));
    return [call.contractAddress, hash.getSelectorFromName(call.entrypoint), toHex(data.length), ...data];
  });
  return {
    contractAddress: account,
    entrypoint: 'execute_from_outside_v2',
    calldata: [
      w.caller,
      toHex(nonce),
      toHex(w.executeAfter),
      toHex(w.executeBefore),
      toHex(calls.length),
      ...flat,
      toHex(signature.length),
      ...signature,
    ],
  };
}

/** A sponsored call signed by an owner key. Any unused nonce works; a random one is picked. */
export function ownerOutsideExecution(args: {
  chainId: string;
  account: string;
  calls: Call[];
  ownerPrivateKey: string;
  window: OutsideWindow;
  nonce?: BigNumberish;
}): Call {
  const nonce = args.nonce ?? randomFelt();
  const messageHash = outsideExecutionHash(args.chainId, args.account, args.calls, nonce, args.window);
  return outsideExecutionCall(args.account, args.calls, nonce, args.window, signHash(messageHash, args.ownerPrivateKey));
}

/**
 * A sponsored call signed by a session key. The nonce must be one of the session's reserved
 * nonces (`nextSessionNonce`); the contract refuses any other.
 */
export function sessionOutsideExecution(args: {
  chainId: string;
  account: string;
  calls: Call[];
  session: { privateKey: string; publicKey: string; validUntil: number };
  nonce: BigNumberish;
  window?: OutsideWindow;
}): Call {
  const window = args.window ?? { executeBefore: args.session.validUntil };
  const messageHash = outsideExecutionHash(args.chainId, args.account, args.calls, args.nonce, window);
  return outsideExecutionCall(args.account, args.calls, args.nonce, window, sessionSignature(messageHash, args.session));
}

/**
 * The session's next unused sponsored nonce, or null if all `maxCalls` are used. Scans from
 * `fromOffset`; keep the returned offset and pass `offset + 1` next time to avoid rescanning.
 */
export async function nextSessionNonce(
  reader: KamuiReader,
  sessionPublicKey: string,
  maxCalls: number,
  fromOffset = 0,
): Promise<{ nonce: string; offset: number } | null> {
  const base = BigInt(await reader.sessionNonceBase(sessionPublicKey));
  for (let offset = fromOffset; offset < maxCalls; offset++) {
    const nonce = toHex(base + BigInt(offset));
    if (await reader.isOutsideNonceAvailable(nonce)) return { nonce, offset };
  }
  return null;
}
