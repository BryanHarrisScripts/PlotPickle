export function libraryUnloadRequiresSessionRecovery(error: unknown): boolean;
export function assertLibraryUnloadRetryIdentity(
  expectedProfileId: string, expectedProjectId: string,
  currentProfileId: string, currentProjectId: string | null
): true;
