import { DEFAULT_KEYCHAIN_URL, isDemoKeychain } from '../lib/config';
import { useWallet } from './WalletEntry';

/** Fallback only: the in-app demo keychain, tucked under How it works. */
export function DemoKeychainToggle() {
  const { preferDemo, setPreferDemo } = useWallet();
  const demo = isDemoKeychain(preferDemo);
  return (
    <label className="wallet-demo-toggle">
      <input type="checkbox" checked={preferDemo} onChange={(e) => setPreferDemo(e.target.checked)} />
      Use the in-app demo keychain
      {demo
        ? ' (on — simulated approval, no Google, no on-chain session)'
        : ` (off — Sign in goes to ${DEFAULT_KEYCHAIN_URL})`}
    </label>
  );
}
