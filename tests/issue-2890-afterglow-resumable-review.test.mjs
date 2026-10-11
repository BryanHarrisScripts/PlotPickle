import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdtemp,rm,readFile} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import test from "node:test";
import {normalizeAfterglowReviewDraft,withoutAfterglowReviewConfirmation} from "../modules/library/master/afterglow-review-draft.mjs";
import {createProfilePrivateStorageService} from "../core/storage/profile-private/profile-private-storage-core.mjs";

const fingerprint=label=>"sha256:"+createHash("sha256").update(label).digest("hex");
const makeChoices=()=>({
  decisions:{"/world/lessons/genres/answers/output-1":1},
  exclusions:["/mindMapNotes/fields/unused-note"],
  confirmedCurrent:{"/storyDevelopment/fields/character~1joy":true},
  imageChoices:{'["joy","front-full-body"]:2026:choice':"keep",
    '["joy","front-full-body"]:2026:other':"exclude"},
});
const draft=(label="first")=>({version:1,sourceFingerprint:fingerprint(label),
  selections:makeChoices()});
const authService={
  createProfileVaultCapability(context){return{
    profileId:context.profileId,
    async wrapSecret({secret}){return {payload:Buffer.from(secret).toString("base64")}},
    async unwrapSecret({envelope}){return Uint8Array.from(Buffer.from(envelope.payload,"base64"))},
  }},
  registerVaultCleanupHook(){return()=>undefined},
  resolveSession(){return{}},
};
test("#2890 autosave schema preserves all four creative selection kinds, rejects malformed or enormous choices",()=>{
  const value=normalizeAfterglowReviewDraft(draft(),"2026-10-09T20:30:00Z");
  assert.equal(value.sourceFingerprint,fingerprint("first"));
  assert.deepEqual(value.selections,makeChoices());
  assert.equal(value.savedAt,"2026-10-09T20:30:00Z");
  assert.throws(()=>normalizeAfterglowReviewDraft({...draft(),sourceFingerprint:"unverified"}),/bound to verified/u);
  assert.throws(()=>normalizeAfterglowReviewDraft({...draft(),selections:{...makeChoices(),confirmedCurrent:{"/x":false}}}),/Invalid confirmation/u);
  assert.throws(()=>normalizeAfterglowReviewDraft({...draft(),selections:{...makeChoices(),decisions:{"/x":-1}}}),/Invalid alternative/u);
  assert.throws(()=>normalizeAfterglowReviewDraft({...draft(),selections:{...makeChoices(),imageChoices:{"too-big":"maybe"}}}),/Invalid image version/u);
  assert.throws(()=>normalizeAfterglowReviewDraft({...draft(),selections:{...makeChoices(),exclusions:["/a","/a"]}}),/Duplicate/u);
});
test("#2890 one encrypted review survives close/restart, rapid updates, profile isolation and never changes Library",async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"plotpickle-2890-"));
  const makeStore=()=>createProfilePrivateStorageService({root,authService,
    normalizeProject:value=>structuredClone(value)});
  const storage=makeStore();
  t.after(async()=>{storage.close();await rm(root,{recursive:true,force:true})});
  const alpha={sessionId:"alpha",profileId:"profile_afterglow_alpha"};
  const beta={sessionId:"beta",profileId:"profile_afterglow_beta"};
  const before=await storage.listProjects(alpha);
  const key={domain:"cache",objectId:"afterglow-review-draft"};
  const first=normalizeAfterglowReviewDraft(draft("sources-A"),"2026-10-09T20:30:00Z");
  const last=normalizeAfterglowReviewDraft({
    ...draft("sources-A"),selections:{
      ...makeChoices(),decisions:{"/world/lessons/genres/answers/output-1":2},
      confirmedCurrent:{...makeChoices().confirmedCurrent,"/world/lessons/story/answers/output-2":true},
    },
  },"2026-10-09T20:31:00Z");
  await storage.writePrivateJson(alpha,{...key,value:first});
  await storage.writePrivateJson(alpha,{...key,value:last});
  assert.deepEqual(await storage.readPrivateJson(alpha,key),last);
  assert.deepEqual(await storage.listProjects(alpha),before,"autosaving choices never creates or replaces stories");
  assert.equal(await storage.readPrivateJson(beta,key),null,"different signed-in profile sees no review");
  const restarted=makeStore();
  try{
    assert.deepEqual(await restarted.readPrivateJson({...alpha,sessionId:"relogin"},key),last,
      "Continue Last Review returns the latest full exact selection manifest after a cold restart");
    assert.equal(await restarted.readPrivateJson(beta,key),null);
    assert.equal(last.sourceFingerprint,fingerprint("sources-A"));
    assert.notEqual(last.sourceFingerprint,fingerprint("changed-sources"),
      "source drift refuses blind reapplication");
  }finally{restarted.close()}
});
test("#2890 authenticated save/readback, resume guard, non-destructive refresh and protected finalization are wired",async()=>{
  const read=async file=>readFile(new URL("../"+file,import.meta.url),"utf8");
  const [api,browser,panel]=await Promise.all([
    read("app/api/auth/profile-private/route.ts"),
    read("core/storage/profile-private-browser.ts"),
    read("modules/library/ui/afterglow-management-panel.tsx"),
  ]);
  assert.match(api,/input.action === "save-afterglow-review-draft"/u);
  assert.match(api,/readback\) !== JSON.stringify\(draft\)/u);
  assert.match(api,/afterglowReviewDraft/u);
  assert.match(api,/input.action === "clear-afterglow-review-draft"/u);
  assert.match(api,/active.id !== expectedVerifiedMaster/u);
  assert.match(api,/typeof input\["masterId"\] === "string"/u);
  assert.match(browser,/queueWriteOperation\(async writeToken/u);
  assert.match(browser,/ack.selectionsDigest!==selectionsDigest/u);
  assert.match(browser,/await flushProfilePrivateWrites\(\)/u);
  assert.match(panel,/Continue Last Review/u);
  assert.match(panel,/Refresh Saved Versions/u);
  assert.match(panel,/Review Consolidation/u);
  assert.match(panel,/await afterglowInventoryDigest\(startingInventory\)/u);
  assert.match(panel,/resumeDraft.sourceFingerprint!==sourceFingerprint/u);
  const refresh=panel.slice(panel.indexOf("const refresh = useCallback"),panel.indexOf("async function reviewConsolidation"));
  assert.doesNotMatch(refresh,/setDecisions\(\{\}\)|setPreview\(null\)|setImageChoices\(\{\}\)/u);
  assert.match(panel,/await saveAfterglowReviewDraft\(\{[\s\S]*const receipt=await commitConsolidatedAfterglow/u);
  assert.match(panel,/if\(receipt.libraryRefreshed\)/u);
  assert.match(panel,/await clearAfterglowReviewDraft\(receipt.masterId\)/u);
  assert.match(panel,/withoutAfterglowReviewConfirmation\(previous,path!\)/u);
  assert.match(panel,/setPersistEmptyReview\(true\)/u);
  assert.match(panel,/if\(!hasSelections&&!persistEmptyReview\)return;/u);
});

test("#2890 exclude after confirming cannot poison encrypted autosave; explicit Reset remains empty after restart",async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"plotpickle-2890-reset-"));
  const makeStore=()=>createProfilePrivateStorageService({root,authService,
    normalizeProject:value=>structuredClone(value)});
  const storage=makeStore();
  t.after(async()=>{storage.close();await rm(root,{recursive:true,force:true})});
  const profile={sessionId:"first-session",profileId:"profile_review_reset"};
  const key={domain:"cache",objectId:"afterglow-review-draft"};
  const path="/storyDevelopment/fields/character~1joy";
  const previous=normalizeAfterglowReviewDraft(draft("same-sources"),"2026-10-10T00:01:00Z");
  await storage.writePrivateJson(profile,{...key,value:previous});

  const confirmations=withoutAfterglowReviewConfirmation(previous.selections.confirmedCurrent,path);
  assert.equal(Object.hasOwn(confirmations,path),false,"Exclude removes the prior confirmation key");
  assert.equal(previous.selections.confirmedCurrent[path],true,"original saved decisions are immutable");
  const excluded=normalizeAfterglowReviewDraft({version:1,
    sourceFingerprint:previous.sourceFingerprint,
    selections:{...previous.selections,confirmedCurrent:confirmations,
      exclusions:[...previous.selections.exclusions,path]}}, "2026-10-10T00:02:00Z");
  await storage.writePrivateJson(profile,{...key,value:excluded});
  assert.deepEqual(await storage.readPrivateJson(profile,key),excluded,
    "Exclude must be acknowledged by encrypted readback");
  assert.throws(()=>normalizeAfterglowReviewDraft({...draft("same-sources"),selections:{
    ...previous.selections,confirmedCurrent:{[path]:false}}}),/Invalid confirmation/u);

  // The UI's explicit Reset now sends this empty choice manifest instead of
  // skipping autosave, leaving stale earlier selections for Continue Last Review.
  const empty=normalizeAfterglowReviewDraft({version:1,
    sourceFingerprint:previous.sourceFingerprint,
    selections:{decisions:{},exclusions:[],imageChoices:{},confirmedCurrent:{}}},
  "2026-10-10T00:03:00Z");
  await storage.writePrivateJson(profile,{...key,value:empty});
  const restarted=makeStore();
  try {
    assert.deepEqual(await restarted.readPrivateJson({...profile,sessionId:"after-restart"},key),empty);
    assert.deepEqual(empty.selections,{decisions:{},exclusions:[],imageChoices:{},confirmedCurrent:{}});
    assert.notDeepEqual(empty.selections,previous.selections,
      "reopening after Reset must not resurrect the old choices");
  } finally { restarted.close(); }
});
