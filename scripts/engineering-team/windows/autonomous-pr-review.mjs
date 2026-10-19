#!/usr/bin/env node
/**
 * #3110 autonomous PR gate. Only pure documentation candidates can reach the
 * merge path, after independently SUCCESSFUL exact-head architecture/required
 * GitHub checks. Product-code changes cannot bypass a missing Windows gate.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import process from "node:process";

const exec=promisify(execFile);
const REPO="BryanHarrisScripts/PlotPickle";
const SHA=/^[a-f0-9]{40}$/;
const LAYERS=[1,2,3,4,5,6,7];
const BOLD_DOC=/^(?:docs\/[A-Za-z0-9_./-]+\.md|README\.md)$/i;

export function reviewDocsOnlyCandidate(pr,required,allowedIssues,exactBase){
  const deny=(code)=>Object.freeze({eligible:false,code});
  const match=/^factory\/issue-(\d+)-[a-f0-9]{10}$/.exec(pr?.headRefName||"");
  if(!match)return deny("NOT_FACTORY_PR");
  const issue=Number(match[1]);
  if(!allowedIssues.includes(issue)||pr.state!=="OPEN"||pr.baseRefName!=="main"
    ||pr.author?.login!=="BryanHarrisScripts" ||pr.title!==`factory: issue #${issue} candidate`)
    return deny("UNAPPROVED_PR");
  if(!SHA.test(pr.headRefOid||"")||!SHA.test(pr.baseRefOid||"")||pr.baseRefOid!==exactBase)
    return deny("STALE_BASE_OR_HEAD");
  if(!Array.isArray(pr.files)||!pr.files.length||pr.files.length>80
    ||!pr.files.every(x=>BOLD_DOC.test(x.path||"")))
    return deny("PRODUCT_GATE_REQUIRED");
  if(pr.mergeStateStatus!=="CLEAN")return deny("MERGE_STATE_NOT_CLEAN");
  const rollup=pr.statusCheckRollup;
  if(!Array.isArray(rollup)||!rollup.length)return deny("MISSING_INDEPENDENT_CI");
  for(const layer of LAYERS){
    const matches=rollup.filter(x=>new RegExp(`^Layer ${layer}\\b`).test(x.name||""));
    if(!matches.length||!matches.every(x=>x.conclusion==="SUCCESS"&&x.status==="COMPLETED"))
      return deny("SEVEN_LAYER_ARCHITECTURE_NOT_GREEN");
  }
  if(rollup.some(x=>x.conclusion==="FAILURE"||x.conclusion==="CANCELLED"||
    (x.status!=="COMPLETED"&&x.status!=="SUCCESS")))
    return deny("OTHER_CHECK_PENDING_OR_FAILED");
  if(!Array.isArray(required)||!required.length||
    !required.every(x=>x.bucket==="pass"&&x.state==="SUCCESS"))
    return deny("REQUIRED_CHECKS_NOT_PROVEN");
  return Object.freeze({eligible:true,code:"DOCS_ONLY_EXACT_HEAD_GREEN",issueNumber:issue,
    head:pr.headRefOid,number:pr.number});
}

async function gh(args,{repoRoot=process.cwd(),run=exec}={}){
 const r=await run("gh",args,{cwd:repoRoot,encoding:"utf8",timeout:45_000,
   windowsHide:true,maxBuffer:512_000});
 return String(r.stdout||"").trim();
}

export async function reconcileApprovedDocsPRs({issueNumbers,exactBase,
  repoRoot=process.cwd(),run=exec,send=gh}={}){
 if(!Array.isArray(issueNumbers)||!SHA.test(exactBase||""))
   throw Error("Exact reviewed queue policy/base required.");
 const call=async args=>send(args,{repoRoot,run});
 const open=JSON.parse(await call(["pr","list","--repo",REPO,"--state","open",
   "--limit","50","--json","number,headRefName"]));
 if(!Array.isArray(open))throw Error("GitHub candidate list malformed.");
 for(const entry of open){
   if(!/^factory\/issue-\d+-[a-f0-9]{10}$/.test(entry.headRefName||""))continue;
   const pr=JSON.parse(await call(["pr","view",String(entry.number),"--repo",REPO,"--json",
     "number,title,headRefName,headRefOid,baseRefName,baseRefOid,author,files,mergeStateStatus,statusCheckRollup,state,isDraft"]));
   // Even an error running required checks must be WAITING, never green.
   let required;
   try{
     required=JSON.parse(await call(["pr","checks",String(entry.number),"--repo",REPO,
       "--required","--json","name,state,bucket"]));
   }catch{continue;}
   const admission=reviewDocsOnlyCandidate(pr,required,issueNumbers,exactBase);
   if(!admission.eligible)continue;
   // The local operator separately opted into docs-only merges. These are
   // reviewed deterministic SHA-bound GitHub checks, not model approval.
   if(pr.isDraft)await call(["pr","ready",String(pr.number),"--repo",REPO]);
   await call(["pr","merge",String(pr.number),"--repo",REPO,
     "--squash","--match-head-commit",admission.head]);
   const after=JSON.parse(await call(["pr","view",String(pr.number),"--repo",REPO,
     "--json","state,mergedAt,mergeCommit"]));
   if(after.state!=="MERGED"||!after.mergedAt||!SHA.test(after.mergeCommit?.oid||""))
     throw Error("GitHub did not confirm exact candidate merge.");
   return Object.freeze({state:"MERGED",issueNumber:admission.issueNumber,
     mergeSha:after.mergeCommit.oid,prNumber:pr.number});
 }
 return Object.freeze({state:"WAITING_FOR_PR_VERIFICATION",processed:0});
}
