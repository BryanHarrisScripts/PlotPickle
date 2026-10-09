import type { LibraryPPFProject } from "../../core/storage/library-project";

export type AfterglowMediaEvidence = Readonly<{
  url: string;
  kind: "local" | "packaged" | "bundled" | "unsupported";
  selected: boolean;
  sourceProjectIds: string[];
  status: "unsupported" | "missing" | "corrupt" | "hash-mismatch" | "unverifiable"
    | "unreadable" | "verified-pinned" | "verified-current" | "readable-unpinned";
  reason: string;
  contentHash: string | null;
  evidenceAuthority?: "packaged-manifest" | "current-local-index" | "none";
}>;
export type AfterglowMediaVerification = Readonly<{
  results: AfterglowMediaEvidence[];
  selectedCount: number;
  historyCount: number;
  verifiedPinned: number;
  readableWithoutSavedProof: number;
  failed: number;
  readyForHumanCommit: false;
  packageModified: false;
}>;
export declare function inventoryAfterglowMedia(input: {
  readonly candidate: LibraryPPFProject;
  readonly sources: ReadonlyArray<Readonly<{project: LibraryPPFProject}>>;
}): ReadonlyArray<Readonly<{
  url:string;
  kind:"local"|"packaged"|"bundled"|"unsupported";
  selected:boolean;
  sourceProjectIds:string[];
}>>;
export declare function verifyAfterglowMedia(input: {
  readonly candidate: LibraryPPFProject;
  readonly sources: ReadonlyArray<Readonly<{project: LibraryPPFProject}>>;
  readonly packagedManifest: {readonly assets?:readonly {publicUrl:string;contentHash:string}[]};
  readonly localAssetIndex: {readonly assets?:readonly {url:string;contentHash:string}[]};
  readonly read: (url:string,maxBytes:number)=>Promise<{ok:boolean;bytes?:Uint8Array}>;
  readonly hash: (bytes:Uint8Array)=>Promise<string>;
  readonly decode: (bytes:Uint8Array,url:string)=>Promise<void>;
  readonly beforeRead: ()=>void | Promise<void>;
}): Promise<AfterglowMediaVerification>;