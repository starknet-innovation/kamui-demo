import { describe, expect, it, beforeEach } from 'vitest';
import { KNOWN_TOKENS, sessionProblems } from '@kamui/sdk';
import { DEMO_ACCOUNT, ETH, STRK, TARGET } from '../src/lib/config';
import { startKamuiConnect, startKamuiExecute, consumeKeychainReturn, resetKeychainReturnCache } from '../src/lib/connect';
import { toFragment } from '@kamui/sdk';
import {
  FAUCET_URL,
  SESSION_CALLS,
  SESSION_LIMITS,
  SESSION_MAX_FEE_PER_TX,
  TOKENS,
  approveCall,
  classifyTxStatus,
  formatBalance,
  loadActivity,
  parseCalldata,
  parseHumanAmount,
  recordActivity,
  starkscanContractUrl,
  starkscanTxUrl,
  takePendingExecute,
  tokenAddress,
  transferCall,
  u256Calldata,
  voyagerContractUrl,
  voyagerTxUrl,
  clearActivity,
  isValidFelt,
  readWalletSnapshot,
} from '../src/lib/wallet';

describe('Sepolia token addresses', () => {
  it('match the SDK known-token list (same address on Sepolia and mainnet)', () => {
    const strk = KNOWN_TOKENS.find((t) => t.symbol === 'STRK');
    const eth = KNOWN_TOKENS.find((t) => t.symbol === 'ETH');
    expect(strk?.address).toBe(STRK);
    expect(eth?.address).toBe(ETH);
    expect(STRK).toBe('0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d');
    expect(ETH).toBe('0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7');
    expect(tokenAddress('STRK')).toBe(STRK);
    expect(tokenAddress('ETH')).toBe(ETH);
    expect(TOKENS.STRK.decimals).toBe(18);
  });
});

describe('parseHumanAmount', () => {
  it('converts decimal strings exactly, with 18 decimals', () => {
    expect(parseHumanAmount('1')).toBe(10n ** 18n);
    expect(parseHumanAmount('1.5')).toBe(15n * 10n ** 17n);
    expect(parseHumanAmount('0.1')).toBe(10n ** 17n);
    expect(parseHumanAmount('0.000000000000000001')).toBe(1n);
    expect(parseHumanAmount('100')).toBe(100n * 10n ** 18n);
  });

  it('rejects empty, negative, excess decimals, and junk', () => {
    expect(() => parseHumanAmount('')).toThrow(/empty/);
    expect(() => parseHumanAmount('-1')).toThrow(/negative/);
    expect(() => parseHumanAmount('1.0000000000000000001')).toThrow(/decimal places/);
    expect(() => parseHumanAmount('one')).toThrow(/decimal number/);
    expect(() => parseHumanAmount('1e18')).toThrow(/decimal number/);
  });
});

describe('formatBalance and calldata', () => {
  it('formats whole and fractional amounts without rounding', () => {
    expect(formatBalance(15n * 10n ** 17n)).toBe('1.5');
    expect(formatBalance(0n)).toBe('0');
  });

  it('encodes a transfer and an approve as u256 calldata', () => {
    const amount = 15n * 10n ** 17n;
    const u = u256Calldata(amount);
    expect(u).toHaveLength(2);
    const transfer = transferCall(STRK, '0x1', amount);
    expect(transfer.entrypoint).toBe('transfer');
    expect(transfer.contractAddress).toBe(STRK);
    expect(transfer.calldata).toEqual(['0x1', ...u]);
    const approve = approveCall(ETH, '0x2', amount);
    expect(approve.entrypoint).toBe('approve');
    expect(approve.contractAddress).toBe(ETH);
  });

  it('parses calldata felts', () => {
    expect(parseCalldata('')).toEqual([]);
    expect(parseCalldata('0x1, 0x2 0x3')).toEqual(['0x1', '0x2', '0x3']);
    expect(() => parseCalldata('zzz')).toThrow(/calldata/);
  });
});

describe('explorers and faucet', () => {
  it('points at Sepolia explorers and the official Starknet faucet', () => {
    expect(voyagerContractUrl('0xabc')).toBe('https://sepolia.voyager.online/contract/0xabc');
    expect(voyagerTxUrl('0xdef')).toBe('https://sepolia.voyager.online/tx/0xdef');
    expect(starkscanContractUrl('0xabc')).toBe('https://sepolia.starkscan.co/contract/0xabc');
    expect(starkscanTxUrl('0xdef')).toBe('https://sepolia.starkscan.co/tx/0xdef');
    expect(FAUCET_URL).toBe('https://faucet.starknet.io/');
  });
});

