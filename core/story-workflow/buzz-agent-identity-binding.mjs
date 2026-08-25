const NOSTR_PUBLIC_KEY = /^[a-f0-9]{64}$/i;

function normalizedPubkey(value) {
  const pubkey = typeof value === "string" ? value.trim().toLowerCase() : "";
  return NOSTR_PUBLIC_KEY.test(pubkey) ? pubkey : "";
}

/**
 * Normalize machine-local BUZZ Agent public identities before they are exposed
 * to the Story Bridge. Invalid or ambiguous values are dropped fail-closed.
 */
export function normalizeBuzzAgentIdentityBindings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const normalized = {};
  for (const [profileId, candidate] of Object.entries(value)) {
    const pubkey = normalizedPubkey(candidate);
    if (profileId && pubkey) normalized[profileId] = pubkey;
  }
  return Object.freeze(normalized);
}

/**
 * Resolve the signer PlotPickle should accept for one Agent Profile. A checked-
 * in identity remains authoritative when present. A machine-local identity may
 * fill an intentionally-null registry slot, but it may never silently override
 * a configured signer.
 */
export function resolveBuzzAgentIdentityBinding({
  profileId,
  configuredPubkey = "",
  localBindings = {},
}) {
  const configured = normalizedPubkey(configuredPubkey);
  const local = normalizedPubkey(localBindings?.[profileId]);
  if (configured && local && configured !== local) {
    throw new Error(`Local BUZZ signer for Agent Profile ${profileId} does not match the configured official signer.`);
  }
  return configured || local;
}
