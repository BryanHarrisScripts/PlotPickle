import type {LibraryPPFProject} from "../../../core/storage/library-project";
import type {AfterglowDecisionPreview} from '../afterglow-consolidation.mjs';
export class AfterglowSaveVerificationError extends Error {}
export function reconcileAfterglowTechnicalRecords(input: {baseline: LibraryPPFProject;sources: readonly {project: LibraryPPFProject}[];reviewed: AfterglowDecisionPreview}): AfterglowDecisionPreview & {technicalBlockers: string[]};
