import type {LibraryPPFProject} from "../../../core/storage/library-project";
import type {AfterglowDecisionPreview} from '../afterglow-consolidation.mjs';
export class AfterglowSaveVerificationError extends Error {}
export function afterglowCollidingMediaUrls(input: {baseline:LibraryPPFProject;sources:readonly {project:LibraryPPFProject}[]}):string[];
export function reconcileAfterglowTechnicalRecords(input: {baseline: LibraryPPFProject;sources: readonly {project: LibraryPPFProject}[];reviewed: AfterglowDecisionPreview;verifiedMediaHashes?:Readonly<Record<string,string>>}): AfterglowDecisionPreview & {technicalBlockers: string[]};
