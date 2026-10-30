#!/usr/bin/env node
/**
 * #3142 owner-Windows only: reconcile exactly one syntax-rejected, uncommitted
 * one-shot coding claim. No replay, no worktree deletion, no PR/merge/model.
 * A separate original work order is required. Read-only --inspect first.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gatewayAppSource, privateGatewayRoot } from '../gateway-host.mjs';
import { ownerOneShotAllowed } from '../owner-runtime-gate.mjs';
import { readOwnerOrder } from './worker-host.mjs';
import { reconcileSyntaxRejectedOwnership } from '../receipts/atomic-coding-ownership.mjs';

const exec = promisify(execFile);
const ID = /^[a-f0-9]{32}$/;
const CONSENT = 'RECONCILE_ONE_FAILED_SYNTAX_CLAIM_NO_REPLAY';
const blocked = reason => Object.freeze({state:'BLOCKED', code:reason, noReplay:true});
const relative = 'scripts/engineering-team/gateway/worker-pool/worker-host.mjs';
const safeJson = async file => {
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > 4096)
    throw Error('UNVERIFIED_PRIVATE_RECORD');
  return JSON.parse(await readFile(file, 'utf8'));
};
const missing = async file => {
  try { await lstat(file); return false; }
  catch (error) { if (error?.code === 'ENOENT') return true; throw error; }
};
const git = async (cwd, ...args) =>
  String((await exec('git',args,{cwd,windowsHide:true,timeout:15000,maxBuffer:20000})).stdout).trim();
const ps = async command =>
  String((await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],
    {windowsHide:true,timeout:15000,maxBuffer:10000})).stdout).trim();

export async function inspectFailedSyntaxClaim({
  repoRoot=process.cwd(), root=privateGatewayRoot(), platform=process.platform,
  requestId, grantId, processCount=null,
}={}) {
  if (platform!=='win32' || !ID.test(requestId||'') || !ID.test(grantId||''))
    return blocked('WINDOWS_AND_EXACT_IDENTITIES_REQUIRED');
  try {
    const main=await gatewayAppSource({repoRoot});
    if (main?.channel!=='main' || !await ownerOneShotAllowed(main.head))
      return blocked('RUNNING_SUPERVISOR_AND_CLEAN_MAIN_REQUIRED');
    const order=await readOwnerOrder(root,requestId);
    if (order?.issueNumber!==3142 || order?.grantId!==grantId ||
        order?.sourceHead===undefined || order?.assignedWorker!=='coding-worker-1')
      return blocked('ORIGINAL_ONE_SHOT_ORDER_UNVERIFIABLE');
    const receipts=path.join(root,'coding-attempts');
    const grant=await safeJson(path.join(root,'owner-coding-grants',grantId+'.json'));
    if (grant.kind!=='engineering-edit-once' || grant.issueNumber!==3142 ||
        grant.grantId!==grantId || grant.sourceHead!==order.sourceHead ||
        grant.targetPath!==relative) return blocked('ORIGINAL_CODING_GRANT_UNVERIFIABLE');
    const outcome=await safeJson(path.join(receipts,grantId+'.result.json'));
    if (outcome.state!=='BLOCKED' ||
        outcome.code!=='CODING_OUTCOME_UNCERTAIN_REVIEW_STAGE' ||
        outcome.phase!=='CHECK_STAGE_SYNTAX' ||
        outcome.replayAuthorized!==false)
      return blocked('SYNTAX_REJECTION_RESULT_NOT_PROVEN');
    if (await git(repoRoot,'merge-base','--is-ancestor',order.sourceHead,main.head)
        .then(()=>true,()=>false) !== true)
      return blocked('SOURCE_ANCESTRY_UNVERIFIED');
    const pub=order.publicationId;
    if (!ID.test(pub||'') || pub===grantId ||
        !await missing(path.join(root,'publication-attempts',pub+'.reserved.json')) ||
        !await missing(path.join(root,'publication-attempts',pub+'.result.json')) ||
        !await missing(path.join(root,'engineering-receipts',grantId+'.json')))
      return blocked('EXTERNAL_PUBLICATION_EVIDENCE_EXISTS_OR_UNVERIFIABLE');
    const stage=path.join(root,'coding-worktrees',grantId);
    const stageStat=await lstat(stage);
    if (!stageStat.isDirectory() || stageStat.isSymbolicLink() ||
        await git(stage,'rev-parse','HEAD')!==order.sourceHead ||
        await git(stage,'branch','--show-current')!=='engineering/3142-'+grantId ||
        await git(stage,'diff','--cached','--name-only')!=='' ||
        await git(stage,'diff','--name-only')!==relative ||
        await git(stage,'status','--porcelain','--untracked-files=normal')!==' M '+relative)
      return blocked('ONLY_UNCOMMITTED_SOURCE_CHANGE_NOT_PROVEN');
    await git(stage,'diff','--check');
    const syntaxFile=path.join(stage,...relative.split('/'));
    let syntaxError=false;
    try { await exec(process.execPath,['--check',syntaxFile],{cwd:stage,windowsHide:true,timeout:15000,maxBuffer:8192}); }
    catch(error) { syntaxError=error?.code===1 &&
      String(error?.stderr||'').includes('SyntaxError'); }
    if (!syntaxError) return blocked('SYNTAX_FAILURE_NOT_INDEPENDENTLY_REPRODUCED');
    const remote=await git(repoRoot,'ls-remote','--heads','origin',
      'refs/heads/engineering/3142-'+grantId);
    if (remote) return blocked('REMOTE_BRANCH_EXISTS_DO_NOT_RECONCILE');
    const count=processCount===null
      ?await ps(`@((Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction Stop) | Where-Object { $_.CommandLine -match 'worker-host\\.mjs|authorized-coding-once\\.mjs' }).Count`)
      :String(processCount);
    if (count!=='0') return blocked('ACTIVE_OR_UNVERIFIABLE_CODING_PROCESS');
    return Object.freeze({state:'READY_FOR_OWNER_SYNTAX_RECONCILIATION',
      grantId,requestId,sourceHead:order.sourceHead,currentHead:main.head,
      ownerSupervisorVerified:true,stageSyntaxRejected:true,
      noLocalCommit:true,noRemoteBranch:true,noPublicationReceipt:true,
      workerProcessAbsent:true,noReplay:true});
  } catch {return blocked('SYNTAX_RECONCILIATION_PREFLIGHT_UNVERIFIABLE');}
}

async function main() {
  const args=process.argv.slice(2);
  if (!((args.length===3 && args[0]==='--inspect') ||
       (args.length===5 && args[0]==='--reconcile' && args[3]==='--consent' && args[4]===CONSENT))) {
    process.stdout.write(JSON.stringify(blocked('EXACT_INSPECT_OR_CONSENT_SYNTAX_REQUIRED'))+'\n');
    process.exitCode=2; return;
  }
  const observation=await inspectFailedSyntaxClaim({requestId:args[1],grantId:args[2]});
  if (args[0]==='--inspect' || observation.state!=='READY_FOR_OWNER_SYNTAX_RECONCILIATION') {
    process.stdout.write(JSON.stringify(observation)+'\n');
    if(observation.state==='BLOCKED')process.exitCode=2;
    return;
  }
  const root=privateGatewayRoot();
  const outcome=reconcileSyntaxRejectedOwnership(path.join(root,'coding-attempts'),{
    grantId:args[2],sourceHead:observation.sourceHead,
    stageAndRemoteVerified:true,consent:CONSENT,
  });
  process.stdout.write(JSON.stringify(outcome)+'\n');
  if (outcome.state==='BLOCKED')process.exitCode=2;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  main().catch(()=>{process.stdout.write(JSON.stringify(blocked('OWNER_RECONCILIATION_UNVERIFIABLE'))+'\n');process.exitCode=2;});
}
