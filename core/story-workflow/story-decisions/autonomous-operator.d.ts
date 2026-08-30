import type { StoryDecisionRecord } from "./core.mjs";

export type AutonomousStoryDecisionStatus = "applied" | "completed-no-change" | "blocked";

export declare function operateAutonomousStoryDecision(
  input: Readonly<Record<string, any>> & { readonly decision: StoryDecisionRecord },
  ports: Readonly<{
    evaluateDecision(input: Readonly<Record<string, unknown>>): Promise<Readonly<Record<string, unknown>>>;
    respondThroughDecisionGateway(input: Readonly<Record<string, unknown>>): Promise<Readonly<Record<string, any>>>;
    prepareStoryWorkbench(input: Readonly<Record<string, unknown>>): Promise<Readonly<Record<string, any>>>;
    applyStoryWorkbench(input: Readonly<Record<string, unknown>>): Promise<Readonly<Record<string, any>>>;
  }>,
): Promise<Readonly<Record<string, any>> & { readonly status: AutonomousStoryDecisionStatus }>;
