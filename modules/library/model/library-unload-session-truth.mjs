// #2960 / WHITE-PAPER-V3 W8-W9 / PP-SAVE-001 T6-T8.
// An interrupted Unload is never consent to drop the story or auto-retry a mutation.
export function libraryUnloadRequiresSessionRecovery(error) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /authenticat|session|sign[ -]?in|log[ -]?in|unlock|csrf|expired|\b401\b|\b403\b|token|profile is locked|human profile is locked/i.test(message);
}

export function assertLibraryUnloadRetryIdentity(expectedProfileId, expectedProjectId, currentProfileId, currentProjectId) {
  if (!expectedProfileId || !expectedProjectId ||
      expectedProfileId !== currentProfileId || expectedProjectId !== currentProjectId) {
    throw new Error("The working profile or story changed during Unload recovery. Keep the current work and select Unload again from the active story.");
  }
  return true;
}
