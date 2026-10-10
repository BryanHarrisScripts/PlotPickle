import type {LibraryPPFProject} from "../../../core/storage/library-project";
import type {AfterglowDecisionPreview} from '../afterglow-consolidation.mjs';
export function reconcileAfterglowTechnicalRecords(input: {baseline: LibraryPPFProject;sources: readonly {project: LibraryPPFProject}[];reviewed: AfterglowDecisionPreview}): AfterglowDecisionPreview & {technicalBlockers: string[]};
