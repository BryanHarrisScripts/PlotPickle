import type { LibraryPPFProject } from "../../../core/storage/library-project";
export type WorldEnvironmentSource = Readonly<{
  id:string;label:string;text:string;kind:"screenplay-location"|"world-brief";
}>;
export function worldEnvironmentSources(project:LibraryPPFProject): WorldEnvironmentSource[];
