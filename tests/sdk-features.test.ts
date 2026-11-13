import { describe, expect, it } from 'vitest';
import {
  BLOCKED_ENTRYPOINTS,
  MAX_OWNERS,
  NO_PEPPER,
  accountAddress,
  accountAddressFromLogin,
  addOwnerCall,
  assertValidSession,
  authUrl,
  beginConnect,
  beginLogin,
  describeAmount,
  describeCall,
  executeProblems,
  exportPepper,
  formatTokenAmount,
  identity,
  isUnlimitedAmount,
  keyProof,
  loginNonce,
  newKeyPair,
  ownerOutsideExecution,
  parsePepperFile,
  parseRegistryList,
  pepperFileMatchesLogin,
  pepperFromFile,
  registryContentHash,
  registryMessageHash,
  removeOwnerCall,
  revokeAllSessionsCall,
  revokeSessionCall,
  sessionOutsideExecution,
  sessionProblems,
  serializePepperFile,
  signNewOwner,
  unlimitedTokenCalls,
} from '@kamui/sdk';
import { CLASS_HASH, SN_SEPOLIA, STRK, TARGET } from '../src/lib/config';
import { FEATURES } from '../src/lib/features';

const CLAIMS = {
  iss: 'https://accounts.google.com',
  aud: 'kamui-demo.apps.googleusercontent.com',
  sub: 'demo-user-0001',
};

describe('feature inventory', () => {
  it('covers 19 named sections with unique ids', () => {
    expect(FEATURES).toHaveLength(19);
    expect(new Set(FEATURES.map((f) => f.id)).size).toBe(19);
  });
});

describe('account address', () => {
  it('is deterministic and agrees across helpers', () => {
    const id = identity(CLAIMS, '0x1234');
    const a = accountAddress(CLASS_HASH, CLAIMS.aud, id);
    const b = accountAddressFromLogin(CLASS_HASH, CLAIMS, '0x1234');
    expect(a).toBe(b);
    expect(a.startsWith('0x')).toBe(true);
    const other = accountAddressFromLogin(CLASS_HASH, { ...CLAIMS, sub: 'someone-else' }, '0x1234');
    expect(other).not.toBe(a);
  });

  it('changes with the class hash and warns that NO_PEPPER is zero', () => {
    const a = accountAddressFromLogin(CLASS_HASH, CLAIMS, '0x1');
    const b = accountAddressFromLogin('0x2', CLAIMS, '0x1');
    expect(a).not.toBe(b);
    expect(BigInt(NO_PEPPER)).toBe(0n);
  });
});

describe('pepper file', () => {
  it('round-trips and matches only the right claims', () => {
    const file = exportPepper({
      chainId: SN_SEPOLIA,
      classHash: CLASS_HASH,
      claims: CLAIMS,
      pepper: '0x99',
      keyVersion: 1,
      now: new Date('2026-11-13T12:00:00Z'),
    });
    const text = serializePepperFile(file);
    const parsed = parsePepperFile(text);
    expect(parsed.account).toBe(accountAddressFromLogin(CLASS_HASH, CLAIMS, '0x99'));
    expect(parsed.iss).toBe(CLAIMS.iss);
    expect(JSON.stringify(parsed).includes(CLAIMS.sub)).toBe(false);
    expect(pepperFileMatchesLogin(parsed, CLAIMS, SN_SEPOLIA)).toBe(true);
    expect(pepperFileMatchesLogin(parsed, { ...CLAIMS, sub: 'other' }, SN_SEPOLIA)).toBe(false);
    expect(pepperFromFile(parsed, CLAIMS, SN_SEPOLIA, CLASS_HASH).pepper).toBe(parsed.pepper);
    expect(() => pepperFromFile(parsed, { ...CLAIMS, sub: 'other' }, SN_SEPOLIA, CLASS_HASH)).toThrow(/another/);
  });

  it('rejects a pepper of zero and a garbled file', () => {
    expect(() =>
      exportPepper({ chainId: SN_SEPOLIA, classHash: CLASS_HASH, claims: CLAIMS, pepper: 0, keyVersion: 1 }),
    ).toThrow(/out of range/);
    expect(() => parsePepperFile('not-json')).toThrow(/not valid JSON/);
    expect(() => parsePepperFile('{"kind":"nope"}')).toThrow(/not a Kamui/);
  });
});

