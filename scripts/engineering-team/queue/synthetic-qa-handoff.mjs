/**
 * #3110: Read-only Synthetic QA -> Factory handoff proposal.
 * GitHub issue bodies are untrusted, so a plausible QA marker is only a
 * candidate, NEVER execution permission or proof of real Windows UAT.
 */
const REPO="BryanHarrisScripts/PlotPickle";
const FP=/<!-- plotpickle-autonomous-qa:(qa-defect-[a-f0-9]{32}) -->/;
const SHA=/^- Exact failing commit: `([a-f0-9]{40})`$/m;
const BUILD=/^- Build: `([a-z0-9][a-z0-9._:/-]{1,239})`$/mi;
const ROLE=/^- Tester role: `([a-z0-9][a-z0-9._:/-]{1,239})`$/mi;
const TITLE=/^\[Autonomous QA\]\[(?:blocker|critical|major|minor)\]/;
const HOLD=new Set(["hold","on hold","factory:blocked"]);
const validNumber=n=>Number.isSafeInteger(n)&&n>0&&n<=9999999;

export function planSyntheticQaHandoff({issues=[],observer={},maxIssues=5}={}) {
  if(!Array.isArray(issues)||!Number.isSafeInteger(maxIssues)||maxIssues<1||maxIssues>5)
    throw Error("Synthetic QA handoff needs 1-5 bounded candidate slots.");
  const known=new Set((observer?.queue?.jobs||[]).map(x=>x.issueNumber).filter(validNumber));
  const selected=[],seenNumber=new Set(),seenFingerprint=new Set();
  let excluded=0;
  for(const issue of [...issues].sort((a,b)=>(b?.number||0)-(a?.number||0))) {
    const num=issue?.number,body=typeof issue?.body==="string"?issue.body:"";
    const title=typeof issue?.title==="string"?issue.title:"";
    const labels=Array.isArray(issue?.labels)?issue.labels.map(x=>String(typeof x==="string"?x:x?.name||"").toLowerCase()):[];
    const fingerprint=body.match(FP)?.[1];
    const head=body.match(SHA)?.[1];
    const build=body.match(BUILD)?.[1];
    const role=body.match(ROLE)?.[1];
    if(!validNumber(num)||seenNumber.has(num)||known.has(num)||
       issue.state!=="OPEN"||!TITLE.test(title)||!fingerprint||!head||!build||!role||
       !body.includes("Reproduction evidence:")||!body.includes("Machine evidence:")||
       labels.some(l=>HOLD.has(l))||seenFingerprint.has(fingerprint)){
      excluded++;continue;
    }
    seenNumber.add(num);seenFingerprint.add(fingerprint);
    if(selected.length<maxIssues)selected.push(Object.freeze({
      issueNumber:num,fingerprint,failingHead:head,
      status:"QA_CANDIDATE_UNVERIFIED",
    }));
  }
  return Object.freeze({schemaVersion:1,repository:REPO,state:"PLAN_ONLY",
    candidateCount:selected.length,excludedCount:excluded,
    candidates:selected,admittedCount:0,queueModified:false,
    workerStarted:false,modelInvoked:false,mergeAuthorized:false,
    requiresIndependentReproduction:true,chatgptExecutionVerified:false});
}
