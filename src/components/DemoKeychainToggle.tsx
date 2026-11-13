import { DEFAULT_KEYCHAIN_URL, isDemoKeychain } from '../lib/config';
import { useWallet } from './WalletEntry';

/** Fallback only: the in-app demo keychain, tucked under How it works. */
export function DemoKeychainToggle() {
  const { preferDemo, setPreferDemo, connection } = useWallet();
  const demo = isDemoKeychain(preferDemo);
  const locked = Boolean(connection);
  return (
    <label className={`wallet-demo-toggle${locked ? ' locked' : ''}`}>
      <input
        type="checkbox"
        checked={preferDemo}
        disabled={locked}
        onChange={(e) => setPreferDemo(e.target.checked)}
      />
      Use the in-app demo keychain
      {demo
        ? ' (on — simulated approval, no Google, no on-chain session)'
        : ` (off — Sign in goes to ${DEFAULT_KEYCHAIN_URL})`}
      {locked ? ' — disconnect first to switch.' : ''}
    </label>
  );
}
