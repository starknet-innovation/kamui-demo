import { useState } from 'react';
import { describeAmount, formatTokenAmount, isUnlimitedAmount, readTokenInfo, KNOWN_TOKENS, type TokenInfo } from '@kamui/sdk';
import { RpcProvider } from 'starknet';
import { FEATURES } from '../lib/features';
import { ETH, RPC_URL, STRK, TARGET } from '../lib/config';
import { Button, Callout, Card, Field, Output, Section } from '../components/ui';

const feature = FEATURES.find((f) => f.id === 'tokens')!;

const KNOWN_STRK: TokenInfo = { status: 'known', address: STRK, symbol: 'STRK', decimals: 18 };
const UNVERIFIED: TokenInfo = { status: 'unverified', address: '0x123', symbol: 'GOLD', decimals: 18 };
const UNKNOWN: TokenInfo = { status: 'unknown', address: '0x456' };

export function TokenAmounts() {
  const [raw, setRaw] = useState('1500000000000000000');
  const [out, setOut] = useState('Format an amount, then look a contract up on Sepolia.');
  const [tone, setTone] = useState<'ok' | 'bad' | undefined>();
  const [busy, setBusy] = useState(false);

  function format() {
    const amount = BigInt(raw);
    const lines = [
      'formatTokenAmount(' + raw + ', 18) = ' + formatTokenAmount(amount, 18),
      'isUnlimitedAmount: ' + String(isUnlimitedAmount(amount)),
      '',
      'describeAmount, known STRK:       ' + describeAmount(amount, KNOWN_STRK),
      'describeAmount, unverified GOLD:  ' + describeAmount(amount, UNVERIFIED) + '  — shown as a claim, with a caution',
      'describeAmount, unknown contract: ' + describeAmount(amount, UNKNOWN),
      '',
      'Known tokens (same address on mainnet and Sepolia):',
      ...KNOWN_TOKENS.map((t) => '  ' + t.symbol + '  ' + t.address),
    ];
    setTone('ok');
    setOut(lines.join('\n'));
  }

  async function lookup(address: string) {
    setBusy(true);
    try {
      const provider = new RpcProvider({ nodeUrl: RPC_URL });
      const info = await readTokenInfo(provider, address);
      const sample = 1_500_000_000_000_000_000n;
      setTone('ok');
      setOut(
        [
          'readTokenInfo on Sepolia for ' + address,
          'status:   ' + info.status,
          'symbol:   ' + ('symbol' in info ? info.symbol : '(none)'),
          'decimals: ' + ('decimals' in info ? String(info.decimals) : '(none)'),
          '1.5 × 10^18 units would be shown as: ' + describeAmount(sample, info),
          info.status === 'known'
            ? 'The address is in the SDK’s built-in list; the name is trusted.'
            : info.status === 'unverified'
              ? 'The contract answered symbol() and decimals(), but anyone can deploy a token with any name. The keychain shows this as a claim.'
              : 'The contract did not answer like a token. Only raw units can be shown.',
        ].join('\n'),
      );
    } catch (error) {
      setTone('bad');
      setOut('RPC error: ' + (error as Error).message);
    }
    setBusy(false);
  }

  return (
    <Section feature={feature}>
      <Callout>
        Amounts are shown in whole units, exactly, with no floating point —{' '}
        <code>formatTokenAmount(1500000000000000000n, 18)</code> is <code>1.5</code>. Conventional max-u256 and
        max-u128 allowances are called “unlimited”.
      </Callout>
      <div className="grid two">
        <Card title="Format and describe">
          <Field label="Raw amount (integer units)">
            <input value={raw} onChange={(e) => setRaw(e.target.value)} />
          </Field>
          <div className="actions">
            <Button variant="primary" onClick={format}>
              Describe
            </Button>
            <Button onClick={() => setRaw(((1n << 256n) - 1n).toString())}>Set unlimited (2^256−1)</Button>
          </div>
        </Card>
        <Card title="Look up on Sepolia">
          <p>Uses the public RPC to call <code>symbol()</code> and <code>decimals()</code> when the address is not known.</p>
          <div className="actions">
            <Button variant="primary" onClick={() => void lookup(STRK)} disabled={busy}>
              Look up STRK
            </Button>
            <Button onClick={() => void lookup(ETH)} disabled={busy}>
              Look up ETH
            </Button>
            <Button onClick={() => void lookup(TARGET)} disabled={busy}>
              Look up the Target contract
            </Button>
          </div>
        </Card>
      </div>
      <Output tone={tone}>{out}</Output>
    </Section>
  );
}