describe('session requested at connect', () => {
  it('covers STRK and ETH transfer/approve, Target.ping, spending limits, and a self-pay fee cap', () => {
    const entries = SESSION_CALLS.map((c) => `${c.to}:${c.entrypoint}`);
    expect(entries).toContain(`${STRK}:transfer`);
    expect(entries).toContain(`${STRK}:approve`);
    expect(entries).toContain(`${ETH}:transfer`);
    expect(entries).toContain(`${ETH}:approve`);
    expect(entries).toContain(`${TARGET}:ping`);
    expect(SESSION_LIMITS.map((l) => l.token)).toEqual([STRK, ETH]);
    expect(SESSION_MAX_FEE_PER_TX).toBe(10n ** 16n);
  });

  it('is a session the keychain would not refuse (sessionProblems is empty)', () => {
    const now = Math.floor(Date.now() / 1000);
    const problems = sessionProblems('0x1', {
      publicKey: '0x2',
      validUntil: now + 3600,
      maxCalls: 50,
      maxFeePerTx: '0x' + SESSION_MAX_FEE_PER_TX.toString(16),
      calls: SESSION_CALLS,
      limits: SESSION_LIMITS.map((l) => ({
        token: l.token,
        maxPerCall: '0x' + l.maxPerCall.toString(16),
        maxPerWindow: '0x' + l.maxPerWindow.toString(16),
        windowSeconds: l.windowSeconds,
      })),
    });
    expect(problems).toEqual([]);
  });

  it('would be refused without spending limits', () => {
    const now = Math.floor(Date.now() / 1000);
    const problems = sessionProblems('0x1', {
      publicKey: '0x2',
      validUntil: now + 3600,
      maxCalls: 50,
      maxFeePerTx: '0x0',
      calls: SESSION_CALLS,
      limits: [],
    });
    expect(problems.some((p) => /spending limit/.test(p))).toBe(true);
  });

  it('puts those scopes into the beginConnect URL', () => {
    sessionStorage.clear();
    const url = startKamuiConnect(false);
    expect(url.startsWith('https://sepolia.kamui.page/connect#kamui=')).toBe(true);
    const payload = new URLSearchParams(new URL(url).hash.replace(/^#/, '')).get('kamui')!;
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const decoded = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)))) as {
      session: { calls: { to: string; entrypoint: string }[]; limits: unknown[]; maxFeePerTx: string };
    };
    expect(decoded.session.calls).toEqual(SESSION_CALLS);
    expect(decoded.session.limits).toHaveLength(2);
    expect(BigInt(decoded.session.maxFeePerTx)).toBe(SESSION_MAX_FEE_PER_TX);
  });
});

describe('activity and execute return', () => {
  beforeEach(() => {
    resetKeychainReturnCache();
    sessionStorage.clear();
    clearActivity();
    window.history.replaceState(null, '', '/');
  });

  it('records a submitted execute in this-tab activity', () => {
    const url = startKamuiExecute(
      [{ contractAddress: STRK, entrypoint: 'transfer', calldata: ['0x1', '0x1', '0x0'] }],
      { kind: 'transfer', label: 'Send 1 STRK' },
      false,
    );
    expect(url.startsWith('https://sepolia.kamui.page/execute#kamui=')).toBe(true);
    const pending = JSON.parse(sessionStorage.getItem('kamui.pending.execute')!);
    const answer = toFragment({
      v: 1,
      id: pending.id,
      ok: true,
      transactionHash: '0xabc',
    } as never);
    window.history.replaceState(null, '', '/' + answer);
    const result = consumeKeychainReturn();
    expect(result.tone).toBe('ok');
    expect(result.message).toMatch(/0xabc/);
    const items = loadActivity();
    expect(items).toHaveLength(1);
    expect(items[0]?.hash).toBe('0xabc');
    expect(items[0]?.label).toBe('Send 1 STRK');
    expect(items[0]?.kind).toBe('transfer');
    expect(items[0]?.status).toBe('pending');
    expect(takePendingExecute()).toBeNull();
  });

  it('classifies receipt statuses', () => {
    expect(classifyTxStatus({ execution_status: 'SUCCEEDED', finality_status: 'ACCEPTED_ON_L2' })).toBe('succeeded');
    expect(classifyTxStatus({ execution_status: 'REVERTED', finality_status: 'ACCEPTED_ON_L2' })).toBe('reverted');
    expect(classifyTxStatus({ finality_status: 'REJECTED' })).toBe('rejected');
    expect(classifyTxStatus({ finality_status: 'RECEIVED' })).toBe('pending');
  });

  it('appends activity items newest first and updates status', () => {
    recordActivity({ hash: '0x1', kind: 'ping', label: 'Ping', at: 1, status: 'pending' });
    recordActivity({ hash: '0x2', kind: 'transfer', label: 'Send', at: 2, status: 'pending' });
    const items = loadActivity();
    expect(items.map((i) => i.hash)).toEqual(['0x2', '0x1']);
  });
});


describe('isValidFelt', () => {
  it('accepts real Sepolia addresses and rejects the demo placeholder (above the Stark prime)', () => {
    expect(isValidFelt(STRK)).toBe(true);
    expect(isValidFelt(ETH)).toBe(true);
    expect(isValidFelt(TARGET)).toBe(true);
    expect(isValidFelt('0x1')).toBe(true);
    expect(isValidFelt(DEMO_ACCOUNT)).toBe(false);
  });

  it('returns a labeled demo snapshot instead of calling the RPC with an invalid felt', async () => {
    const snap = await readWalletSnapshot(DEMO_ACCOUNT);
    expect(snap.demo).toBe(true);
    expect(snap.deployed).toBe(false);
    expect(snap.strk).toBe(0n);
  });
});
