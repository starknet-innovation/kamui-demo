import { useCallback, useEffect, useState } from 'react';
import { createSessionAccount } from '@kamui/sdk';
import { LIVE_SPONSOR, TARGET, isDemoKeychain } from '../lib/config';
import {
  FAUCET_URL,
  SESSION_MAX_FEE_PER_TX,
  TOKENS,
  approveCall,
  classifyTxStatus,
  createProvider,
  formatBalance,
  loadActivity,
  parseCalldata,
  parseHumanAmount,
  pingCall,
  readTxStatus,
  readWalletSnapshot,
  recordActivity,
  shortFelt,
  starkscanContractUrl,
  starkscanTxUrl,
  tokenAddress,
  transferCall,
  updateActivityStatus,
  voyagerContractUrl,
  voyagerTxUrl,
  type ActivityItem,
  type TokenSymbol,
  type WalletSnapshot,
} from '../lib/wallet';
import { startKamuiExecute } from '../lib/connect';
import { parseFelt } from '../lib/parse';
import { Button, Card, Field, Output } from './ui';
import { useWallet } from './WalletEntry';

export function WalletDashboard() {
  const { connection, message, tone, disconnect, preferDemo } = useWallet();
  const demo = isDemoKeychain(preferDemo);
  const account = connection?.account;
  const [snap, setSnap] = useState<WalletSnapshot | null>(null);
  const [snapError, setSnapError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activity, setActivity] = useState<ActivityItem[]>(() => (typeof sessionStorage === 'undefined' ? [] : loadActivity()));

  const refresh = useCallback(async () => {
    if (!account) return;
    setRefreshing(true);
    setSnapError('');
    try {
      setSnap(await readWalletSnapshot(account));
    } catch (error) {
      setSnapError((error as Error).message);
    }
    setRefreshing(false);
  }, [account]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const pending = activity.filter((item) => item.status === 'pending' && !item.simulated);
    if (!pending.length) return;
    const provider = createProvider();
    let cancelled = false;
    const tick = async () => {
      for (const item of pending) {
        const status = await readTxStatus(provider, item.hash);
        if (cancelled) return;
        if (status !== 'pending') setActivity(updateActivityStatus(item.hash, status));
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [activity]);

  if (!connection || !account) return null;

  function goExecute(calls: Parameters<typeof startKamuiExecute>[0], meta: Parameters<typeof startKamuiExecute>[1]) {
    window.location.assign(startKamuiExecute(calls, meta, preferDemo));
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(account!);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  const zeroBalance = snap !== null && snap.strk === 0n && snap.eth === 0n;

  return (
    <div className="dashboard">
      <header className="dashboard-hero" id="wallet">
        <p className="eyebrow">Your Kamui wallet</p>
        <h1>Signed in</h1>
        <p className="lede">
          {demo
            ? 'This is a simulated session from the in-app demo keychain — it is not registered on Sepolia, and sends will not land on chain.'
            : 'You signed in with Google on the Kamui keychain. This is your Starknet Sepolia account.'}
        </p>
        {message ? <p className={`wallet-status-msg ${tone}`}>{message}</p> : null}
      </header>

      <Card title="Account">
        <div className="account-line">
          <code className="account-addr">{account}</code>
          <div className="actions">
            <Button onClick={() => void copyAddress()}>{copied ? 'Copied' : 'Copy'}</Button>
            <a className="btn" href={voyagerContractUrl(account)} target="_blank" rel="noreferrer">
              Voyager
            </a>
            <a className="btn" href={starkscanContractUrl(account)} target="_blank" rel="noreferrer">
              Starkscan
            </a>
            <Button onClick={() => void refresh()} disabled={refreshing}>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button onClick={disconnect}>Disconnect</Button>
          </div>
        </div>
        <div className="balance-grid">
          <div className="balance-card">
            <span className="balance-label">Deployed</span>
            <strong className={snap?.deployed && !snap.demo ? 'ok' : ''}>
              {snap ? (snap.demo ? 'n/a (demo)' : snap.deployed ? 'Yes, on Sepolia' : 'Not yet') : '…'}
            </strong>
            {snap && !snap.demo && !snap.deployed ? (
              <p>The keychain deploys the account on first login. If this stays “not yet”, recovery may still be running there.</p>
            ) : null}
            {snap?.demo ? (
              <p>The in-app demo account is not a real Sepolia address, so nothing is read from the chain.</p>
            ) : null}
          </div>
          <div className="balance-card">
            <span className="balance-label">STRK</span>
            <strong>{snap ? (snap.demo ? 'n/a' : formatBalance(snap.strk)) : '…'}</strong>
          </div>
          <div className="balance-card">
            <span className="balance-label">ETH</span>
            <strong>{snap ? (snap.demo ? 'n/a' : formatBalance(snap.eth)) : '…'}</strong>
          </div>
        </div>
        {zeroBalance && !snap?.demo ? (
          <p className="faucet-note">
            Both balances are zero.{' '}
            <a href={FAUCET_URL} target="_blank" rel="noreferrer">
              Get Sepolia STRK from the Starknet faucet
            </a>{' '}
            so you can pay gas for a self-paid session call, or just use “Send with Kamui” — the keychain
            submits that transaction itself.
          </p>
        ) : null}
        {snapError ? <Output tone="bad">{snapError}</Output> : null}
      </Card>

      <SendPanel
        demo={demo}
        deployed={snap?.deployed === true}
        hasStrk={!!snap && snap.strk > 0n}
        connection={connection}
        onExecute={goExecute}
        onLocalTx={(item) => setActivity(recordActivity(item))}
      />

      <InteractPanel onExecute={goExecute} />

      <section className="dashboard-block" id="activity">
        <Card title="Activity this session">
          {activity.length === 0 ? (
            <p className="mute">No transactions yet in this tab. Sends and contract calls will show up here.</p>
          ) : (
            <ul className="activity-list">
              {activity.map((item) => (
                <li key={item.hash}>
                  <div>
                    <strong>{item.label}</strong>
                    <span className={`tx-status ${item.status}`}>{item.simulated ? 'simulated · ' : ''}{item.status}</span>
                  </div>
                  <code>
                    {item.simulated ? (
                      item.hash
                    ) : (
                      <>
                        <a href={voyagerTxUrl(item.hash)} target="_blank" rel="noreferrer">
                          {shortFelt(item.hash, 8, 6)}
                        </a>
                        {' · '}
                        <a href={starkscanTxUrl(item.hash)} target="_blank" rel="noreferrer">
                          Starkscan
                        </a>
                      </>
                    )}
                  </code>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}

function SendPanel({
  demo,
  deployed,
  hasStrk,
  connection,
  onExecute,
  onLocalTx,
}: {
  demo: boolean;
  deployed: boolean;
  hasStrk: boolean;
  connection: NonNullable<ReturnType<typeof useWallet>['connection']>;
  onExecute: (calls: Parameters<typeof startKamuiExecute>[0], meta: Parameters<typeof startKamuiExecute>[1]) => void;
  onLocalTx: (item: ActivityItem) => void;
}) {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [token, setToken] = useState<TokenSymbol>('STRK');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [localLog, setLocalLog] = useState('');

  function buildCall() {
    const to = parseFelt(recipient, 'recipient');
    const raw = parseHumanAmount(amount, TOKENS[token].decimals);
    if (raw === 0n) throw new Error('amount: must be greater than zero');
    return { call: transferCall(tokenAddress(token), to, raw), raw, to };
  }

  function sendViaKeychain() {
    setError('');
    try {
      const { call, raw } = buildCall();
      onExecute([call], {
        kind: 'transfer',
        label: `Send ${formatBalance(raw)} ${token}`,
      });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function sendSelfPaid() {
    setError('');
    setLocalLog('');
    setBusy(true);
    try {
      const { call, raw } = buildCall();
      const provider = createProvider();
      const sessionAccount = createSessionAccount({
        provider,
        address: connection.account,
        sessionPrivateKey: connection.session.privateKey,
        validUntil: connection.session.validUntil,
      });
      const result = await sessionAccount.execute([call]);
      const hash = result.transaction_hash;
      onLocalTx({
        hash,
        kind: 'transfer',
        label: `Send ${formatBalance(raw)} ${token} (self-paid)`,
        at: Date.now(),
        status: 'pending',
      });
      setLocalLog('Submitted ' + hash + ' — waiting for Sepolia…');
      const receipt = (await provider.waitForTransaction(hash)) as {
        execution_status?: string;
        finality_status?: string;
      };
      const status = classifyTxStatus(receipt);
      onLocalTx({
        hash,
        kind: 'transfer',
        label: `Send ${formatBalance(raw)} ${token} (self-paid)`,
        at: Date.now(),
        status,
      });
      setLocalLog(status === 'succeeded' ? 'Confirmed ' + hash : 'Finished with status ' + status + ': ' + hash);
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  const canSelfPay = !demo && deployed && hasStrk && SESSION_MAX_FEE_PER_TX > 0n;

  return (
    <section className="dashboard-block" id="send">
      <Card title="Send funds">
        <p>
          ERC-20 <code>transfer</code> of Sepolia STRK or ETH. The reliable path on this static site is a
          one-off execute: you approve the call in the Kamui keychain, and the keychain submits it.
          {LIVE_SPONSOR ? '' : ' Sponsored session calls are not live here — they need a server-side sponsor token.'}
        </p>
        <div className="wallet-form">
          <Field label="Recipient">
            <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="0x…" autoComplete="off" spellCheck={false} />
          </Field>
          <div className="wallet-form-row">
            <Field label="Amount">
              <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.5" inputMode="decimal" />
            </Field>
            <Field label="Token">
              <select value={token} onChange={(e) => setToken(e.target.value as TokenSymbol)}>
                <option value="STRK">STRK</option>
                <option value="ETH">ETH</option>
              </select>
            </Field>
          </div>
          <div className="actions">
            <Button variant="primary" onClick={sendViaKeychain}>
              Send with Kamui
            </Button>
            {canSelfPay ? (
              <Button onClick={() => void sendSelfPaid()} disabled={busy}>
                {busy ? 'Sending…' : 'Send, pay gas from my STRK'}
              </Button>
            ) : null}
          </div>
        </div>
        {canSelfPay ? (
          <p className="wallet-entry-note">
            “Pay gas from my STRK” uses the session key already in this tab (<code>createSessionAccount</code>
            , fee cap 0.01 STRK) and stays on this page. It needs a deployed account with STRK, and a
            session registered with that fee cap.
          </p>
        ) : (
          <p className="wallet-entry-note">
            Self-paid session sends need a deployed account with STRK and a session whose{' '}
            <code>maxFeePerTx</code> is above zero (requested at connect). Until then, use “Send with Kamui”.
          </p>
        )}
        {error ? <Output tone="bad">{error}</Output> : null}
        {localLog ? <Output tone="ok">{localLog}</Output> : null}
      </Card>
    </section>
  );
}

function InteractPanel({
  onExecute,
}: {
  onExecute: (calls: Parameters<typeof startKamuiExecute>[0], meta: Parameters<typeof startKamuiExecute>[1]) => void;
}) {
  const [spender, setSpender] = useState('');
  const [allowance, setAllowance] = useState('');
  const [approveToken, setApproveToken] = useState<TokenSymbol>('STRK');
  const [approveError, setApproveError] = useState('');

  const [callTo, setCallTo] = useState('');
  const [callEntry, setCallEntry] = useState('');
  const [callData, setCallData] = useState('');
  const [callError, setCallError] = useState('');

  const [readTo, setReadTo] = useState(TARGET);
  const [readEntry, setReadEntry] = useState('count');
  const [readData, setReadData] = useState('');
  const [readOut, setReadOut] = useState('');
  const [readTone, setReadTone] = useState<'ok' | 'bad' | undefined>();
  const [reading, setReading] = useState(false);

  function submitApprove() {
    setApproveError('');
    try {
      const who = parseFelt(spender, 'spender');
      const raw = parseHumanAmount(allowance);
      if (raw === 0n) throw new Error('amount: must be greater than zero');
      onExecute([approveCall(tokenAddress(approveToken), who, raw)], {
        kind: 'approve',
        label: `Approve ${formatBalance(raw)} ${approveToken}`,
      });
    } catch (err) {
      setApproveError((err as Error).message);
    }
  }

  function submitCustom() {
    setCallError('');
    try {
      const to = parseFelt(callTo, 'contract');
      const entrypoint = callEntry.trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(entrypoint)) throw new Error('entrypoint: must be a Cairo name');
      const calldata = parseCalldata(callData);
      onExecute([{ contractAddress: to, entrypoint, calldata }], {
        kind: 'custom',
        label: `${entrypoint}() on ${shortFelt(to)}`,
      });
    } catch (err) {
      setCallError((err as Error).message);
    }
  }

  async function submitRead() {
    setReading(true);
    setReadOut('');
    try {
      const to = parseFelt(readTo, 'contract');
      const entrypoint = readEntry.trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(entrypoint)) throw new Error('entrypoint: must be a Cairo name');
      const calldata = parseCalldata(readData);
      const result = await createProvider().callContract({ contractAddress: to, entrypoint, calldata });
      setReadTone('ok');
      setReadOut(result.join('\n') || '(empty result)');
    } catch (err) {
      setReadTone('bad');
      setReadOut((err as Error).message);
    }
    setReading(false);
  }

  return (
    <section className="dashboard-block" id="interact">
      <Card title="Interact with contracts">
        <p>
          Approvals and writes go through the same keychain execute path as a send. A session already
          covers <code>approve</code> on STRK and ETH, and <code>ping</code> on the demo Target. Any other
          contract uses the account’s full authority, so the keychain will ask you to confirm. Reads are
          free and stay on this page.
        </p>

        <h4>Approve a spender</h4>
        <div className="wallet-form">
          <Field label="Spender">
            <input value={spender} onChange={(e) => setSpender(e.target.value)} placeholder="0x…" autoComplete="off" spellCheck={false} />
          </Field>
          <div className="wallet-form-row">
            <Field label="Amount">
              <input value={allowance} onChange={(e) => setAllowance(e.target.value)} placeholder="1.5" inputMode="decimal" />
            </Field>
            <Field label="Token">
              <select value={approveToken} onChange={(e) => setApproveToken(e.target.value as TokenSymbol)}>
                <option value="STRK">STRK</option>
                <option value="ETH">ETH</option>
              </select>
            </Field>
          </div>
          <div className="actions">
            <Button variant="primary" onClick={submitApprove}>
              Approve with Kamui
            </Button>
          </div>
        </div>
        {approveError ? <Output tone="bad">{approveError}</Output> : null}

        <h4>Ping the demo contract</h4>
        <p>
          The Target contract at <code>{shortFelt(TARGET, 8, 6)}</code> is a public Sepolia playground (
          <code>ping()</code> increments <code>count()</code>).
        </p>
        <div className="actions">
          <Button
            onClick={() =>
              onExecute([pingCall()], { kind: 'ping', label: 'Ping the demo Target' })
            }
          >
            Ping with Kamui
          </Button>
        </div>

        <h4>Call any contract</h4>
        <div className="wallet-form">
          <Field label="Contract">
            <input value={callTo} onChange={(e) => setCallTo(e.target.value)} placeholder="0x…" autoComplete="off" spellCheck={false} />
          </Field>
          <Field label="Entrypoint">
            <input value={callEntry} onChange={(e) => setCallEntry(e.target.value)} placeholder="transfer" autoComplete="off" spellCheck={false} />
          </Field>
          <Field label="Calldata (felts, comma or space separated)">
            <input value={callData} onChange={(e) => setCallData(e.target.value)} placeholder="0x1 0x2" autoComplete="off" spellCheck={false} />
          </Field>
          <div className="actions">
            <Button onClick={submitCustom}>Execute with Kamui</Button>
          </div>
        </div>
        {callError ? <Output tone="bad">{callError}</Output> : null}

        <h4>Read-only call</h4>
        <p>Defaults to <code>count()</code> on the demo Target. Nothing is signed.</p>
        <div className="wallet-form">
          <Field label="Contract">
            <input value={readTo} onChange={(e) => setReadTo(e.target.value)} autoComplete="off" spellCheck={false} />
          </Field>
          <Field label="Entrypoint">
            <input value={readEntry} onChange={(e) => setReadEntry(e.target.value)} autoComplete="off" spellCheck={false} />
          </Field>
          <Field label="Calldata">
            <input value={readData} onChange={(e) => setReadData(e.target.value)} placeholder="(empty)" autoComplete="off" spellCheck={false} />
          </Field>
          <div className="actions">
            <Button onClick={() => void submitRead()} disabled={reading}>
              {reading ? 'Reading…' : 'Read'}
            </Button>
          </div>
        </div>
        {readOut ? <Output tone={readTone}>{readOut}</Output> : null}
      </Card>
    </section>
  );
}
