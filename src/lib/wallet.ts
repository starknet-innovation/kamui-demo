/** On-chain reads, explorers, amounts, and this-tab activity for the wallet dashboard. */
import { KamuiReader, formatTokenAmount, type Connection } from '@kamui/sdk';
import { RpcProvider, uint256, type Call, type ProviderInterface } from 'starknet';
import { ETH, RPC_URL, STRK, TARGET } from './config';
import { parseFelt } from './parse';

export const FAUCET_URL = 'https://faucet.starknet.io/';
export const VOYAGER_BASE = 'https://sepolia.voyager.online';
export const STARKSCAN_BASE = 'https://sepolia.starkscan.co';

export const TOKEN_DECIMALS = 18;

/** Stark field prime. A felt used as calldata must be strictly less than this. */
export const FELT_PRIME = 0x800000000000011000000000000000000000000000000000000000000000001n;

/** Whether `value` can be sent to Starknet as a felt (account address, etc.). */
export function isValidFelt(value: string): boolean {
  try {
    const n = BigInt(value.trim());
    return n >= 0n && n < FELT_PRIME;
  } catch {
    return false;
  }
}


export type TokenSymbol = 'STRK' | 'ETH';

export const TOKENS: Record<TokenSymbol, { address: string; symbol: TokenSymbol; decimals: number }> = {
  STRK: { address: STRK, symbol: 'STRK', decimals: TOKEN_DECIMALS },
  ETH: { address: ETH, symbol: 'ETH', decimals: TOKEN_DECIMALS },
};

/** Session fee cap in fri (0.01 STRK). Above zero so a funded account can self-pay. */
export const SESSION_MAX_FEE_PER_TX = 10n ** 16n;
export const SESSION_MAX_CALLS = 50;
export const SESSION_TTL_SECONDS = 24 * 3600;

/** Scopes requested at connect: token transfers/approvals plus the demo Target.ping. */
export const SESSION_CALLS = [
  { to: STRK, entrypoint: 'transfer' },
  { to: STRK, entrypoint: 'approve' },
  { to: ETH, entrypoint: 'transfer' },
  { to: ETH, entrypoint: 'approve' },
  { to: TARGET, entrypoint: 'ping' },
];

/** Spending limits the keychain requires for transfer/approve (SNIP-41 Part H). */
export const SESSION_LIMITS = [
  {
    token: STRK,
    maxPerCall: 100n * 10n ** 18n,
    maxPerWindow: 500n * 10n ** 18n,
    windowSeconds: 24 * 3600,
  },
  {
    token: ETH,
    maxPerCall: 1n * 10n ** 18n,
    maxPerWindow: 5n * 10n ** 18n,
    windowSeconds: 24 * 3600,
  },
];

export function voyagerContractUrl(address: string): string {
  return `${VOYAGER_BASE}/contract/${address}`;
}
export function voyagerTxUrl(hash: string): string {
  return `${VOYAGER_BASE}/tx/${hash}`;
}
export function starkscanContractUrl(address: string): string {
  return `${STARKSCAN_BASE}/contract/${address}`;
}
export function starkscanTxUrl(hash: string): string {
  return `${STARKSCAN_BASE}/tx/${hash}`;
}

/** Human decimal (e.g. "1.5") to the token's smallest unit. Exact: no floating point. */
export function parseHumanAmount(text: string, decimals: number = TOKEN_DECIMALS): bigint {
  const trimmed = text.trim();
  if (trimmed === '') throw new Error('amount: empty');
  if (trimmed.startsWith('-')) throw new Error('amount: negative');
  const match = /^(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) throw new Error('amount: use a decimal number, e.g. 1.5');
  const whole = match[1]!;
  const frac = match[2] ?? '';
  if (frac.length > decimals) throw new Error(`amount: more than ${decimals} decimal places`);
  const fracPadded = frac.padEnd(decimals, '0');
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fracPadded || '0');
}

export function formatBalance(amount: bigint, decimals: number = TOKEN_DECIMALS): string {
  return formatTokenAmount(amount, decimals);
}

export function u256Calldata(value: bigint): string[] {
  if (value < 0n) throw new Error('amount: negative');
  const { low, high } = uint256.bnToUint256(value);
  return ['0x' + BigInt(low).toString(16), '0x' + BigInt(high).toString(16)];
}

export function transferCall(token: string, recipient: string, amount: bigint): Call {
  return {
    contractAddress: token,
    entrypoint: 'transfer',
    calldata: [recipient, ...u256Calldata(amount)],
  };
}

export function approveCall(token: string, spender: string, amount: bigint): Call {
  return {
    contractAddress: token,
    entrypoint: 'approve',
    calldata: [spender, ...u256Calldata(amount)],
  };
}

export function pingCall(): Call {
  return { contractAddress: TARGET, entrypoint: 'ping', calldata: [] };
}

/** Comma- or whitespace-separated felts for a custom call. */
export function parseCalldata(text: string): string[] {
  const parts = text.trim() === '' ? [] : text.trim().split(/[\s,]+/).filter(Boolean);
  return parts.map((part, i) => parseFelt(part, `calldata[${i}]`));
}

