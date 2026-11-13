import { useState } from 'react';
import { beginExecute, describeCall, executeProblems, loadConnection, type WireCall } from '@kamui/sdk';
import { uint256 } from 'starknet';
import { FEATURES } from '../lib/features';
import { APP_NAME, DEMO_ACCOUNT, LIVE_KEYCHAIN, STRK, TARGET, activeKeychainUrl, isDemoKeychain } from '../lib/config';
import { Button, Callout, Card, Output, Section } from '../components/ui';

const feature = FEATURES.find((f) => f.id === 'execute')!;

function amount(value: bigint): string[] {
  const { low, high } = uint256.bnToUint256(value);
  return [low, high].map((part) => '0x' + BigInt(part).toString(16));
}

function describe(calls: WireCall[], account: string): string {
  const problems = executeProblems(account, calls);
  const lines = calls.map((call, i) => {
    const d = describeCall(call);
    const what =
      d.kind === 'transfer'
        ? `transfer of ${d.amount} raw units of token ${d.token} to ${d.recipient}`
        : d.kind === 'approve'
          ? `approve ${d.amount} raw units of token ${d.token} for spender ${d.spender}`
          : `${call.entrypoint}() on ${call.to}`;
    return `${i + 1}. ${what}\n   calldata: ${call.calldata.join(', ') || '(none)'}`;
  });
  return (
    lines.join('\n') +
    '\n\n' +
    (problems.length
      ? 'executeProblems (the keychain would refuse):\n' + problems.map((p) => '  • ' + p).join('\n')
      : 'executeProblems: none. The keychain would show these calls, using the account’s full authority, and say so.')
  );
}

export function OneOffExecute() {
  const [out, setOut] = useState('Inspect a one-off approval, or send it to the (demo) keychain.');
  // Same identity the demo keychain uses in executeProblems, or the connected account for a hosted keychain.
  const account =
    (LIVE_KEYCHAIN && typeof sessionStorage !== 'undefined' && loadConnection(sessionStorage)?.account) || DEMO_ACCOUNT;

  const approveCalls = [
    { contractAddress: STRK, entrypoint: 'approve', calldata: [TARGET, ...amount(1_500_000_000_000_000_000n)] },
  ];
  const accountCall = [{ contractAddress: account, entrypoint: 'add_owner', calldata: ['0x2', '0x2', '0x3', '0x4'] }];

  function inspectApprove() {
    const wire: WireCall[] = [{ to: STRK, entrypoint: 'approve', calldata: [TARGET, ...amount(1_500_000_000_000_000_000n)] }];
    setOut(describe(wire, account) + '\n\nThe approval screen would then name this “1.5 STRK” — see Token amounts.');
  }

  function inspectForbidden() {
    const wire: WireCall[] = [{ to: account, entrypoint: 'add_owner', calldata: ['0x2', '0x2', '0x3', '0x4'] }];
    setOut(
      describe(wire, account) +
        '\n\nDevice keys, sessions and spending limits are only ever changed from the keychain’s own pages, never at a site’s request.',
    );
  }

  function go(calls: { contractAddress: string; entrypoint: string; calldata: string[] }[]) {
    const url = beginExecute(
      { keychainUrl: activeKeychainUrl(), redirectUri: `${window.location.origin}${import.meta.env.BASE_URL}`, appName: APP_NAME, calls },
      sessionStorage,
    );
    window.location.assign(url);
  }

  return (
    <Section feature={feature}>
      <Callout>
        An execute request is bounded so the approval screen can show all of it (10 calls, 100 calldata
        felts). The user comes back with a transaction hash; in a live keychain the transaction has already
        been accepted by the network. {isDemoKeychain() ? 'The in-app demo keychain shows the same screen and returns a simulated hash.' : ''}
      </Callout>
      <Card title="describeCall and executeProblems">
        <div className="actions">
          <Button variant="primary" onClick={inspectApprove}>
            Inspect approve 1.5 STRK
          </Button>
          <Button onClick={inspectForbidden}>Inspect a call to the account itself</Button>
          <Button onClick={() => go(approveCalls)}>Ask the keychain to approve 1.5 STRK</Button>
          <Button onClick={() => go(accountCall)}>Ask it to add an owner (should be refused)</Button>
        </div>
        <Output>{out}</Output>
      </Card>
    </Section>
  );
}
