import { FEATURES } from '../lib/features';
import { Callout, Card, Section } from '../components/ui';

const feature = FEATURES.find((f) => f.id === 'self-paid')!;

export function SelfPaid() {
  return (
    <Section feature={feature}>
      <Callout>
        A session that pays its own fees uses <code>createSessionAccount(provider, connection.account,
        session)</code> and then <code>execute</code> as with any starknet.js account. It needs{' '}
        <code>maxFeePerTx</code> above zero. Sponsored-only sessions set the cap to 0.
      </Callout>
      <div className="grid two">
        <Card title="Fee estimation">
          <p>
            <code>SessionAccount</code> always estimates with validation on. The default starknet.js estimate
            runs <em>without</em> the session signature, misses the session and spending checks, and comes out
            too low: a transaction ran out of gas that way on Sepolia. If you build session transactions
            without <code>SessionAccount</code>, pass <code>skipValidate: false</code> yourself.
          </p>
        </Card>
        <Card title="How maxCalls is counted">
          <p>
            <code>maxCalls</code> is counted <em>per path</em>: a session may send up to that many sponsored
            transactions and the same number of self-paid ones. On the self-paid path the usable nonce range
            also shrinks when other keys send transactions.
          </p>
          <p>
            A live self-paid call needs a session with a fee cap, an account funded with STRK, and a signer
            that stays in the app — the same session key from <code>beginConnect</code>. This demo does not
            ship a funded account.
          </p>
        </Card>
      </div>
    </Section>
  );
}
