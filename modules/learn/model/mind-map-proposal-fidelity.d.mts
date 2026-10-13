export interface MindMapFidelityInput {
  readonly topicId: string;
  readonly currentValue: string;
  readonly proposal: string;
  readonly fieldPrompt?: string;
}
export interface MindMapFidelityResult {
  readonly ok: boolean;
  readonly issues: readonly string[];
}
export function assessMindMapProposalFidelity(input: MindMapFidelityInput): MindMapFidelityResult;
export function requestMindMapFidelityProposal(input: {
  readonly topicId: string;
  readonly currentValue: string;
  readonly fieldPrompt: string;
  readonly ask: (feedback: string) => Promise<string>;
}): Promise<
  | { readonly ok: true; readonly proposal: string; readonly attempts: number; readonly issues: readonly [] }
  | { readonly ok: false; readonly proposal: string; readonly attempts: number; readonly issues: readonly string[] }
>;
