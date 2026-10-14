import type { LibraryPPFProject } from "../../../core/storage/library-project";
export type PlotPickleCreativeCommand = Readonly<
  { action: "tools" | "status" }
  | { action: "plan"; blockNumber: number }
  | { action: "invalid"; reason: string }
>;
export function parsePlotPickleCreativeCommand(input: string): PlotPickleCreativeCommand | null;
export function describePlotPickleCreativeCommand(command: PlotPickleCreativeCommand | null, options?: {
  project?: LibraryPPFProject | null;
  activeProjectId?: string;
  currentAssessment?: boolean;
}): string | null;