export type WalletSnapshot = {
  deployed: boolean;
  strk: bigint;
  eth: bigint;
  /** True when the account is the in-app demo placeholder, which is not a Sepolia address. */
  demo?: boolean;
};

export function createProvider(rpcUrl: string = RPC_URL): RpcProvider {
  return new RpcProvider({ nodeUrl: rpcUrl });
}

export async function readBalance(
  provider: ProviderInterface,
  token: string,
  account: string,
): Promise<bigint> {
  const result = await provider.callContract({
    contractAddress: token,
    entrypoint: 'balanceOf',
    calldata: [account],
  });
  return uint256.uint256ToBN({ low: result[0]!, high: result[1] ?? '0x0' });
}

export async function readWalletSnapshot(account: string, provider: ProviderInterface = createProvider()): Promise<WalletSnapshot> {
  if (!isValidFelt(account)) {
    return { deployed: false, strk: 0n, eth: 0n, demo: true };
  }
  const reader = new KamuiReader(provider, account);
  const [deployed, strk, eth] = await Promise.all([
    reader.isDeployed(),
    readBalance(provider, STRK, account),
    readBalance(provider, ETH, account),
  ]);
  return { deployed, strk, eth };
}

export type TxStatus = 'pending' | 'succeeded' | 'reverted' | 'rejected' | 'unknown';

export type ActivityKind = 'transfer' | 'approve' | 'ping' | 'custom';

export type ActivityItem = {
  hash: string;
  kind: ActivityKind;
  label: string;
  at: number;
  status: TxStatus;
  simulated?: boolean;
};

const ACTIVITY_KEY = 'kamui-demo.activity';
const PENDING_EXECUTE_KEY = 'kamui-demo.pendingExecute';

export type PendingExecute = { kind: ActivityKind; label: string };

export function loadActivity(store: Storage = sessionStorage): ActivityItem[] {
  const text = store.getItem(ACTIVITY_KEY);
  if (!text) return [];
  try {
    const raw = JSON.parse(text) as ActivityItem[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveActivity(items: ActivityItem[], store: Storage = sessionStorage): void {
  store.setItem(ACTIVITY_KEY, JSON.stringify(items));
}

export function rememberPendingExecute(meta: PendingExecute, store: Storage = sessionStorage): void {
  store.setItem(PENDING_EXECUTE_KEY, JSON.stringify(meta));
}

export function takePendingExecute(store: Storage = sessionStorage): PendingExecute | null {
  const text = store.getItem(PENDING_EXECUTE_KEY);
  store.removeItem(PENDING_EXECUTE_KEY);
  if (!text) return null;
  try {
    return JSON.parse(text) as PendingExecute;
  } catch {
    return null;
  }
}

export function recordActivity(item: ActivityItem, store: Storage = sessionStorage): ActivityItem[] {
  const items = [item, ...loadActivity(store).filter((existing) => existing.hash !== item.hash)];
  saveActivity(items, store);
  return items;
}

export function updateActivityStatus(hash: string, status: TxStatus, store: Storage = sessionStorage): ActivityItem[] {
  const items = loadActivity(store).map((item) => (item.hash === hash ? { ...item, status } : item));
  saveActivity(items, store);
  return items;
}

export function clearActivity(store: Storage = sessionStorage): void {
  store.removeItem(ACTIVITY_KEY);
  store.removeItem(PENDING_EXECUTE_KEY);
}

export function classifyTxStatus(receipt: {
  execution_status?: string;
  finality_status?: string;
  status?: string;
}): TxStatus {
  const execution = (receipt.execution_status ?? '').toUpperCase();
  const finality = (receipt.finality_status ?? receipt.status ?? '').toUpperCase();
  if (execution === 'REVERTED') return 'reverted';
  if (finality === 'REJECTED') return 'rejected';
  if (execution === 'SUCCEEDED' || finality === 'ACCEPTED_ON_L2' || finality === 'ACCEPTED_ON_L1' || finality === 'ACCEPTED') {
    return 'succeeded';
  }
  if (finality === 'RECEIVED' || finality === 'PENDING' || finality === 'NOT_RECEIVED') return 'pending';
  return 'unknown';
}

export async function readTxStatus(provider: ProviderInterface, hash: string): Promise<TxStatus> {
  try {
    const receipt = (await provider.getTransactionReceipt(hash)) as {
      execution_status?: string;
      finality_status?: string;
      status?: string;
    };
    return classifyTxStatus(receipt);
  } catch {
    return 'pending';
  }
}

/** Shorten a felt for display: 0x1234…abcd */
export function shortFelt(value: string, head = 6, tail = 4): string {
  if (value.length <= head + tail + 2) return value;
  return value.slice(0, head + 2) + '…' + value.slice(-tail);
}

export function tokenAddress(symbol: TokenSymbol): string {
  return TOKENS[symbol].address;
}

/** Whether a leftover connection belongs to this app's current mode (hosted vs demo). */
export function connectionAccount(connection: Connection | null): string | null {
  return connection?.account ?? null;
}
