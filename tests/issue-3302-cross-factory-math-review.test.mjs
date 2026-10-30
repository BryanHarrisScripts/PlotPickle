import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createPublicKey,generateKeyPairSync,sign} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {inspectCrossFactoryTruth,checkCrossFactoryReceiptSignature,
  crossFactoryReceiptPayload} from
  '../scripts/engineering-team/verification/aegis/cross-factory-math-review.mjs';
import {runCrossFactoryInspect} from
  '../scripts/engineering-team/verification/aegis/cross-factory-math-review-cli.mjs';
import {assessSignedGreenRelease,ownerReleasePayload} from
  '../scripts/engineering-team/gateway/worker-pool/signed-green-release.mjs';

const h=s=>createHash('sha256').update(s).digest('hex');
const HEAD='a'.repeat(40),ART=h('exact artifact'),TRUTH=h('normative math policy');
const ev=(id,kind)=>({id,kind,sha256:h(id+kind)});
const base=factory=>({
  job:{schemaVersion:1,factory,candidateHead:HEAD,artifactDigest:ART,
    truthDigest:TRUTH,authorPrincipal:'untrusted-coder-01',
    truthRefs:['WHITE-PAPER-V3/W8','WHITE-PAPER-V3/W9']},
  truthPolicy:{origin:'external-protected-authority',factory,
    candidateHead:HEAD,normativeDigest:TRUTH,
    truthRefs:['WHITE-PAPER-V3/W8','WHITE-PAPER-V3/W9']},
  stopMarkerState:'ABSENT',
  proofs:{sourceHead:HEAD,artifactDigest:ART,
    evidence:[ev('placeholder','fixture')],mathematics:{}},
});
const fixture=factory=>{
  const x=base(factory);
  if(factory==='PP-F01'){
    x.proofs.mathematics={sourceEditScoped:true,exactGitHeadVerified:true,
      architectureLayersPassed:7,windowsAcceptanceIndependent:true};
    x.proofs.evidence=[ev('github-ci','architecture'),ev('owner-windows','owner-windows')];
  }else if(factory==='PP-F02'){
    x.proofs.mathematics={independentReproductions:2,firstResultDigest:h('result'),
      secondResultDigest:h('result'),skillsChangeOwnerApproved:true};
    x.proofs.evidence=[ev('replication-a','reproduction'),ev('replication-b','reproduction')];
  }else if(factory==='PP-F03'){
    x.proofs.mathematics={scope:'full-feature',acts:4,sequences:12,blocks:24,
      miniBlocks:96,shotsPerMiniBlock:25,secondsPerShot:3,
      renderSlots:2400,runtimeSeconds:7200,canonMutationRequested:false};
    x.proofs.evidence=[ev('canon','locked-human-canon'),ev('storyboard','shot-provenance')];
  }else{
    x.proofs.mathematics={seed:23,replayHashA:h('replay'),replayHashB:h('replay'),
      rulesChangedWithoutOwner:false};
    x.proofs.evidence=[ev('replay-a','deterministic-replay'),
      ev('replay-b','deterministic-replay')];
  }
  return x;
};