describe('sessions and spending', () => {
  const key = () => newKeyPair().publicKey;
  const future = () => Math.floor(Date.now() / 1000) + 3600;

  it('accepts a ping-only session and refuses a blocked entry point', () => {
    const publicKey = key();
    expect(() =>
      assertValidSession('0x1', {
        sessionPublicKey: publicKey,
        validUntil: future(),
        maxCalls: 10,
        maxFeePerTx: 0,
        scope: { kind: 'contracts', calls: [{ to: TARGET, entrypoint: 'ping' }] },
      }),
    ).not.toThrow();

    const problems = sessionProblems('0x1', {
      publicKey,
      validUntil: future(),
      maxCalls: 10,
      maxFeePerTx: '0x0',
      calls: [{ to: '0x1', entrypoint: 'add_owner' }],
      limits: [],
    });
    expect(problems.some((p) => /add_owner|account itself|never be called/i.test(p))).toBe(true);
    expect(BLOCKED_ENTRYPOINTS).toContain('add_owner');
    expect(BLOCKED_ENTRYPOINTS).toContain('recover');
  });

  it('flags a transfer with no spending policy', () => {
    const open = unlimitedTokenCalls(
      { kind: 'contracts', calls: [{ to: STRK, entrypoint: 'transfer' }, { to: TARGET, entrypoint: 'ping' }] },
      [],
    );
    expect(open).toEqual([{ to: STRK, entrypoint: 'transfer' }]);
    const covered = unlimitedTokenCalls(
      { kind: 'contracts', calls: [{ to: STRK, entrypoint: 'transfer' }] },
      [{ token: STRK, maxPerCall: 1n, maxPerWindow: 2n, windowSeconds: 60 }],
    );
    expect(covered).toEqual([]);
  });

  it('sessionProblems reports the missing limit', () => {
    const problems = sessionProblems('0x1', {
      publicKey: key(),
      validUntil: future(),
      maxCalls: 5,
      maxFeePerTx: '0x0',
      calls: [{ to: STRK, entrypoint: 'transfer' }],
      limits: [],
    });
    expect(problems.some((p) => /no spending limit/.test(p))).toBe(true);
  });
});

describe('tokens', () => {
  it('formats amounts exactly and names unlimited allowances', () => {
    expect(formatTokenAmount(1_500_000_000_000_000_000n, 18)).toBe('1.5');
    expect(formatTokenAmount(0n, 18)).toBe('0');
    const known = { status: 'known' as const, address: STRK, symbol: 'STRK', decimals: 18 };
    expect(describeAmount(1_500_000_000_000_000_000n, known)).toBe('1.5 STRK');
    expect(describeAmount((1n << 256n) - 1n, known)).toBe('an unlimited amount of STRK');
    expect(isUnlimitedAmount((1n << 256n) - 1n)).toBe(true);
    expect(describeAmount(10n, { status: 'unknown', address: '0x1' })).toBe('10 units');
  });

  it('describeCall recognises an approve', () => {
    const low = '0x14d1120d7b160000';
    const high = '0x0';
    // 1.5e18 = 0x14d1120d7b160000
    const d = describeCall({
      to: STRK,
      entrypoint: 'approve',
      calldata: [TARGET, low, high],
    });
    expect(d.kind).toBe('approve');
    if (d.kind === 'approve') {
      expect(d.amount).toBe(1_500_000_000_000_000_000n);
      expect(d.spender).toBe(TARGET);
    }
  });

  it('executeProblems refuses a call to the account itself', () => {
    const problems = executeProblems('0xabc', [{ to: '0xabc', entrypoint: 'add_owner', calldata: [] }]);
    expect(problems.length).toBeGreaterThan(0);
    expect(executeProblems('0xabc', [{ to: TARGET, entrypoint: 'ping', calldata: [] }])).toEqual([]);
  });
});

