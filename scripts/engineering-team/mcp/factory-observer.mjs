/**
 * #3110 — deterministic Factory Observer snapshot, not a coding model.
 * The host supplies sanitized status + bounded immutable attempt receipts.
 * Never trust an agent/heartbeat as proof of edits, tests or Windows UAT.
 */
const ISSUE=/^[1-9][0-9]{0,6}$/;
const SHA=/^[a-f0-9]{40}$/;
const COMPLETED=new Set(["COMPLETED_RECEIPT"]);
const OBSERVED=new Set(["COMPLETED_RECEIPT","RESERVED_NO_RESULT","NO_RESERVATION","UNVERIFIABLE_RECEIPT"]);
const TERMINAL=new Set(["BLOCKED","PR_OPEN","WAITING_FOR_PROVIDER","WAITING_FOR_PRODUCT_UAT"]);
// Only recognized Factory heartbeat states may be reported online. A fresh
// heartbeat is not permission to treat STOP_REQUESTED, unknown states or
// an owner-disabled Factory as live.
const LIVE_STATES=new Set(["IDLE","RUNNING","BLOCKED","PR_OPEN","MERGED",
  "WAITING_FOR_PROVIDER","WAITING_FOR_DEPENDENCIES","WAITING_FOR_PRODUCT_UAT",
  "WAITING_FOR_PR_VERIFICATION","WAITING_FOR_ELIGIBLE_ISSUE",
  "WAITING_FOR_EXACT_CLEAN_MAIN","WAITING_FOR_RETRY_HEAD_OR_REVIEW"]);
const safeIssue=n=>Number.isSafeInteger(n)&&ISSUE.test(String(n));
const safeHead=s=>typeof s==="string"&&SHA.test(s)?s:null;

export function summarizeFactoryObserver({status,approvedIssues=[],evidence=[],now=Date.now()}={}) {
  const snapshotAt=now;
  if(!Number.isSafeInteger(snapshotAt)||snapshotAt<0)throw Error("Observer time must be finite.");
  const factory=status&&typeof status==="object"?status:{};
  const verifiedIssues=[...new Set(approvedIssues.filter(safeIssue))].slice(0,80);
  const byIssue=new Map();
  for(const item of Array.isArray(evidence)?evidence:[]) {
    if(!safeIssue(item?.issueNumber)||byIssue.has(item.issueNumber)||!OBSERVED.has(item?.status))continue;
    byIssue.set(item.issueNumber,item);
  }
  const jobs=verifiedIssues.map(issueNumber=>{
    const item=byIssue.get(issueNumber);
    const record=item?.record;
    const receiptStatus=item?.status||"UNKNOWN";
    const reservation=receiptStatus==="RESERVED_NO_RESULT"||receiptStatus==="COMPLETED_RECEIPT";
    const terminal=COMPLETED.has(receiptStatus)&&TERMINAL.has(record?.state);
    return Object.freeze({
      issueNumber,
      state:terminal?record.state:
        receiptStatus==="RESERVED_NO_RESULT"?"STARTED_UNCONFIRMED":
        receiptStatus==="NO_RESERVATION"?"UNRESERVED":"UNKNOWN",
      evidence:receiptStatus,
      sourceHead:safeHead(record?.sourceHead),
      // A reservation is write-once. It is not permission to replay a model call.
      replayAuthorized:false,reserved:reservation,
    });
  });
  const heartbeatFresh=factory.heartbeatFresh===true;
  const rawState=typeof factory.state==="string"?factory.state:"UNKNOWN";
  const online=factory.enabled===true && heartbeatFresh && LIVE_STATES.has(rawState);
  const stalled=!!(factory.enabled===true&&!heartbeatFresh);
  const reservedCount=jobs.filter(x=>x.reserved).length;
  const blockedCount=jobs.filter(x=>x.state==="BLOCKED").length;
  const unknownCount=jobs.filter(x=>x.state==="UNKNOWN"||x.state==="STARTED_UNCONFIRMED").length;
  const unreservedCount=jobs.filter(x=>x.state==="UNRESERVED").length;
  const nativeProof=factory.dependencyPreflight;
  const dependencyReady=nativeProof?.state==="INSTALL_PREFLIGHT_READY"&&
    ["NPM_CI_VERIFIED","NPM_PREFLIGHT_VERIFIED"].includes(nativeProof.code)&&
    safeHead(nativeProof.sourceHead)!==null;
  return Object.freeze({
    schemaVersion:1,observer:"factory-observer",architecture:"NODE_JS_WINDOWS",
    state:"SNAPSHOT_ONLY",snapshotAt,
    factory:{state:rawState,enabled:factory.enabled===true,
      heartbeatFresh,heartbeatAgeSeconds:Number.isFinite(factory.heartbeatAgeSeconds)?
        Math.max(0,Math.floor(factory.heartbeatAgeSeconds)):null,
      online,stalled,activeIssue:safeIssue(factory.activeIssue)?factory.activeIssue:null,
      processOwnershipVerified:false},
    queue:{approvedCount:verifiedIssues.length,unreservedCount,reservedCount,
      blockedCount,unknownCount,jobs},
    dependency:{readyForSourceHead:dependencyReady,
      sourceHead:safeHead(nativeProof?.sourceHead)},
    chatgptEngineering:{onlyPermittedAI:"CHATGPT_VIA_AUTHENTICATED_MCP",
      nativeDispatcher:"PI_LEGACY",ready:false,
      code:"CHATGPT_ONLY_DISPATCHER_NOT_IMPLEMENTED",
      admissionRecommended:false,modelInvokedByObserver:false},
    assurance:{sourceEditVerified:false,productGateVerified:false,
      automaticMergeEnabled:false,independentVerification:false,
      // No BUZZ, no inferred continuous reasoning or scheduling completion.
      backgroundChatgptTurnVerified:false},
  });
}
