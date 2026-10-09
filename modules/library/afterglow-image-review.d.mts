import type { LibraryPPFProject } from "../../core/storage/library-project";
import type { WorldMapCharacterVisualPackage, WorldMapCharacterVisualReference }
  from "../../core/contracts/world-map";

export type AfterglowImageChoice = Readonly<{
  key: string;
  characterId: string;
  characterName: string;
  id: string;
  view: string;
  versionId: string;
  url: string;
  reference: WorldMapCharacterVisualReference;
  sourcePackage: WorldMapCharacterVisualPackage;
  sourceIds: string[];
  packagedPublicUrl: string | null;
  githubUrl: string | null;
  packagedContentHash: string | null;
  conflictingSourceMetadata: boolean;
}>;

export function afterglowImageKey(characterId:string,id:string,url:string):string;
export function listAfterglowImageChoices(input:Readonly<{
  sources: readonly Readonly<{project:LibraryPPFProject;sourceKey?:string}>[];
  manifest: Readonly<{assets: readonly Readonly<{
    target:string;publicUrl:string;contentHash:string;
  }>[] }>;
}>): AfterglowImageChoice[];

export function applyAfterglowImageChoices(input:Readonly<{
  candidate:LibraryPPFProject;
  items:readonly AfterglowImageChoice[];
  choices:Readonly<Record<string,"keep"|"exclude">>;
}>): Readonly<{
  candidate:LibraryPPFProject;
  clearedLocks:ReadonlyArray<Readonly<{characterId:string;versionId:string}>>;
  reviewedCount:number;
  readyForHumanCommit:false;
  packageModified:false;
}>;
export function imageIncludedInCandidate(
  project:LibraryPPFProject,item:AfterglowImageChoice,
):boolean;
