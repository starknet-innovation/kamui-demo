import { describe, expect, it } from 'vitest';
import { executeProblems, sessionProblems, newKeyPair } from '@kamui/sdk';
import { DEMO_ACCOUNT, TARGET } from '../src/lib/config';
import { parseNonNegativeInt, parsePositiveNumber, resolveSponsorUrl } from '../src/lib/parse';

describe('parseNonNegativeInt (spending policy and token amounts)', () => {
  it('accepts decimal and hex amounts', () => {
    expect(parseNonNegativeInt('1500000000000000000', 'maxPerCall')).toBe(1_500_000_000_000_000_000n);
    expect(parseNonNegativeInt('0x0', 'maxPerCall')).toBe(0n);
    expect(parseNonNegativeInt('  10  ', 'amount')).toBe(10n);
  });

  it('rejects empty, malformed and negative values instead of throwing a raw SyntaxError', () => {
    expect(() => parseNonNegativeInt('abc', 'maxPerCall')).toThrow("maxPerCall: 'abc' is not an integer");
    expect(() => parseNonNegativeInt('0xzz', 'maxPerWindow')).toThrow("maxPerWindow: '0xzz' is not an integer");
    expect(() => parseNonNegativeInt('', 'amount')).toThrow('amount: empty');
    expect(() => parseNonNegativeInt('   ', 'amount')).toThrow('amount: empty');
    expect(() => parseNonNegativeInt('-1', 'amount')).toThrow('amount: negative');
  });
});

describe('parsePositiveNumber', () => {
  it('accepts a positive integer and rejects zero, NaN and fractions', () => {
    expect(parsePositiveNumber(3600, 'windowSeconds')).toBe(3600);
    expect(parsePositiveNumber('60', 'windowSeconds')).toBe(60);
    expect(() => parsePositiveNumber(0, 'windowSeconds')).toThrow(/positive integer/);
    expect(() => parsePositiveNumber('abc', 'windowSeconds')).toThrow(/positive integer/);
  });
});

describe('resolveSponsorUrl', () => {
  it('uses an explicit gateway when given', () => {
    expect(resolveSponsorUrl('https://app.example/sponsor/', 'https://api.example')).toBe('https://app.example/sponsor');
  });

  it('falls back to the API /sponsor endpoint when no explicit gateway is set', () => {
    expect(resolveSponsorUrl('', 'https://api.example')).toBe('https://api.example/sponsor');
    expect(resolveSponsorUrl('  ', 'https://api.example/')).toBe('https://api.example/sponsor');
  });

  it('is empty when neither is configured', () => {
    expect(resolveSponsorUrl('', '')).toBe('');
  });
});

describe('sessionProblems with a malformed fee', () => {
  it('throws from BigInt on 0xzz, which the playground must catch', () => {
    const session = {
      publicKey: newKeyPair().publicKey,
      validUntil: Math.floor(Date.now() / 1000) + 3600,
      maxCalls: 10,
      maxFeePerTx: '0xzz',
      calls: [{ to: TARGET, entrypoint: 'ping' }],
      limits: [],
    };
    expect(() => sessionProblems('0x1', session)).toThrow();
  });
});

describe('executeProblems uses the same account as the demo keychain', () => {
  const calldata = ['0x2', '0x2', '0x3', '0x4'];

  it('refuses add_owner when it targets DEMO_ACCOUNT', () => {
    const problems = executeProblems(DEMO_ACCOUNT, [
      { to: DEMO_ACCOUNT, entrypoint: 'add_owner', calldata },
    ]);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.some((p) => /account itself/.test(p))).toBe(true);
  });

  it('does not refuse add_owner when the target is a different address (the old 0x1 bug)', () => {
    const problems = executeProblems(DEMO_ACCOUNT, [{ to: '0x1', entrypoint: 'add_owner', calldata }]);
    expect(problems).toEqual([]);
  });
});
