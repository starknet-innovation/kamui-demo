/** SNIP-9 "any caller" marker: the short string 'ANY_CALLER'. */
export const ANY_CALLER = '0x414e595f43414c4c4552';

/** SRC-5 interface ids a Kamui account registers. */
export const SRC6_ID = '0x2ceccef7f994940b3962a6c67e0ba4fcd37df7d131417c604f91e03caecc1cd';
export const SRC9_V2_ID = '0x1d1144bb2138366ff28d8e9ab57456b1d332ac42196230c3a602003c89872';
export const SESSION_KEY_INTERFACE_ID = '0x9da822b09dda470480ed02c12ae8745d4ac010023df23c6db0314abe5cdc02';

/** Limits enforced by the contracts. */
export const MAX_OWNERS = 5;
export const MAX_SESSION_SCOPE_ENTRIES = 64;

/**
 * Entry points a session can never call, on any contract. Mirrors `is_blocked_selector` in
 * `contracts/src/session/interface.cairo`; a test keeps the two lists in step.
 */
export const BLOCKED_ENTRYPOINTS = [
  'upgrade',
  'add_or_update_session_key',
  'revoke_session_key',
  '__execute__',
  'set_public_key',
  'setPublicKey',
  'execute_from_outside_v2',
  'set_spending_policy',
  'remove_spending_policy',
  'add_or_update_scoped_session_key',
  'revoke_all_sessions',
  'add_owner',
  'remove_owner',
  '__validate__',
  '__validate_declare__',
  '__validate_deploy__',
  'recover',
  'prove_jwt',
  'finalize_override_recovery',
  'cancel_override_recovery',
] as const;

/** Token entry points a spending policy counts (SNIP-41 Part H). */
export const SPENDING_ENTRYPOINTS = ['transfer', 'approve', 'increase_allowance', 'increaseAllowance'] as const;
