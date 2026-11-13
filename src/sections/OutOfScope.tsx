import { useState } from 'react';
import { sessionProblems, newKeyPair, type WireSession } from '@kamui/sdk';
import { FEATURES } from '../lib/features';
import { STRK, TARGET } from '../lib/config';
import { Button, Callout, Card, Output, Section } from '../components/ui';

const feature = FEATURES.find((f) => f.id === 'out-of-scope')!;

function session(calls: WireSession['calls'], limits: WireSession['limits'] = []): WireSession {
  return {
    publicKey: newKeyPair().publicKey,
    validUntil: Math.floor(Date.now() / 1000) + 3600,
    maxCalls: 20,
    maxFeePerTx: '0x0',
    calls,
    limits,
  };
}

export function OutOfScope() {
  const [out, setOut] = useState('Compare a ping-only session with one that also asks for a transfer.');

  function pingOnly() {
    const s = session([{ to: TARGET, entrypoint: 'ping' }]);
    const problems = sessionProblems('0x1', s);
    setOut(
      [
        'Session scope: ping() on the Target contract only.',
        problems.length ? 'Problems:\n' + problems.join('\n') : 'sessionProblems: none — the keychain would show this for approval.',
        '',
        'If the app later signs a transfer() with this session key, the account refuses it at validation:',
        '  “Kamui: invalid session”. Nothing needs to be guessed — the live run in spikes/s1 recorded exactly that.',
        'A one-off /execute is the way to do something the session was not given (see the next section).',
      ].join('\n'),
    );
  }

  function withTransfer() {
    const s = session(
      [
        { to: TARGET, entrypoint: 'ping' },
        { to: STRK, entrypoint: 'transfer' },
      ],
      [],
    );
    const problems = sessionProblems('0x1', s);
    setOut(
      [
        'Session scope: ping() and STRK transfer(), with no spending policy.',
        'sessionProblems:',
        ...problems.map((p) => '  • ' + p),
        '',
        'The keychain refuses this before the user can click approve. Adding a STRK spending policy would clear the spending warning; the session would then be allowed to transfer, within the limit.',
      ].join('\n'),
    );
  }

  return (
    <Section feature={feature}>
      <Callout>
        Refusal happens in two places: at approval (<code>sessionProblems</code> in the keychain) and at
        execution (the account’s session validation). A well-behaved app only asks for what it needs — the
        original ping demo’s “try a call the session was not given” button is the second kind.
      </Callout>
      <Card title="What the keychain says">
        <div className="actions">
          <Button variant="primary" onClick={pingOnly}>
            Ping-only session
          </Button>
          <Button onClick={withTransfer}>Add an unlimited transfer</Button>
        </div>
        <Output>{out}</Output>
      </Card>
    </Section>
  );
}
