export const PLOTPICKLE_QA_ACCESS = {
  enabled: true,
  scope: "progression-navigation-and-workspace",
} as const;

/**
 * QA access opens implemented UI that would normally be hidden behind guided
 * progression. It never changes the canonical progression state itself.
 */
export function hasQaWorkspaceAccess(canonicalAccess: boolean) {
  return canonicalAccess || PLOTPICKLE_QA_ACCESS.enabled;
}

/** True only when the UI is open because of the QA override. */
export function isQaAccessOverride(canonicalAccess: boolean) {
  return PLOTPICKLE_QA_ACCESS.enabled && !canonicalAccess;
}
