export type LibraryPpfReport = ReturnType<typeof summarizeLibraryPpfReport>;
export function resolveActiveLibraryReportsProject<T extends { readonly id: string }>(input: {
  readonly activeProjectId: string | null;
  readonly loadSnapshot: (id: string) => T | null;
}): T | null;
export function summarizeLibraryPpfReport(project: import("../../../core/storage/library-project").LibraryPPFProject): {
  readonly id: string;
  readonly title: string;
  readonly revision: number;
  readonly updatedAt: string | null;
  readonly imported: null | {
    readonly name: string; readonly format: string; readonly reportedPassages: number; readonly retainedPassages: number; readonly truncated: boolean;
  };
  readonly structure: { readonly blocks: number; readonly miniBlocks: number; readonly acts: number; readonly planAccepted: number; readonly storyboardAccepted: number; readonly authoredBlocks: number };
  readonly writing: { readonly miniBlocksWithText: number };
  readonly importedEvidence: { readonly retainedPassages: number; readonly knownSceneReferences: number; readonly dialoguePassages: number; readonly incomplete: boolean };
  readonly characters: { readonly approvedReferenceClaims: number; readonly countAvailable: false };
  readonly development: { readonly acceptedFields: number; readonly unacceptedProposals: number };
  readonly unavailable: { readonly runtime: string; readonly scenes: string; readonly characters: string; readonly dialogue: string; readonly production: string; readonly feedback: string; readonly connections: string };
};
