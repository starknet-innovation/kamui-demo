import { useState } from 'react';
import { beginExecute, describeCall, executeProblems, type WireCall } from '@kamui/sdk';
import { uint256 } from 'starknet';
import { FEATURES } from '../lib/features';
import { APP_NAME, STRK, TARGET, activeKeychainUrl, isDemoKeychain } from '../lib/config';
import { currentExecuteAccount } from '../lib/account';
import { Button, Callout, Card, Output, Section } from '../components/ui';

const feature = FEATURES.find((f) => f.id === 'execute')!;

const ADD_OWNER_CALLDATA = ['0x2', '0x2', '0x3', '0x4'];

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

  function inspectApprove() {
    const account = currentExecuteAccount();
    const wire: WireCall[] = [{ to: STRK, entrypoint: 'approve', calldata: [TARGET, ...amount(1_500_000_000_000_000_000n)] }];
    setOut(describe(wire, account) + '\n\nThe approval screen would then name this “1.5 STRK” — see Token amounts.');
  }

  function inspectForbidden() {
    const account = currentExecuteAccount();
    const wire: WireCall[] = [{ to: account, entrypoint: 'add_owner', calldata: ADD_OWNER_CALLDATA }];
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

  function goApprove() {
    go([{ contractAddress: STRK, entrypoint: 'approve', calldata: [TARGET, ...amount(1_500_000_000_000_000_000n)] }]);
  }

  function goAddOwner() {
    // Resolve at click time so a hosted connect or disconnect is not stale.
    const account = currentExecuteAccount();
    go([{ contractAddress: account, entrypoint: 'add_owner', calldata: ADD_OWNER_CALLDATA }]);
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
          <Button onClick={goApprove}>Ask the keychain to approve 1.5 STRK</Button>
          <Button onClick={goAddOwner}>Ask it to add an owner (should be refused)</Button>
        </div>
        <Output>{out}</Output>
      </Card>
    </Section>
  );
}