describe('login and key proof', () => {
  it('binds the nonce to the device key and produces a key proof', () => {
    const device = newKeyPair();
    const attempt = beginLogin('google', device.publicKey);
    expect(attempt.nonce).toBe(loginNonce(device.publicKey, attempt.blinding));
    const proof = keyProof(attempt, device);
    expect(proof.public_key).toBe(device.publicKey);
    expect(proof.signature).toHaveLength(2);
    const url = authUrl(attempt, 'client.apps.googleusercontent.com', 'http://localhost:5175/callback');
    expect(url.startsWith('https://accounts.google.com/')).toBe(true);
    expect(url).toContain(attempt.nonce);
    expect(url).toContain(attempt.state);
    const other = newKeyPair();
    expect(() => keyProof(attempt, other)).toThrow(/not the one/);
  });
});

describe('owners and revocation', () => {
  it('builds add and remove calls and will not exceed MAX_OWNERS conceptually', () => {
    expect(MAX_OWNERS).toBe(5);
    const key = newKeyPair();
    const sig = signNewOwner('0xabc', 1, key.privateKey);
    const add = addOwnerCall('0xabc', key.publicKey, sig);
    expect(add.entrypoint).toBe('add_owner');
    expect(removeOwnerCall('0xabc', key.publicKey).entrypoint).toBe('remove_owner');
    expect(revokeSessionCall('0xabc', key.publicKey).entrypoint).toBe('revoke_session_key');
    expect(revokeAllSessionsCall('0xabc').entrypoint).toBe('revoke_all_sessions');
  });
});

describe('registry', () => {
  it('hashes a record and drops malformed list entries', () => {
    const session = {
      publicKey: newKeyPair().publicKey,
      validUntil: Math.floor(Date.now() / 1000) + 60,
      maxCalls: 3,
      maxFeePerTx: '0x0',
      calls: [{ to: TARGET, entrypoint: 'ping' }],
      limits: [],
      origin: 'https://demo.example',
      appName: 'demo',
    };
    const content = registryContentHash(session);
    expect(content.startsWith('0x')).toBe(true);
    const message = registryMessageHash({
      chainId: SN_SEPOLIA,
      account: '0xabc',
      action: 'put',
      timestamp: Math.floor(Date.now() / 1000),
      nonce: '0x1',
      subject: session.publicKey,
      session,
    });
    expect(message.startsWith('0x')).toBe(true);
    const kept = parseRegistryList({
      sessions: [
        { ...session, createdAt: 1 },
        { not: 'a session' },
        { ...session, publicKey: newKeyPair().publicKey, origin: 'x'.repeat(500), createdAt: 1 },
      ],
    });
    expect(kept).toHaveLength(1);
    expect(kept[0]!.origin).toBe('https://demo.example');
  });
});

describe('outside execution', () => {
  it('builds owner and session execute_from_outside_v2 calls', () => {
    const owner = newKeyPair();
    const session = { ...newKeyPair(), validUntil: Math.floor(Date.now() / 1000) + 3600 };
    const calls = [{ contractAddress: TARGET, entrypoint: 'ping', calldata: [] as string[] }];
    const o = ownerOutsideExecution({
      chainId: SN_SEPOLIA,
      account: '0x111',
      calls,
      ownerPrivateKey: owner.privateKey,
      window: { executeAfter: 0, executeBefore: Math.floor(Date.now() / 1000) + 600 },
    });
    const s = sessionOutsideExecution({
      chainId: SN_SEPOLIA,
      account: '0x111',
      calls,
      session,
      nonce: '0x1',
    });
    expect(o.entrypoint).toBe('execute_from_outside_v2');
    expect(s.entrypoint).toBe('execute_from_outside_v2');
  });
});

describe('keychain beginConnect', () => {
  it('returns a /connect URL with a kamui fragment and stores the pending key', () => {
    const store = new Map<string, string>();
    const kv = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    const url = beginConnect(
      {
        keychainUrl: 'http://localhost:5175/keychain',
        redirectUri: 'http://localhost:5175/',
        appName: 'Kamui demo',
        validUntil: Math.floor(Date.now() / 1000) + 60,
        maxCalls: 4,
        calls: [{ to: TARGET, entrypoint: 'ping' }],
      },
      kv,
    );
    expect(url.startsWith('http://localhost:5175/keychain/connect#kamui=')).toBe(true);
    expect(store.get('kamui.pending')).toBeTruthy();
  });
});
