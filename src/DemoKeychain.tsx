import { useEffect, useState } from 'react';
import {
  describeCall,
  executeProblems,
  parseConnectRequest,
  parseExecuteRequest,
  resultUrl,
  sessionProblems,
  type ConnectRequest,
  type ExecuteRequest,
} from '@kamui/sdk';
import { describeAmount, readTokenInfo } from '@kamui/sdk';
import { RpcProvider } from 'starknet';
import { CLASS_HASH, RPC_URL, SN_SEPOLIA } from './lib/config';
import { Button, Callout, Output, Seal } from './components/ui';

/** A recognisable simulated account: clearly not a live approval. */
const DEMO_ACCOUNT = '0xde0000000000000000000000000000000000000000000000000000000000001';
const DEMO_TX = '0x111111111111111111111111111111111111111111111111111111111111111';

type Kind = 'connect' | 'execute';

export function DemoKeychain({ kind }: { kind: Kind }) {
  const [error, setError] = useState<string | null>(null);
  const [connect, setConnect] = useState<ConnectRequest | null>(null);
  const [execute, setExecute] = useState<ExecuteRequest | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [descriptions, setDescriptions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const referrer = document.referrer;
    try {
      if (kind === 'connect') {
        const request = parseConnectRequest(window.location.hash, referrer);
        if (!request) {
          setError('No connect request in the URL. Open this page from the demo’s “Connect with Kamui” button.');
          return;
        }
        setConnect(request);
        setProblems(sessionProblems(DEMO_ACCOUNT, request.session));
      } else {
        const request = parseExecuteRequest(window.location.hash, referrer);
        if (!request) {
          setError('No execute request in the URL. Open this page from a one-off execute button in the demo.');
          return;
        }
        setExecute(request);
        setProblems(executeProblems(DEMO_ACCOUNT, request.calls));
        setDescriptions(
          request.calls.map((call) => {
            const d = describeCall(call);
            if (d.kind === 'transfer') return `Send ${d.amount} raw units of ${d.token} to ${d.recipient}`;
            if (d.kind === 'approve') return `Allow ${d.spender} to spend ${d.amount} raw units of ${d.token}`;
            return `${call.entrypoint}() on ${call.to}`;
          }),
        );
        void enrich(request);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, [kind]);

  async function enrich(request: ExecuteRequest) {
    try {
      const provider = new RpcProvider({ nodeUrl: RPC_URL });
      const lines = await Promise.all(
        request.calls.map(async (call) => {
          const d = describeCall(call);
          if (d.kind === 'other') return `${call.entrypoint}() on ${call.to}`;
          const info = await readTokenInfo(provider, d.token);
          const named = describeAmount(d.amount, info);
          const caution = info.status === 'unverified' ? ' (name is a claim)' : info.status === 'unknown' ? ' (unrecognised token)' : '';
          if (d.kind === 'transfer') return `Send ${named}${caution} to ${d.recipient}`;
          return `Allow ${d.spender} to spend ${named}${caution}`;
        }),
      );
      setDescriptions(lines);
    } catch {
      // keep the raw descriptions
    }
  }

  function respond(ok: boolean) {
    const request = connect ?? execute;
    if (!request) return;
    setBusy(true);
    const result = ok
      ? kind === 'connect'
        ? { v: 1 as const, id: request.id, ok: true as const, account: DEMO_ACCOUNT, chainId: SN_SEPOLIA, classHash: CLASS_HASH }
        : { v: 1 as const, id: request.id, ok: true as const, transactionHash: DEMO_TX }
      : { v: 1 as const, id: request.id, ok: false as const, error: 'user_refused' };
    window.location.assign(resultUrl(request, result));
  }

  const origin = (connect ?? execute) ? new URL((connect ?? execute)!.redirectUri).origin : '';
  const appName = (connect ?? execute)?.appName;

  return (
    <div className="kc">
      <div className="kc-seal">
        <Seal size={44} />
      </div>
      <p className="eyebrow">Demo keychain — simulated</p>
      <h1>{kind === 'connect' ? 'Approve a session' : 'Approve a transaction'}</h1>
      <Callout tone="warn">
        This is the in-app demo keychain. It runs the real Kamui protocol checks (
        <code>parseConnectRequest</code>, <code>sessionProblems</code>, <code>parseExecuteRequest</code>,{' '}
        <code>executeProblems</code>, <code>describeCall</code>) but it <strong>does not</strong> sign in, prove,
        or submit a transaction on Sepolia. A hosted keychain at the planned <code>sepolia.kamui.page</code> is
        not deployed.
      </Callout>
      {error ? (
        <Callout tone="bad">
          <strong>{error}</strong>
          {!document.referrer ? (
            <p>
              The keychain refuses a request it cannot attribute to the redirect origin (empty{' '}
              <code>document.referrer</code>). That is the same check a production keychain makes.
            </p>
          ) : null}
        </Callout>
      ) : null}
      {(connect || execute) && (
        <>
          <p>An app is asking you to approve the following. The answer will go back to:</p>
          <div className="origin">
            {origin}
            {appName ? `  ·  “${appName}”` : ''}
          </div>
          {connect ? (
            <>
              <h3>Session</h3>
              <ul className="scope-list">
                {connect.session.calls.map((c) => (
                  <li key={c.to + c.entrypoint}>
                    <span>{c.entrypoint}()</span>
                    <span>{c.to}</span>
                  </li>
                ))}
              </ul>
              <p>
                Expires in about {Math.max(0, Math.round((connect.session.validUntil - Date.now() / 1000) / 60))}{' '}
                minutes. Up to {connect.session.maxCalls} calls. Fee cap {connect.session.maxFeePerTx}
                {connect.session.maxFeePerTx === '0x0' ? ' (sponsored only)' : ''}.
              </p>
              <p>
                The app can sign calls — and messages as the account — while the session lasts. Signing in on a
                new device ends every session.
              </p>
              {connect.session.limits.length ? (
                <p>
                  Spending limits:{' '}
                  {connect.session.limits.map((l) => `${l.token}: ${l.maxPerCall} per call, ${l.maxPerWindow} per ${l.windowSeconds}s`).join('; ')}
                </p>
              ) : (
                <p>No spending limits in this request (acceptable when the scope has no token calls).</p>
              )}
            </>
          ) : null}
          {execute ? (
            <>
              <h3>Calls (full authority)</h3>
              <p>This uses the account’s full authority, for one transaction only.</p>
              <ul className="scope-list">
                {descriptions.map((line, i) => (
                  <li key={i}>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {problems.length ? (
            <Callout tone="bad">
              <strong>This request is refused, whatever you click:</strong>
              {problems.map((p) => (
                <div key={p} className="problem">
                  {p}
                </div>
              ))}
            </Callout>
          ) : (
            <div className="actions">
              <Button variant="primary" onClick={() => respond(true)} disabled={busy}>
                {kind === 'connect' ? 'Approve session (simulated)' : 'Approve transaction (simulated)'}
              </Button>
              <Button onClick={() => respond(false)} disabled={busy}>
                Refuse
              </Button>
            </div>
          )}
          {problems.length ? (
            <div className="actions">
              <Button onClick={() => respond(false)} disabled={busy}>
                Go back
              </Button>
            </div>
          ) : null}
        </>
      )}
      <Output>
        referrer: {document.referrer || '(empty)'}
        {'\n'}
        fragment: {window.location.hash.slice(0, 80) || '(none)'}
        {window.location.hash.length > 80 ? '…' : ''}
      </Output>
    </div>
  );
}
