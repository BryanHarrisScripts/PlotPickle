import type {LibraryPPFProject} from "../../core/storage/library-project";
export type AfterglowSelectionSet = Readonly<{
 decisions:Readonly<Record<string,number|"baseline">>;
 exclusions:readonly string[];
 confirmedCurrent:Readonly<Record<string,boolean>>;
 imageChoices:Readonly<Record<string,"keep"|"exclude">>;
}>;
export type AfterglowExpectedSource = Readonly<{key:string;digest:string}>;
export function shaAfterglowSnapshot(value:unknown):string;
export function prepareVerifiedAfterglowMaster(input:Readonly<{
 baseline:LibraryPPFProject;
 sources:readonly Readonly<{project:LibraryPPFProject;sourceKey?:string;savedAt?:string;sourceKind?:string}>[];
 fields:readonly Readonly<{canonicalId:string;prompt:string;scope:string;validActs:readonly number[]}>[];
 questions:Readonly<Record<string,string>>;
 manifest:Readonly<{assets:readonly Readonly<{target:string;publicUrl:string;contentHash:string}>[]}>;
 selections:AfterglowSelectionSet;
 expectedSources:readonly AfterglowExpectedSource[];
 masterId?:string;now?:string;
}>):Readonly<{
 candidate:LibraryPPFProject;
 progress:Readonly<{completed:number;total:number;pending:number;allCreativeDecided:boolean}>;
 sourceProofs:readonly AfterglowExpectedSource[];
 sourceCount:number;includedHistorical:number;readyForIndependentMedia:true;
}>;
