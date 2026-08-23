import type { PPFProject } from "../project/project";

export class RevisionConflictError extends Error {
  constructor(
    readonly projectId: string,
    readonly expectedRevision: number,
    readonly actualRevision: number,
  ) {
    super(
      `Cannot save project ${projectId}: expected revision ${expectedRevision}, current revision is ${actualRevision}.`,
    );
    this.name = "RevisionConflictError";
  }
}

export interface ProjectStore {
  load(projectId: string): Promise<PPFProject | null>;
  save(project: PPFProject, expectedRevision: number): Promise<void>;
}
