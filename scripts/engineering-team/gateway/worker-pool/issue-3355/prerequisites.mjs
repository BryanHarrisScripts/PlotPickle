/**
 * #3355 admission: distinguish the Human-merged #3387 PR from the absent
 * Factory publication receipt for the consumed #3110 Worker 1 order.
 * This is a read-only prerequisite, never a reconstructed receipt or replay.
 */
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {lstat,readFile,readdir} from 'node:fs/promises';
import path from 'node:path';

const exec=promisify(execFile);
const SHA=/^[a-f0-9]{40}$/;
const ID=/^[a-f0-9]{32}$/;
const MANUAL_REQUEST='51b3b25f3569f524e5fb6f9d9989e7ec';
const MANUAL_PR=3387;

async function record(root,folder,name){
  const dir=path.join(root,folder);
  const parent=await lstat(dir);
  if(!parent.isDirectory()||parent.isSymbolicLink())throw Error('PRIVATE_DIRECTORY_UNVERIFIED');
  const file=path.join(dir,name),stat=await lstat(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<2||stat.size>8192)
    throw Error('PRIVATE_RECORD_UNVERIFIED');
  return JSON.parse(await readFile(file,'utf8'));
}
async function absent(root,folder,name){
  try{await lstat(path.join(root,folder,name));return false;}
  catch(error){return error?.code==='ENOENT';}
}
async function githubMerged3110({repoRoot}){
  const {stdout}=await exec('gh',['pr','view',String(MANUAL_PR),'--repo',
    'BryanHarrisScripts/PlotPickle','--json',
    'number,state,headRefName,headRefOid,baseRefName,mergeCommit,mergedAt'],
    {cwd:repoRoot,windowsHide:true,timeout:30_000,maxBuffer:4096});
  return JSON.parse(stdout);
}
async function gitAncestor({repoRoot,ancestor,descendant}){
  try{await exec('git',['merge-base','--is-ancestor',ancestor,descendant],
    {cwd:repoRoot,windowsHide:true,timeout:15_000,maxBuffer:4096});return true;}
  catch(error){if(error?.code===1)return false;throw error;}
}

/** A missing Factory publisher result remains missing even after manual merge. */
export async function prior3355OwnerOrdersReconciled({root,repoRoot,expectedHead,
  at=Date.now(),readPr=githubMerged3110,isAncestor=gitAncestor}={}){
  if(!path.isAbsolute(root||'')||!path.isAbsolute(repoRoot||'')||
     !SHA.test(expectedHead||'')||!Number.isSafeInteger(at))return false;
  try{
    const files=await readdir(path.join(root,'owner-work-orders'));
    const manualName=MANUAL_REQUEST+'.json';
    if(files.filter(name=>name===manualName).length!==1)return false;
    const others=files.filter(name=>name!==manualName);
    const {priorOwnerOrdersTerminal}=await import('../../../mcp/engineering/operations/factory-worker1-pilot-issuer.mjs');
    if(!await priorOwnerOrdersTerminal({root,entries:others,expectedHead,at}))return false;
    const work=await record(root,'owner-work-orders',manualName);
    if(work.requestId!==MANUAL_REQUEST||work.issueNumber!==3110||
       work.assignedWorker!=='coding-worker-1'||!ID.test(work.grantId||'')||
       !ID.test(work.publicationId||'')||!SHA.test(work.sourceHead||'')||
       work.sourceHead===expectedHead)return false;
    const [claim,coding,release,grant,publishing]=await Promise.all([
      record(root,'factory-worker-claims',manualName),
      record(root,'coding-attempts',work.grantId+'.result.json'),
      record(root,'coding-attempts',work.grantId+'.released.json'),
      record(root,'owner-coding-grants',work.grantId+'.json'),
      record(root,'owner-publication-grants',work.publicationId+'.json'),
    ]);
    if(claim.state!=='RESERVED_NO_REPLAY'||claim.requestId!==work.requestId||
       claim.sourceHead!==work.sourceHead||claim.issueNumber!==3110||
       coding.state!=='LOCAL_COMMIT_PREPARED'||coding.grantId!==work.grantId||
       coding.sourceHead!==work.sourceHead||!SHA.test(coding.commit||'')||
       coding.branch!==`engineering/3110-${work.grantId}`||
       release.state!=='RELEASED_AFTER_DURABLE_RESULT'||
       release.grantId!==work.grantId||release.sourceHead!==work.sourceHead||
       grant.grantId!==work.grantId||grant.expiresAt>=at||
       publishing.publicationId!==work.publicationId||publishing.expiresAt>=at||
       !await absent(root,'publication-attempts',work.publicationId+'.result.json')||
       !await absent(root,'engineering-receipts',work.grantId+'.json'))return false;
    const pr=await readPr({repoRoot});
    if(pr.number!==MANUAL_PR||pr.state!=='MERGED'||
       pr.headRefName!==coding.branch||!SHA.test(pr.headRefOid||'')||
       pr.baseRefName!=='main'||!SHA.test(pr.mergeCommit?.oid||'')||
       typeof pr.mergedAt!=='string'||
       !await isAncestor({repoRoot,ancestor:coding.commit,descendant:pr.headRefOid})||
       !await isAncestor({repoRoot,ancestor:pr.mergeCommit.oid,descendant:expectedHead}))
      return false;
    return true;
  }catch{return false;}
}
