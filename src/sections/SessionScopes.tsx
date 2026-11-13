import { useState } from 'react';
import {
  BLOCKED_ENTRYPOINTS,
  MAX_SESSION_SCOPE_ENTRIES,
  assertValidSession,
  sessionProblems,
  newKeyPair,
  type ScopedCall,
  type WireSession,
} from '@kamui/sdk';
import { FEATURES } from '../lib/features';
import { TARGET } from '../lib/config';
import { Button, Callout, Card, Field, Output, Section } from '../components/ui';

const feature = FEATURES.find((f) => f.id === 'sessions')!;

function wire(accountUnused: string, calls: ScopedCall[], maxCalls: number, fee: string, validUntil: number): WireSession {
  void accountUnused;
  return {
    publicKey: newKeyPair().publicKey,
    validUntil,
    maxCalls,
    maxFeePerTx: fee,
    calls,
    limits: [],
  };
}

export function SessionScopes() {
  const [account, setAccount] = useState('0x1');
  const [to, setTo] = useState(TARGET);
  const [entrypoint, setEntrypoint] = useState('ping');
  const [calls, setCalls] = useState<ScopedCall[]>([{ to: TARGET, entrypoint: 'ping' }]);
  const [maxCalls, setMaxCalls] = useState(20);
  const [fee, setFee] = useState('0x0');
  const [hours, setHours] = useState(2);
  const [out, setOut] = useState('Build a scope, then validate it with the same checks the keychain runs.');
  const [tone, setTone] = useState<'ok' | 'bad' | undefined>();

  function add() {
    setCalls((c) => [...c, { to, entrypoint }]);
  }

  function validate() {
    const validUntil = Math.floor(Date.now() / 1000) + hours * 3600;
    const session = wire(account, calls, maxCalls, fee, validUntil);
    const problems = sessionProblems(account, session);
    try {
      assertValidSession(account, {
        sessionPublicKey: session.publicKey,
        validUntil,
        maxCalls,
        maxFeePerTx: BigInt(fee),
        scope: { kind: 'contracts', calls },
      });
    } catch {
      // sessionProblems already captures this
    }
    if (problems.length) {
      setTone('bad');
      setOut('The keychain would refuse this session, whatever the user clicks:\n\n' + problems.map((p) => '• ' + p).join('\n'));
    } else {
      setTone('ok');
      setOut(
        [
          'The keychain would show this session for approval.',
          'session public key: ' + session.publicKey,
          'validUntil:         ' + validUntil + ' (' + hours + ' hour(s) from now)',
          'maxCalls:           ' + maxCalls + '  (counted separately on sponsored and self-paid paths)',
          'maxFeePerTx:        ' + fee + (fee === '0x0' ? '  (sponsored only)' : ''),
          'scope kind:         contracts (' + calls.length + ' of max ' + MAX_SESSION_SCOPE_ENTRIES + ')',
          ...calls.map((c) => '  ' + c.entrypoint + ' @ ' + c.to),
          '',
          'A scope of kind “any” or “entrypoints on any contract” is valid in SNIP-41 but the keychain prefers named contracts. Kind “any” also fails the spending-limit check.',
        ].join('\n'),
      );
    }
  }

  return (
    <Section feature={feature}>
      <Callout>
        Blocked entry points a session can never call (mirrors the contract):{' '}
        <code>{BLOCKED_ENTRYPOINTS.slice(0, 6).join(', ')}</code>, … — including{' '}
        <code>add_owner</code>, <code>recover</code>, <code>revoke_all_sessions</code>, and{' '}
        <code>execute_from_outside_v2</code>. A session can never target the account itself. These are
        rejected by <code>assertValidSession</code> and by <code>sessionProblems</code> before anything is sent.
      </Callout>
      <Card title="Scope builder">
        <div className="row">
          <Field label="Account (sessions may not target it)">
            <input value={account} onChange={(e) => setAccount(e.target.value)} />
          </Field>
          <Field label="maxCalls">
            <input type="number" min={1} value={maxCalls} onChange={(e) => setMaxCalls(Number(e.target.value))} />
          </Field>
          <Field label="valid for (hours)">
            <input type="number" min={0} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
          </Field>
          <Field label="maxFeePerTx (hex fri, 0 = sponsored only)">
            <input value={fee} onChange={(e) => setFee(e.target.value)} />
          </Field>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <Field label="Contract">
            <input value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Entrypoint">
            <input value={entrypoint} onChange={(e) => setEntrypoint(e.target.value)} />
          </Field>
        </div>
        <div className="actions">
          <Button onClick={add}>Add to scope</Button>
          <Button onClick={() => setCalls((c) => c.slice(0, -1))} disabled={calls.length === 0}>
            Remove last
          </Button>
          <Button
            onClick={() => {
              setEntrypoint('add_owner');
              setTo(account);
              setCalls((c) => [...c, { to: account, entrypoint: 'add_owner' }]);
            }}
          >
            Try a blocked call on the account
          </Button>
          <Button
            onClick={() => {
              setHours(0);
            }}
          >
            Expire it now
          </Button>
          <Button variant="primary" onClick={validate}>
            Validate with sessionProblems
          </Button>
        </div>
        <Output>
          {calls.length === 0
            ? '(empty scope)'
            : calls.map((c, i) => `${i + 1}. ${c.entrypoint} @ ${c.to}`).join('\n')}
        </Output>
        <Output tone={tone}>{out}</Output>
      </Card>
    </Section>
  );
}
