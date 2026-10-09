import {createHash} from "node:crypto";
import {lstat,readFile,realpath} from "node:fs/promises";
import path from "node:path";
import {projectImageAssetFilePath,assetsDirectory} from "../../build/media-storage-common";
import { normalizeLibraryProject,type LibraryPPFProject } from "../../core/storage/library-project";
import type {ProfilePrivateStorageService,ProfileProjectSummary} from "../../core/storage/profile-private/profile-private-storage";
import type {AuthContext} from "../../core/auth/plotpickle-auth";
import {plotPickleCurriculum} from "../../adapters/curriculum/current-catalog";
import {buildStoryDevelopmentFields} from "../learn/model/story-development-fields";
import {createAfterglowPackagedCurrentReference} from "./reference/afterglow-packaged-current";
import manifest from "../../data/afterglow-packaged-current/manifest.json";
import {collectAfterglowReviewSources} from "./afterglow-review-sources.mjs";
import {prepareVerifiedAfterglowMaster,shaAfterglowSnapshot} from "./afterglow-master-authority.mjs";

type StoredSource = {project:LibraryPPFProject;sourceKey?:string;savedAt?:string;sourceKind?:string};
type Choices = {decisions:Record<string,number|"baseline">;exclusions:string[];
  confirmedCurrent:Record<string,boolean>;imageChoices:Record<string,"keep"|"exclude">};
type SourceProof = {key:string;digest:string};
const SHA=/^sha256:[a-f0-9]{64}$/;
const LOCAL=/^\/api\/local-ai\/assets\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:webp|png|jpe?g)$/i;
const PACKAGE=/^\/assets\/library\/examples\/(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)*[A-Za-z0-9][A-Za-z0-9._-]*\.(?:webp|png|jpe?g)$/i;
const MAX_IMAGE=24*1024*1024;
function questionsAndFields(){
  const fields=buildStoryDevelopmentFields(plotPickleCurriculum);
  const questions:Record<string,string>={};
  for(const field of fields){
    questions[field.canonicalId]=field.prompt;
    if(field.scope!=="project-wide")for(const act of field.validActs)
      questions[field.canonicalId+"::act-"+act]=field.prompt;
  }
  return {fields,questions};
}
function sourceDetails(source:{project:unknown;sourceKey?:string;savedAt?:string;sourceKind?:string}) {
  return {...source,project:normalizeLibraryProject(source.project)};
}
export async function readServerAfterglowSources(
  storage:ProfilePrivateStorageService,context:AuthContext,
){
  const summary=await storage.listProjects(context);
  const afterglow=summary.filter(x=>x.sourceKind==="example"&&x.sourceId==="afterglow-v9");
  const cache=await storage.readPrivateJson(context,{domain:"cache",objectId:"library-recovery-points"});
  if(cache!==null&&!Array.isArray(cache))throw new Error("Afterglow recovery-point cache is invalid.");
  const points=(Array.isArray(cache)?cache:[]).flatMap(value=>{
    if(!value||typeof value!=="object"||Array.isArray(value))return [];
    const row=value as Record<string,unknown>,project=row.project as LibraryPPFProject|undefined;
    if(project?.sourceEvidence?.referenceFixture?.sourceId!=="afterglow-v9-complete-baseline")return [];
    if(typeof row.id!=="string"||!row.id||row.projectId!==project.id||
      typeof row.createdAt!=="string")throw new Error("Historical Afterglow recovery point has invalid identity.");
    return [{id:row.id,projectId:row.projectId,createdAt:row.createdAt,project}];
  });
  const snapshots=new Map<string,LibraryPPFProject>();
  for(const s of afterglow){
    const p=await storage.loadProject(context,s.projectId);
    if(!p)throw new Error("A saved Afterglow Library copy is missing.");
    snapshots.set(s.projectId,normalizeLibraryProject(p));
  }
  const active=afterglow.filter(s=>!s.archivedAt).map(s=>({id:s.projectId,updatedAt:s.updatedAt}));
  const archived=afterglow.filter(s=>Boolean(s.archivedAt)).map(s=>({id:s.projectId,updatedAt:s.updatedAt}));
  const collected=collectAfterglowReviewSources({
    active,archived,recoveryPoints:points,
    load:(id:string)=>snapshots.get(id)??null,
  });
  if(collected.warnings.length)throw new Error("Some Afterglow recovery sources could not be inspected.");
  return {sources:collected.sources as StoredSource[],summaries:afterglow};
}

