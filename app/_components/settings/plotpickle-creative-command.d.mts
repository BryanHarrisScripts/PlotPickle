import type { LibraryPPFProject } from "../../../core/storage/library-project";
export type PlotPickleCreativeCommand = Readonly<
  { action: "tools" | "status" }
  | { action: "open"; title: string }
  | { action: "plan"; blockNumber: number }
  | { action: "invalid"; reason: string }
>;
export function parsePlotPickleCreativeCommand(input: string): PlotPickleCreativeCommand | null;
export function describePlotPickleCreativeCommand(command: PlotPickleCreativeCommand | null, options?: {
  project?: LibraryPPFProject | null;
  activeProjectId?: string;
  currentAssessment?: boolean;
}): string | null;

export function executePlotPickleLibraryOpen(command: PlotPickleCreativeCommand | null, services: {
  listProjects(): readonly { id: string; title: string }[];
  activeProjectId(): string | null;
  readSnapshot(id: string): LibraryPPFProject | null;
  switchProject(id: string): LibraryPPFProject;
  persistProject(): Promise<unknown>;
  flushWrites(): Promise<unknown>;
  loadActiveProject(): LibraryPPFProject;
  currentAssessment(project: LibraryPPFProject, blockNumber: number): boolean;
}): Promise<string | null>;
