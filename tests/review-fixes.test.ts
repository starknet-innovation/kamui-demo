import { describe, expect, it } from 'vitest';
import { executeProblems, sessionProblems, newKeyPair, unlimitedTokenCalls } from '@kamui/sdk';
import { DEMO_ACCOUNT, STRK, TARGET } from '../src/lib/config';
import { parseFelt, parseNonNegativeInt, parsePositiveNumber, resolveSponsorUrl } from '../src/lib/parse';
import { resolveViteBase } from '../src/lib/basePath';
import { resolveExecuteAccount } from '../src/lib/account';

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

describe('parseFelt (spending-policy token)', () => {
  it('accepts a Starknet token address and trims whitespace', () => {
    expect(parseFelt(STRK, 'token')).toBe(STRK);
    expect(parseFelt('  0x1  ', 'token')).toBe('0x1');
  });

  it('rejects a malformed token such as 0xzz so the policy is never stored', () => {
    expect(() => parseFelt('0xzz', 'token')).toThrow("token: '0xzz' is not an integer");
    expect(() => parseFelt('abc', 'token')).toThrow("token: 'abc' is not an integer");
    expect(() => parseFelt('', 'token')).toThrow('token: empty');
    expect(() => parseFelt('-1', 'token')).toThrow('token: negative');
  });
});

describe('unlimitedTokenCalls with a malformed policy token', () => {
  it('throws from sameFelt / BigInt(limit.token) on 0xzz, which must not be stored', () => {
    expect(() =>
      unlimitedTokenCalls(
        { kind: 'contracts', calls: [{ to: STRK, entrypoint: 'transfer' }] },
        [{ token: '0xzz', maxPerCall: 1n, maxPerWindow: 1n, windowSeconds: 3600 }],
      ),
    ).toThrow();
  });

  it('succeeds when the stored token is a valid felt', () => {
    const open = unlimitedTokenCalls(
      { kind: 'contracts', calls: [{ to: STRK, entrypoint: 'transfer' }] },
      [{ token: STRK, maxPerCall: 1n, maxPerWindow: 1n, windowSeconds: 3600 }],
    );
    expect(open).toEqual([]);
  });
});

describe('resolveExecuteAccount (fresh account on each action)', () => {
  const connected = '0xabc000000000000000000000000000000000000000000000000000000000001';

  it('uses the currently connected account when a hosted keychain is live', () => {
    expect(resolveExecuteAccount(true, connected)).toBe(connected);
  });

  it('falls back to DEMO_ACCOUNT when a hosted keychain has no connection (disconnect)', () => {
    expect(resolveExecuteAccount(true, undefined)).toBe(DEMO_ACCOUNT);
    expect(resolveExecuteAccount(true, null)).toBe(DEMO_ACCOUNT);
    expect(resolveExecuteAccount(true, '')).toBe(DEMO_ACCOUNT);
    expect(resolveExecuteAccount(true, '   ')).toBe(DEMO_ACCOUNT);
  });

  it('always uses DEMO_ACCOUNT in demo-keychain mode, even if sessionStorage has an account', () => {
    expect(resolveExecuteAccount(false, connected)).toBe(DEMO_ACCOUNT);
    expect(resolveExecuteAccount(false, undefined)).toBe(DEMO_ACCOUNT);
  });

  it('builds an add_owner call that executeProblems refuses against the resolved account', () => {
    const account = resolveExecuteAccount(true, connected);
    const problems = executeProblems(account, [
      { to: account, entrypoint: 'add_owner', calldata: ['0x2', '0x2', '0x3', '0x4'] },
    ]);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.some((p) => /account itself/.test(p))).toBe(true);
  });

  it('does not refuse add_owner when the call still targets a stale DEMO_ACCOUNT after connect', () => {
    const current = resolveExecuteAccount(true, connected);
    const problems = executeProblems(current, [
      { to: DEMO_ACCOUNT, entrypoint: 'add_owner', calldata: ['0x2', '0x2', '0x3', '0x4'] },
    ]);
    expect(problems).toEqual([]);
    expect(current).not.toBe(DEMO_ACCOUNT);
  });
});

describe('resolveViteBase', () => {
  it('defaults to the site root when unset or empty', () => {
    expect(resolveViteBase(undefined)).toBe('/');
    expect(resolveViteBase(null)).toBe('/');
    expect(resolveViteBase('')).toBe('/');
    expect(resolveViteBase('   ')).toBe('/');
    expect(resolveViteBase('/')).toBe('/');
  });

  it('uses /kamui-demo/ when GITHUB_PAGES=1 and VITE_BASE_PATH is unset', () => {
    expect(resolveViteBase(undefined, '1')).toBe('/kamui-demo/');
    expect(resolveViteBase('', '1')).toBe('/kamui-demo/');
    expect(resolveViteBase('   ', '1')).toBe('/kamui-demo/');
    expect(resolveViteBase(undefined, ' 1 ')).toBe('/kamui-demo/');
    expect(resolveViteBase(undefined, 'true')).toBe('/');
    expect(resolveViteBase(undefined, '')).toBe('/');
  });

  it('lets an explicit VITE_BASE_PATH take precedence over GITHUB_PAGES', () => {
    expect(resolveViteBase('/', '1')).toBe('/');
    expect(resolveViteBase('/other', '1')).toBe('/other/');
    expect(resolveViteBase('/kamui-demo', '1')).toBe('/kamui-demo/');
  });

  it('normalises a project-site path from configure-pages to a trailing slash', () => {
    expect(resolveViteBase('/kamui-demo')).toBe('/kamui-demo/');
    expect(resolveViteBase('/kamui-demo/')).toBe('/kamui-demo/');
    expect(resolveViteBase('kamui-demo')).toBe('/kamui-demo/');
    expect(resolveViteBase('  /kamui-demo  ')).toBe('/kamui-demo/');
  });
});
