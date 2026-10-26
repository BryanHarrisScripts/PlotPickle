import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, readFile, writeFile, rm, lstat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateChatEditGrant, prepareChatEditOnce } from
  "../scripts/engineering-team/gateway/chat/owner-chat-edit-once.mjs";
import { validateCodingGrant } from
  "../scripts/engineering-team/gateway/authorized-coding-once.mjs";
import { validatePublicationGrant } from
  "../scripts/engineering-team/gateway/publication/authorized-pr-publish-once.mjs";
import { engineeringReceiptFor } from
  "../scripts/engineering-team/gateway/verification/two-receipt-verifier.mjs";
import { dispatcherAction, dispatcherRpc } from
  "../scripts/engineering-team/mcp/dispatcher/engineering-dispatcher-plugin.mjs";

const exec=promisify(execFile), grantId="8".repeat(32), requestId="9".repeat(32);
const target="scripts/engineering-team/mcp/factory-observer.mjs";
const focusedTest="tests/issue-3154-chatgpt-factory-mcp.test.mjs";
const sourceText="export const answer = () => 'before';\n";
const oldText="answer = () => 'before'";
const newText="answer = () => 'after'";
const digest=s=>createHash("sha256").update(s,"utf8").digest("hex");
const fixture=async fn=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"plotpickle-chat-patch-"));
  try {await fn(root);} finally {await rm(root,{recursive:true,force:true});}
};
const ownerGrant=(head,at)=>({
  schemaVersion:1,kind:"engineering-chat-edit-once",grantId,
  issueNumber:3142,sourceHead:head,targetPath:target,targetDigest:digest(sourceText),
  focusedTest,objective:"Bounded status sanitization in the observer.",
  expiresAt:at+1800000,maxRequests:1,consent:"AUTHORIZE_ONE_CHATGPT_SOURCE_EDIT"
});
const git=async(repo,...args)=>{
  const r=await exec("git",args,{cwd:repo,timeout:30000,windowsHide:true,maxBuffer:16384});
  return r.stdout.trim();
};
async function createRepo(root){
  const repo=path.join(root,"main");await mkdir(repo);
  await git(repo,"init","-q");
  await git(repo,"config","user.name","PlotPickle Test");
  await git(repo,"config","user.email","ci@example.invalid");
  await git(repo,"config","core.autocrlf","false");
  const source=path.join(repo,...target.split("/"));
  const focused=path.join(repo,...focusedTest.split("/"));
  await mkdir(path.dirname(source),{recursive:true});
  await mkdir(path.dirname(focused),{recursive:true});
  await writeFile(source,sourceText,"utf8");
  await writeFile(focused,"import test from 'node:test'; test('fixture',()=>{});\n","utf8");
  await git(repo,"add",".");await git(repo,"commit","-qm","clean baseline");
  return {repo,head:await git(repo,"rev-parse","HEAD")};
}
test("Chat edit has a different owner grant and cannot silently use the API-grant authority",()=>{
  const now=2000000000,head="a".repeat(40);
  const g=ownerGrant(head,now),source={channel:"main",head};
  assert.equal(validateChatEditGrant(g,source,now),true);
  assert.equal(validateCodingGrant(g,source,now),false);
  assert.equal(validateChatEditGrant({...g,consent:"AUTHORIZE_ONE_ENGINEERING_SOURCE_EDIT"},source,now),false);
  assert.equal(validateChatEditGrant({...g,targetPath:"../../.git/config"},source,now),false);
  assert.equal(validateChatEditGrant({...g,expiresAt:now+3600001},source,now),false);
  assert.equal(validateChatEditGrant({...g,sourceHead:"b".repeat(40)},source,now),false);
  assert.equal(validateChatEditGrant({...g,model:"my-model"},source,now),false);
});
test("Owner-granted Chat edit creates a REAL isolated local commit without calling an API or running the generated code",()=>fixture(async root=>{
  const {repo,head}=await createRepo(root);
  const privateRoot=path.join(root,"private");await mkdir(privateRoot);
  const now=1900000000,grant=ownerGrant(head,now);
  const choice={oldText,newText};
  const options={repoRoot:repo,privateRoot,source:{head,channel:"main"},grant,
    proposal:choice,platform:"win32",now:()=>now,
    disk:async()=>({bavail:12n*1024n*1024n,bsize:1024n})};
  const result=await prepareChatEditOnce(options);
  assert.equal(result.state,"LOCAL_COMMIT_PREPARED");
  assert.equal(result.code,"SYNTAX_CHECK_PASSED_TESTS_PENDING");
  assert.equal(result.sourceHead,head);
  assert.equal(result.modelInvoked,false);
  assert.equal(result.pullRequestCreated,false);
  assert.equal(result.independentVerification,false);
  assert.equal(result.focusedTestExecuted,false);
  assert.equal(await git(repo,"rev-parse","HEAD"),head);
  assert.equal(await readFile(path.join(repo,...target.split("/")),"utf8"),sourceText);
  const stage=path.join(privateRoot,"coding-worktrees",grantId);
  assert.equal(await git(stage,"rev-parse","HEAD"),result.commit);
  assert.equal(await git(stage,"rev-parse","HEAD^"),head);
  assert.equal(await git(stage,"branch","--show-current"),"engineering/3142-"+grantId);
  assert.equal((await readFile(path.join(stage,...target.split("/")),"utf8")).includes("'after'"),true);
  const stored=JSON.parse(await readFile(path.join(privateRoot,"coding-attempts",
    grantId+".result.json"),"utf8"));
  assert.equal(stored.commit,result.commit);
  assert.equal((await prepareChatEditOnce(options)).state,"BLOCKED");
  assert.equal(await git(repo,"status","--porcelain"),"");
  assert.equal((await lstat(path.join(privateRoot,"coding-attempts",
    grantId+".reserved.json"))).isFile(),true);
}));
test("Invalid proposal/digest blocks before any grant or stage reservation",()=>fixture(async root=>{
  const {repo,head}=await createRepo(root);
  const privateRoot=path.join(root,"private");await mkdir(privateRoot);
  const now=1900000000;
  for(const proposal of [{oldText,newText:oldText},{oldText:"missing unique substring",newText},
    {oldText,newText:""},{oldText:"x".repeat(3001),newText}]) {
    const result=await prepareChatEditOnce({repoRoot:repo,privateRoot,
      source:{head,channel:"main"},grant:ownerGrant(head,now),proposal,
      platform:"win32",now:()=>now,
      disk:async()=>{throw Error("disk probe must not run");}});
    assert.equal(result.state,"BLOCKED");
    assert.equal(result.modelInvoked,false);
  }
  await assert.rejects(()=>lstat(path.join(privateRoot,"coding-attempts",
    grantId+".reserved.json")),{code:"ENOENT"});
}));
test("Separate exact-commit publisher and provenance verifier explicitly accept Chat grant, not broadened consent",()=>{
  const head="a".repeat(40),commit="b".repeat(40),publicationId="7".repeat(32);
  const grant=ownerGrant(head,1900000000);
  const prepared={state:"LOCAL_COMMIT_PREPARED",code:"SYNTAX_CHECK_PASSED_TESTS_PENDING",
    sourceMutationVerified:true,focusedTestExecuted:false,pullRequestCreated:false,
    independentVerification:false,automaticMergeAuthorized:false,
    grantId,issueNumber:3142,sourceHead:head,commit,
    branch:"engineering/3142-"+grantId,focusedTest};
  const publishing={schemaVersion:1,kind:"draft-pr-publish-once",publicationId,
    grantId,issueNumber:3142,sourceHead:head,localCommit:commit,
    branch:prepared.branch,targetPath:target,expiresAt:1900100000,
    maxRequests:1,consent:"AUTHORIZE_ONE_DRAFT_ENGINEERING_PR"};
  assert.equal(validatePublicationGrant(publishing,prepared,grant,{channel:"main",head},
    1900000000),true);
  assert.equal(validatePublicationGrant(publishing,prepared,{...grant,consent:"NO"},
    {channel:"main",head},1900000000),false);
  const reserve={grantId,sourceHead:head,localCommit:commit,tree:"c".repeat(40),
    contentDigest:"d".repeat(64)};
  const published={state:"DRAFT_PR_CREATED",pullRequestCreated:true,independentVerification:false,
    automaticMergeAuthorized:false,grantId,publicationId,issueNumber:3142,
    sourceHead:head,localCommit:commit,tree:reserve.tree,
    branch:prepared.branch,remoteCommit:"e".repeat(40),prNumber:4444};
  const proof=engineeringReceiptFor({requestId:grantId,grant,edit:prepared,
    publicationGrant:publishing,reservation:reserve,published,at:1900000000});
  assert.equal(proof?.state,"SOURCE_COMMITTED_AND_PR_PUBLISHED");
  assert.equal(proof.independentlyVerified,false);
  assert.equal(engineeringReceiptFor({requestId:grantId,grant:{...grant,consent:"NO"},
    edit:prepared,publicationGrant:publishing,reservation:reserve,published,at:1900000000}),null);
});
test("Authenticated MCP chat patch enforces STOP, exact SHA, bounded args and one immutable no-replay receipt",()=>fixture(async root=>{
  let calls=0;
  const params={requestId,expectedHead:"a".repeat(40),codingGrantId:grantId,
    oldText,newText};
  const props={root,platform:"win32",enabled:true,
    source:async()=>({head:params.expectedHead,channel:"main"}),
    chatPatch:async received=>{calls++;
      assert.deepEqual(received,{grantId,proposal:{oldText,newText}});
      return {state:"LOCAL_COMMIT_PREPARED",code:"SYNTAX_CHECK_PASSED_TESTS_PENDING",
        grantId,sourceHead:params.expectedHead,issueNumber:3142,
        commit:"b".repeat(40),branch:"engineering/3142-"+grantId,
        sourceMutationVerified:true,focusedTestExecuted:false,pullRequestCreated:false,
        independentVerification:false,automaticMergeAuthorized:false,replayAuthorized:false};
    },now:()=>1900000000};
  assert.equal((await dispatcherRpc({jsonrpc:"2.0",id:1,method:"tools/call",
    params:{name:"engineering_apply_chat_patch_once",arguments:params}},
    {...props,authenticated:false})).error.code,-32001);
  assert.equal((await dispatcherAction("engineering_apply_chat_patch_once",
    {...params,target:"scripts/nope.mjs"},props)).code,"INVALID_EXECUTION_SELECTION");
  assert.equal((await dispatcherAction("engineering_apply_chat_patch_once",
    {...params,oldText:"x".repeat(3001)},props)).code,"INVALID_EXECUTION_SELECTION");
  assert.equal((await dispatcherAction("engineering_apply_chat_patch_once",
    {...params,expectedHead:"f".repeat(40)},props)).code,"EXACT_CLEAN_MAIN_REQUIRED");
  assert.equal(calls,0);
  const ok=await dispatcherAction("engineering_apply_chat_patch_once",params,props);
  assert.equal(ok.state,"LOCAL_COMMIT_PREPARED");
  assert.equal(ok.localCommit,"b".repeat(40));
  assert.equal(calls,1);
  assert.equal((await dispatcherAction("engineering_apply_chat_patch_once",params,props))
    .code,"REQUEST_ALREADY_RESERVED_NO_REPLAY");
  assert.equal(calls,1);
  const receipt=await dispatcherAction("engineering_dispatch_receipt",{requestId},props);
  assert.equal(receipt.state,"LOCAL_COMMIT_PREPARED");
  assert.equal(receipt.localCommit,ok.localCommit);
  assert.equal(receipt.automaticMergeAuthorized,false);
}));

test("manual Architecture Verification dispatch checks full accumulated patch, never only last commit",async()=>{
  const workflow=await readFile(new URL("../.github/workflows/architecture-shadow.yml",
    import.meta.url),"utf8");
  assert.match(workflow,/workflow_dispatch:/);
  const base="github.event.pull_request.base.sha || github.event.before || 'origin/main'";
  assert.equal(workflow.split(base).length-1,9);
  assert.doesNotMatch(workflow,/github\.event\.pull_request\.base\.sha \|\| github\.event\.before \|\| 'HEAD\^'/);
});