test('F01-F04 each verify bounded mathematical evidence but cannot self-admit or authorize',()=>{
  for(const f of ['PP-F01','PP-F02','PP-F03','PP-F04']){
    const x=fixture(f),out=inspectCrossFactoryTruth(x);
    assert.equal(out.status,'REVIEW_PROPOSAL_ONLY',f);
    assert.equal(out.disposition,'UNPROVEN',f);
    assert.equal(out.code,'MATHEMATICS_CONSISTENT_SEMANTIC_REVIEW_AND_ATTESTATION_REQUIRED');
    assert.match(out.proofDigest,/^[a-f0-9]{64}$/);
    for(const field of ['maySign','mayAdmit','mayAdvance','mayEditCanon','mayMerge'])
      assert.equal(out[field],false,f+':'+field);
    assert.equal(inspectCrossFactoryTruth(x).proofDigest,out.proofDigest);
    assert.equal(out.independentAuthority,false);
  }
});
test('F03 feature and mini-block math rejects wrong shot count, length, or canon override',()=>{
  const f=fixture('PP-F03');
  for(const bad of [{renderSlots:2399},{miniBlocks:95},{runtimeSeconds:7250},
    {canonMutationRequested:true}]){
    const r=inspectCrossFactoryTruth({...f,
      proofs:{...f.proofs,mathematics:{...f.proofs.mathematics,...bad}}});
    assert.equal(r.disposition,'FIX');
    assert.equal(r.mayAdvance,false);
  }
  const m=fixture('PP-F03');
  m.proofs.mathematics={scope:'mini-block',shotsPerMiniBlock:25,
    secondsPerShot:3,renderSlots:25,runtimeSeconds:75};
  assert.equal(inspectCrossFactoryTruth(m).disposition,'UNPROVEN');
});
test('F01 seven CI layers and genuine Windows proof; F02 repeatability; F04 deterministic replay are required',()=>{
  for(const [f,change] of [
    ['PP-F01',{architectureLayersPassed:6}],
    ['PP-F01',{windowsAcceptanceIndependent:false}],
    ['PP-F02',{secondResultDigest:h('changed')}],
    ['PP-F04',{replayHashB:h('changed')}],
  ]){
    const x=fixture(f);Object.assign(x.proofs.mathematics,change);
    assert.equal(inspectCrossFactoryTruth(x).disposition,'FIX',f);
  }
});
test('STOP, PAUSE uncertainty, wrong truth policy, missing evidence and unbound source deny',()=>{
  for(const f of ['PP-F01','PP-F02','PP-F03','PP-F04']){
    const x=fixture(f);
    assert.equal(inspectCrossFactoryTruth({...x,stopMarkerState:'PRESENT'}).code,'HUMAN_STOP');
    assert.equal(inspectCrossFactoryTruth({...x,stopMarkerState:'UNKNOWN'}).code,
      'STOP_PAUSE_UNVERIFIABLE');
    assert.equal(inspectCrossFactoryTruth({...x,
      truthPolicy:{...x.truthPolicy,normativeDigest:h('other')}}).code,
      'EXTERNALLY_PINNED_TRUTH_MISMATCH');
    assert.equal(inspectCrossFactoryTruth({...x,
      proofs:{...x.proofs,sourceHead:'b'.repeat(40)}}).code,
      'SOURCE_PROOF_EDITION_UNVERIFIABLE');
    assert.equal(inspectCrossFactoryTruth({...x,
      proofs:{...x.proofs,evidence:[...x.proofs.evidence,ev('extra','fixture'),
        ev('extra','fixture')]}}).status,'BLOCKED');
  }
});
test('bounded independent reviewer CLI accepts only inspect; never upgrades the proposal',async()=>{
  const item=fixture('PP-F03');
  const result=await runCrossFactoryInspect(JSON.stringify(item));
  assert.equal(result.status,'REVIEW_PROPOSAL_ONLY');
  assert.equal(result.mayAdmit,false);
  assert.equal((await runCrossFactoryInspect('{}')).status,'BLOCKED');
  assert.equal((await runCrossFactoryInspect(JSON.stringify(item),['--sign'])).status,'BLOCKED');
  assert.equal((await runCrossFactoryInspect('x'.repeat(300000))).code,'INPUT_OVERSIZED');
});
test('Ed25519 receipt authenticity is checked but signature alone cannot authorize',()=>{
  const {privateKey,publicKey}=generateKeyPairSync('ed25519');
  const keyPem=publicKey.export({type:'spki',format:'pem'});
  const fingerprint=h(createPublicKey(keyPem).export({type:'spki',format:'der'}));
  const proposal=inspectCrossFactoryTruth(fixture('PP-F01'));
  const now=1793400000000;
  const body={schemaVersion:1,kind:'independent-factory-review',factory:'PP-F01',
    candidateHead:HEAD,artifactDigest:ART,truthDigest:TRUTH,
    proofDigest:proposal.proofDigest,decision:'ADMIT',reviewerId:'PP-F00-LA-W0001',
    reviewerKeyFingerprint:fingerprint,nonce:'d'.repeat(32),
    issuedAt:now-1000,expiresAt:now+100000};
  const receipt={...body,signature:sign(null,
    Buffer.from(crossFactoryReceiptPayload(body)),privateKey).toString('base64')};
  const expected={...proposal,truthDigest:TRUTH,
    independentlyPinnedReviewerFingerprint:fingerprint};
  const outcome=checkCrossFactoryReceiptSignature({receipt,publicKeyPem:keyPem,expected,now});
  assert.equal(outcome.status,'CRYPTOGRAPHIC_SIGNATURE_VALID_ONLY');
  assert.equal(outcome.mayAuthorize,false);
  assert.equal(checkCrossFactoryReceiptSignature({receipt:{...receipt,proofDigest:h('forged')},
    publicKeyPem:keyPem,expected,now}).status,'BLOCKED');
  assert.equal(checkCrossFactoryReceiptSignature({receipt,publicKeyPem:keyPem,
    expected:{...expected,independentlyPinnedReviewerFingerprint:h('wrong')},now}).status,'BLOCKED');
  assert.equal(checkCrossFactoryReceiptSignature({receipt,publicKeyPem:keyPem,
    expected,now:now+200000}).status,'BLOCKED');
});