/** Must recalculate every selected byte on the server, never trust browser digest. */
export async function verifyServerAfterglowMedia(candidate:LibraryPPFProject) {
  const urls=new Set<string>();
  const visit=(v:unknown)=>{
    if(typeof v==="string" && (v.startsWith("/api/local-ai/assets/")||
      v.startsWith("/assets/library/examples/")))urls.add(v);
    else if(Array.isArray(v))v.forEach(visit);
    else if(v && typeof v==="object")Object.values(v).forEach(visit);
  };
  visit(candidate);
  const results:{url:string;contentHash:string;bytes:number;escrow:boolean}[]=[];
  for(const url of [...urls].sort()){
    if(!LOCAL.test(url)&&!PACKAGE.test(url))throw new Error("A selected image has an unsupported or unsafe path.");
    const file=projectImageAssetFilePath(url);
    const root=LOCAL.test(url)?assetsDirectory():
      path.resolve(process.cwd(),"public","assets","library","examples");
    const disk=await realpath(file);
    const realRoot=await realpath(root);
    const relative=path.relative(realRoot,disk);
    if(!relative||relative===".."||relative.startsWith(".."+path.sep)||path.isAbsolute(relative)||
      (await lstat(file)).isSymbolicLink()){
      throw new Error("Selected image is not a regular local PlotPickle asset.");
    }
    const bytes=await readFile(file);
    if(bytes.length<16||bytes.length>MAX_IMAGE)
      throw new Error("Selected image bytes are missing, oversized or invalid.");
    const ext=url.split(".").at(-1)?.toLowerCase();
    const webp=bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP";
    const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpeg=bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217;
    if(!(ext==="webp"?webp:ext==="png"?png:jpeg))
      throw new Error("Selected image file is not a valid image signature.");
    const contentHash="sha256:"+createHash("sha256").update(bytes).digest("hex");
    if(PACKAGE.test(url)){
      const matches=manifest.assets.filter(x=>x.publicUrl===url);
      if(matches.length!==1||matches[0].contentHash.toLowerCase()!==contentHash){
        throw new Error("Selected packaged image differs from the published SHA-256 manifest.");
      }
    }
    if(!SHA.test(contentHash))throw new Error("Image hash could not be independently calculated.");
    results.push({url,contentHash,bytes:bytes.length,escrow:LOCAL.test(url)});
  }
  return results;
}

export async function prepareServerAfterglowMaster(input:{
  sources:readonly StoredSource[];selections:Choices;expectedSources:readonly SourceProof[];
  masterId?:string;now?:string;
}) {
  const {fields,questions}=questionsAndFields();
  return prepareVerifiedAfterglowMaster({
    baseline:createAfterglowPackagedCurrentReference(),sources:input.sources,
    fields,questions,manifest,selections:input.selections,
    expectedSources:input.expectedSources,masterId:input.masterId,now:input.now,
  }) as {candidate:LibraryPPFProject;progress:{pending:number;completed:number;total:number};
    sourceCount:number;includedHistorical:number;sourceProofs:SourceProof[]};
}

export async function authorizeServerAfterglowMasterCommit(input:{
  candidate:unknown;
  originals:readonly {summary:ProfileProjectSummary;project:unknown}[];
  historical:readonly StoredSource[];
  selections:Choices;
  expectedSources:readonly SourceProof[];
}) {
  const sources:StoredSource[]=[
    ...input.originals.map(x=>sourceDetails({project:x.project})),
    ...input.historical.map(sourceDetails),
  ];
  // The runtime constructs the master with fresh metadata. Only durable roots
  // are compared against an independently recomputed merge of saved sources.
  const proposed=normalizeLibraryProject(input.candidate);
  const checked=await prepareServerAfterglowMaster({
    sources,selections:input.selections,expectedSources:input.expectedSources,
    masterId:proposed.id,now:proposed.createdAt,
  });
  if(JSON.stringify(normalizeLibraryProject(checked.candidate))!==JSON.stringify(proposed)) {
    throw new Error("The proposed master differs from the independently recomputed Human choices.");
  }
  const mediaPins=await verifyServerAfterglowMedia(proposed);
  return {authorized:true,mediaPins};
}
