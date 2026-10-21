/**
 * #3118 Independent READ-ONLY browser evidence challenger.
 * Run as a distinct fixed Node process after the original browser run.
 * Never launch a browser/model, mutate worktrees, decide canon, or certify STOP.
 */
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, readFile, realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
const SHA = /^[a-f0-9]{40}$/;
const ID = /^[a-f0-9]{32}$/;
const REPORTS = Object.freeze([
  ["mind-map-world-map-shared-header","mindWorldAcceptance"],
  ["story-factory-read-only-journey","storyFactoryAcceptance"],
]);
const hash = value => createHash("sha256").update(value).digest("hex");
const blocked = (code, head) => Object.freeze({
  state:"BLOCKED",code,sourceHead:SHA.test(head||"")?head:null,
  independentVerification:false,productionStopVerified:false,
});

async function boundedJson(file, parent, maxBytes=262144) {
  const resolved = await realpath(file);
  if (!resolved.startsWith(parent + path.sep)) throw Error("EVIDENCE_OUTSIDE_PRIVATE_STAGE");
  const stats = await lstat(file);
  if (!stats.isFile() || stats.isSymbolicLink() || stats.size<8 || stats.size>maxBytes)
    throw Error("EVIDENCE_NOT_BOUNDED_FILE");
  const bytes = await readFile(file);
  if (bytes.length>maxBytes) throw Error("EVIDENCE_OVERSIZE");
  return {value:JSON.parse(bytes.toString("utf8")),digest:hash(bytes)};
}
function assertionsPass(report, name, head, minimum) {
  if (report?.schemaVersion!==1 || report?.journeyId!==name ||
      report?.commitSha!==head || report?.mode!=="exact-head" ||
      report?.status!=="PASS" || report?.state!=="ready" ||
      report?.rendered!==true || report?.isolatedBrowserContext!==true ||
      report?.blockerCount!==0 || !Array.isArray(report?.assertions) ||
      report.assertions.length<minimum || report.assertions.length>250)
    return false;
  const ids = new Set();
  for (const assertion of report.assertions) {
    if (typeof assertion?.id!=="string" || !assertion.id ||
        ids.has(assertion.id) || assertion.status!=="PASS") return false;
    ids.add(assertion.id);
  }
  return ids.has("browser-runtime-diagnostics") &&
    ids.has("active-project-present-before-journey");
}
function originalSafe(report, sourceRequestId, head) {
  return report?.schemaVersion==="1.0" && report?.observer==="webmcp-live" &&
    report?.factoryUatRequestId===sourceRequestId &&
    report?.exactHead===head && report?.status==="pass" &&
    report?.authority==="read-only-observer" &&
    report?.externalProviderCalls===false && report?.secretsAccessed===false &&
    report?.storyMode?.mode==="local" &&
    report?.storyMode?.providerSpendAllowed===false &&
    report?.mindWorldAcceptance?.status==="PASS" &&
    report?.mindWorldAcceptance?.journeyId===REPORTS[0][0] &&
    report?.storyFactoryAcceptance?.status==="PASS" &&
    report?.storyFactoryAcceptance?.journeyId===REPORTS[1][0] &&
    report?.storyFactoryAcceptance?.mutationAuthority===false &&
    report?.storyFactoryAcceptance?.providerSpendAllowed===false;
}
export async function attestStoryBrowserEvidence({
  privateRoot,sourceRequestId,expectedHead,platform=process.platform,runGit=exec,
}={}) {
  if (platform!=="win32")
    return blocked("WINDOWS_ONLY",expectedHead);
  if (typeof privateRoot!=="string" || !path.isAbsolute(privateRoot) ||
      !ID.test(sourceRequestId||"") || !SHA.test(expectedHead||""))
    return blocked("PRODUCT_UAT_ATTESTATION_INVALID",expectedHead);
  const requests = path.join(privateRoot,"mcp-control-requests");
  const stage = path.join(privateRoot,"mcp-story-uat",sourceRequestId,"source");
  let stageReal;
  try {
    // Resolve the parent first: do not spawn a rejecting promise before
    // another awaited operand has entered Promise.all.
    const requestsReal = await realpath(requests);
    const [reservation,receipt] = await Promise.all([
      boundedJson(path.join(requests,sourceRequestId+".json"),requestsReal,4096),
      boundedJson(path.join(requests,sourceRequestId+"-result.json"),requestsReal,4096),
    ]);
    if (reservation.value.requestId!==sourceRequestId ||
        reservation.value.expectedHead!==expectedHead ||
        reservation.value.operation!=="factory_run_named_test" ||
        receipt.value.requestId!==sourceRequestId ||
        receipt.value.sourceHead!==expectedHead ||
        receipt.value.suite!=="factory-story-uat" ||
        receipt.value.state!=="TEST_PASSED" ||
        receipt.value.code!=="PRODUCT_UAT_OBSERVED_PASS")
      return blocked("PRODUCT_UAT_ORIGINAL_NOT_PASSED",expectedHead);
    stageReal = await realpath(stage);
    const options={cwd:stage,windowsHide:true,encoding:"utf8",timeout:30000,maxBuffer:4096};
    const [head,dirty] = await Promise.all([
      runGit("git",["rev-parse","HEAD"],options),
      runGit("git",["status","--porcelain","--untracked-files=no"],options),
    ]);
    if (String(head.stdout||"").trim()!==expectedHead ||
        String(dirty.stdout||"").trim()!=="")
      return blocked("PRODUCT_UAT_SOURCE_CHANGED",expectedHead);
  } catch {
    return blocked("PRODUCT_UAT_SOURCE_CHANGED",expectedHead);
  }
  try {
    const original = await boundedJson(path.join(stage,".artifacts","verification-live","webmcp-live.json"),stageReal);
    if (!originalSafe(original.value,sourceRequestId,expectedHead))
      return blocked("PRODUCT_UAT_EVIDENCE_UNVERIFIED",expectedHead);
    const verified = [];
    for (const [journey] of REPORTS) {
      const artifact = await boundedJson(path.join(stage,".artifacts","webmcp-acceptance",journey,"exact-head.json"),stageReal);
      const minimum=journey==="story-factory-read-only-journey"?55:20;
      if (!assertionsPass(artifact.value,journey,expectedHead,minimum))
        return blocked("PRODUCT_UAT_CHECKPOINT_FAILED",expectedHead);
      verified.push(artifact);
    }
    const story = verified[1].value;
    const ids = new Set(story.assertions.map(x=>x.id));
    for (const stageName of ["outline","write","storyboard","previs","timeline"]) {
      for (const suffix of ["settled-identity","project-continuity","no-visible-alert","back-to-dashboard"]) {
        if (!ids.has(stageName+"-"+suffix))
          return blocked("PRODUCT_UAT_CHECKPOINT_FAILED",expectedHead);
      }
    }
    for (const id of ["story-factory-project-stable",
      "story-factory-provider-generation-not-invoked",
      "story-factory-canon-mutation-not-invoked"]) {
      if (!ids.has(id)) return blocked("PRODUCT_UAT_CHECKPOINT_FAILED",expectedHead);
    }
    // Each journey starts in its own isolated browser context. Project IDs
    // may differ between contexts, but must be stable within each journey.
    const mind = verified[0].value;
    const find = (report,id)=>report.assertions.find(x=>x.id===id);
    const mindProject=find(mind,"active-project-present-before-journey")?.observed;
    const storyProject=find(story,"active-project-present-before-journey")?.observed;
    const validProject=p=>typeof p==="string"&&p.length>0&&p!=="none";
    if (!validProject(mindProject)||!validProject(storyProject))
      return blocked("PRODUCT_UAT_PROJECT_MISMATCH",expectedHead);
    const sameProject=(report,id,project)=>{
      const checkpoint=find(report,id);
      return checkpoint?.status==="PASS" && checkpoint.expected===project &&
        checkpoint.observed===project;
    };
    for (const id of ["mind-map-project-continuity",
      "world-map-project-continuity","journey-active-project-stable"]) {
      if (!sameProject(mind,id,mindProject))
        return blocked("PRODUCT_UAT_PROJECT_MISMATCH",expectedHead);
    }
    for (const stageName of ["outline","write","storyboard","previs","timeline"]) {
      if (!sameProject(story,stageName+"-project-continuity",storyProject))
        return blocked("PRODUCT_UAT_PROJECT_MISMATCH",expectedHead);
    }
    if (!sameProject(story,"story-factory-project-stable",storyProject))
      return blocked("PRODUCT_UAT_PROJECT_MISMATCH",expectedHead);
    return Object.freeze({
      state:"TEST_PASSED",code:"PRODUCT_UAT_EVIDENCE_ATTESTED",sourceHead:expectedHead,
      sourceRequestId,checkpointCount:story.assertions.length,
      evidenceDigest:hash([sourceRequestId,expectedHead,original.digest,
        ...verified.map(x=>x.digest)].join(":")),
      projectIdentityDigest:hash(JSON.stringify({mindWorld:mindProject,storyFactory:storyProject})),
      independentVerification:false,productionStopVerified:false,
      modelInvoked:false,issueReserved:false,
    });
  } catch {
    return blocked("PRODUCT_UAT_EVIDENCE_UNVERIFIED",expectedHead);
  }
}

const direct = process.argv[1] &&
  path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if (direct) {
  const args=process.argv.slice(2);
  const result = await attestStoryBrowserEvidence({
    privateRoot:process.env.PLOTPICKLE_FACTORY_PRIVATE_ROOT,
    sourceRequestId:args.length===4 && args[0]==="--source-request"?args[1]:null,
    expectedHead:args.length===4 && args[2]==="--head"?args[3]:null,
  });
  process.stdout.write(JSON.stringify(result)+"\n");
  // Report a typed BLOCKED outcome to the parent; a crashing process still exits nonzero.
  process.exitCode=0;
}