const greenInputs=()=>{
  const {privateKey,publicKey}=generateKeyPairSync('ed25519');
  const now=1793400000000,baseHead='a'.repeat(40),candidateHead='b'.repeat(40);
  const engineeringId=h('engineering'),verifierId=h('independent-verifier'),win=h('windows');
  const approval={schemaVersion:1,kind:'owner-exact-green-merge-release',
    consent:'MERGE_EXACT_HEAD_GREEN_ONLY',prNumber:3344,
    baseHead,candidateHead,verifierReceiptId:verifierId,
    ownerWindowsProofDigest:win,nonce:'e'.repeat(32),
    observedAt:now-1000,expiresAt:now+20000};
  return {
    pr:{number:3344,state:'open',draft:false,mergeable:true,
      base:{ref:'main',sha:baseHead},head:{sha:candidateHead}},
    mainHead:baseHead,
    workflow:{id:7331,name:'Architecture Verification',status:'completed',
      conclusion:'success',head_sha:candidateHead},
    jobs:['Experience Skins','Experience Contract','Production Orchestration',
      'Agent & Skill Mesh','Story / Canon / Evidence','Provider Runtime',
      'Validation & Operations'].map((x,i)=>({
        name:'Layer '+(i+1)+' '+x,status:'completed',conclusion:'success',
      })).concat([{name:'Windows owned verifier STOP and sentinel proof',
        status:'completed',conclusion:'success'}]),
    supervisor:{state:'RUNNING',exactSha:baseHead,
      heartbeatFresh:true,pauseAcknowledged:false,stopRequested:false},
    engineering:{state:'SOURCE_COMMITTED_AND_PR_PUBLISHED',
      issueNumber:3142,prNumber:3344,receiptId:engineeringId,
      sourceHead:baseHead,candidateHead,
      independentlyVerified:false,automaticMergeAuthorized:false},
    verifier:{kind:'independent-verifier',state:'INDEPENDENTLY_VERIFIED',
      independentlyVerified:true,automaticMergeAuthorized:false,
      sourceHead:baseHead,candidateHead,prNumber:3344,
      receiptId:verifierId,engineeringReceiptId:engineeringId},
    ownerWindows:{state:'PASS',sourceHead:baseHead,candidateHead,prNumber:3344,
      proofDigest:win,independentEvidence:true},
    signedOwnerRelease:{...approval,signature:sign(null,
      Buffer.from(ownerReleasePayload(approval)),privateKey).toString('base64')},
    pinnedPublicKey:publicKey.export({type:'spki',format:'pem'}),now,
  };
};
test('merge eligibility requires independently signed exact head and still never executes merge',()=>{
  const x=greenInputs(),r=assessSignedGreenRelease(x);
  assert.equal(r.state,'ELIGIBLE_FOR_SEPARATE_MERGE_SUBMISSION');
  assert.equal(r.maySubmitMerge,true);
  assert.equal(r.automaticMergeEnabled,false);
  assert.equal(r.mergeExecuted,false);
  for(const bad of [
    {...x,pr:{...x.pr,draft:true}},
    {...x,mainHead:'0'.repeat(40)},
    {...x,supervisor:{...x.supervisor,state:'STOP_REQUESTED'}},
    {...x,jobs:x.jobs.map((j,i)=>i===4?{...j,conclusion:'skipped'}:j)},
    {...x,signedOwnerRelease:{...x.signedOwnerRelease,signature:'A'.repeat(86)+'=='}},
    {...x,ownerWindows:{...x.ownerWindows,state:'MISSING'}},
    {...x,verifier:{...x.verifier,independentlyVerified:false}},
  ]){
    const result=assessSignedGreenRelease(bad);
    assert.equal(result.state,'BLOCKED');
    assert.equal(result.maySubmitMerge,false);
  }
});

test('actual bounded F00 CLI subprocess returns proposal without reviewer key or side effects',async()=>{
  const cli=fileURLToPath(new URL('../scripts/engineering-team/verification/aegis/cross-factory-math-review-cli.mjs',import.meta.url));
  const run=(args,input)=>new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[cli,...args],{stdio:['pipe','pipe','pipe'],windowsHide:true});
    let output='',err='';
    child.stdout.on('data',b=>output+=b.toString('utf8'));
    child.stderr.on('data',b=>err+=b.toString('utf8'));
    child.once('error',reject);
    child.once('close',code=>resolve({code,output,err}));
    child.stdin.end(input);
  });
  const good=await run(['--inspect'],JSON.stringify(fixture('PP-F03')));
  assert.equal(good.code,0);
  const value=JSON.parse(good.output.trim());
  assert.equal(value.disposition,'UNPROVEN');
  assert.equal(value.maySign,false);
  assert.equal(value.mayMerge,false);
  const rejected=await run(['--sign'],JSON.stringify(fixture('PP-F03')));
  assert.equal(rejected.code,2);
  assert.equal(JSON.parse(rejected.output.trim()).code,'READ_ONLY_INSPECT_COMMAND_REQUIRED');
});
