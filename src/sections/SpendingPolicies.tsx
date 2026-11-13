import { useState } from 'react';
import { SPENDING_ENTRYPOINTS, unlimitedTokenCalls, type ScopedCall, type SpendingLimit } from '@kamui/sdk';
import { FEATURES } from '../lib/features';
import { STRK, TARGET } from '../lib/config';
import { Button, Callout, Card, Field, Output, Section } from '../components/ui';

const feature = FEATURES.find((f) => f.id === 'spending')!;

export function SpendingPolicies() {
  const [calls, setCalls] = useState<ScopedCall[]>([
    { to: TARGET, entrypoint: 'ping' },
    { to: STRK, entrypoint: 'transfer' },
  ]);
  const [limits, setLimits] = useState<SpendingLimit[]>([]);
  const [token, setToken] = useState(STRK);
  const [maxPerCall, setMaxPerCall] = useState('1000000000000000000');
  const [maxPerWindow, setMaxPerWindow] = useState('1500000000000000000');
  const [windowSeconds, setWindowSeconds] = useState(3600);
  const [out, setOut] = useState('Add a transfer or approve, then add a policy — or see the refusal.');

  function check() {
    const open = unlimitedTokenCalls({ kind: 'contracts', calls }, limits);
    if (open.length) {
      setOut(
        [
          'The SDK would refuse to approve this session (unless allowUnlimitedSpending is passed).',
          'Under SNIP-41 a token with no policy is unrestricted: the session could move any amount.',
          'The contract does not force a policy; the keychain must set one.',
          '',
          'Uncovered token calls:',
          ...open.map((c) => '  ' + c.entrypoint + ' on ' + c.to),
          '',
          'Spending entry points counted by the policy: ' + SPENDING_ENTRYPOINTS.join(', ') + '.',
          'Limits apply on both the self-paid and the sponsored path and share one window.',
        ].join('\n'),
      );
    } else {
      setOut(
        [
          'Every token call in the scope has a spending policy. The keychain would accept this.',
          '',
          'Policies:',
          ...(limits.length
            ? limits.map(
                (l) =>
                  `  ${l.token}\n    maxPerCall ${l.maxPerCall}  maxPerWindow ${l.maxPerWindow}  window ${l.windowSeconds}s`,
              )
            : ['  (none — and no token calls in the scope)']),
        ].join('\n'),
      );
    }
  }

  return (
    <Section feature={feature}>
      <Callout tone="warn">
        <strong>This is a policy the SDK enforces for you, not the contract.</strong> Forgetting a limit on{' '}
        <code>transfer</code>, <code>approve</code> or an allowance increase leaves that token unrestricted.
      </Callout>
      <Card title="Policy builder">
        <p>
          Current scope:{' '}
          {calls.map((c) => (
            <code key={c.to + c.entrypoint} style={{ marginRight: 8 }}>
              {c.entrypoint}@{c.to.slice(0, 8)}…
            </code>
          ))}
        </p>
        <div className="actions">
          <Button onClick={() => setCalls((c) => [...c, { to: STRK, entrypoint: 'approve' }])}>Add STRK approve</Button>
          <Button onClick={() => setCalls((c) => [...c, { to: TARGET, entrypoint: 'ping' }])}>Add ping</Button>
          <Button onClick={() => setCalls([])}>Clear scope</Button>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <Field label="Token">
            <input value={token} onChange={(e) => setToken(e.target.value)} />
          </Field>
          <Field label="maxPerCall (wei)">
            <input value={maxPerCall} onChange={(e) => setMaxPerCall(e.target.value)} />
          </Field>
          <Field label="maxPerWindow (wei)">
            <input value={maxPerWindow} onChange={(e) => setMaxPerWindow(e.target.value)} />
          </Field>
          <Field label="window (seconds)">
            <input
              type="number"
              value={windowSeconds}
              onChange={(e) => setWindowSeconds(Number(e.target.value))}
            />
          </Field>
        </div>
        <div className="actions">
          <Button
            onClick={() =>
              setLimits((ls) => [
                ...ls,
                { token, maxPerCall: BigInt(maxPerCall), maxPerWindow: BigInt(maxPerWindow), windowSeconds },
              ])
            }
          >
            Add spending policy
          </Button>
          <Button onClick={() => setLimits([])}>Clear policies</Button>
          <Button variant="primary" onClick={check}>
            Run unlimitedTokenCalls
          </Button>
        </div>
        <Output>{out}</Output>
      </Card>
    </Section>
  );
}
