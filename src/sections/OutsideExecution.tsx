import { useState } from 'react';
import { ANY_CALLER, newKeyPair, ownerOutsideExecution, sessionOutsideExecution } from '@kamui/sdk';
import { FEATURES } from '../lib/features';
import { SN_SEPOLIA, TARGET } from '../lib/config';
import { Button, Callout, Card, Output, Section } from '../components/ui';

const feature = FEATURES.find((f) => f.id === 'outside')!;

export function OutsideExecution() {
  const [out, setOut] = useState('Build a sponsored owner call and a sponsored session call (no network).');

  function run() {
    const owner = newKeyPair();
    const session = { ...newKeyPair(), validUntil: Math.floor(Date.now() / 1000) + 3600 };
    const account = '0x111';
    const calls = [{ contractAddress: TARGET, entrypoint: 'ping', calldata: [] as string[] }];
    const window = { executeAfter: 0, executeBefore: Math.floor(Date.now() / 1000) + 600 };
    const ownerCall = ownerOutsideExecution({
      chainId: SN_SEPOLIA,
      account,
      calls,
      ownerPrivateKey: owner.privateKey,
      window,
    });
    const sessionCall = sessionOutsideExecution({
      chainId: SN_SEPOLIA,
      account,
      calls,
      session,
      nonce: '0x1',
    });
    setOut(
      [
        'ANY_CALLER (SNIP-9 “any caller” marker): ' + ANY_CALLER,
        '',
        'ownerOutsideExecution:',
        '  entrypoint: ' + ownerCall.entrypoint,
        '  to:         ' + ownerCall.contractAddress,
        '  calldata:   ' + (Array.isArray(ownerCall.calldata) ? ownerCall.calldata.length : '?') + ' felts',
        '',
        'sessionOutsideExecution (nonce 0x1, one of the session’s reserved range):',
        '  entrypoint: ' + sessionCall.entrypoint,
        '  to:         ' + sessionCall.contractAddress,
        '  calldata:   ' + (Array.isArray(sessionCall.calldata) ? sessionCall.calldata.length : '?') + ' felts',
        '',
        'A relayer (or AVNU) submits execute_from_outside_v2. Sponsored session nonces are a reserved range of maxCalls values; any other nonce is refused. nextSessionNonce finds the next free one by asking the account, one call per used nonce.',
        'The typed data is the standard SNIP-9 v2 message that starknet.js produces.',
      ].join('\n'),
    );
  }

  return (
    <Section feature={feature}>
      <div className="diagram" aria-hidden>
        <div className="box">App signs with the session key</div>
        <div className="arrow">→</div>
        <div className="box">execute_from_outside_v2</div>
        <div className="arrow">→</div>
        <div className="box">Relayer pays the fee</div>
      </div>
      <Callout>
        Kamui implements its own SNIP-9 <code>execute_from_outside_v2</code> for both owner and session
        signatures. Anyone can submit the call; the signature, not the sender, authorises it.
      </Callout>
      <Card title="Build both kinds of call">
        <div className="actions">
          <Button variant="primary" onClick={run}>
            Build owner and session outside executions
          </Button>
        </div>
        <Output>{out}</Output>
      </Card>
    </Section>
  );
}
