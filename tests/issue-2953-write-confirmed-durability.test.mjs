import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";
import test from "node:test";
import { moveWriteStoryPosition } from "../modules/write/model/write-position-navigation.mjs";

const read = async path => (await readFile(new URL(`../${path}`, import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const extractSave = source => {
  const start = source.indexOf("  async function save() {");
  const end = source.indexOf("  function useSourceAsStartingPoint()", start);
  assert.ok(start > 0 && end > start, "test must evaluate the real Write Save handler");
  return stripTypeScriptTypes(source.slice(start, end));
};
const wait = () => new Promise(resolve => setImmediate(resolve));

async function runSaveCase({ reject = false, changedProject = false, delayed = false } = {}) {
  const editor = await read("modules/write/ui/block-native-write-workspace.tsx");
  const state = { status: "", savedText: "old text", draftText: "New Human-authored text", project: { id: "imported-story", revision: 7, updatedAt: "2026-10-13T15:00:00.000Z", writing: {version:1,entries:[]}, sourceEvidence: {screenplay:{sourceText:"Immutable imported screenplay"}} }, saveCalls: [], confirmed: false, saving: false, profileId: "imported-story" };
  let resolve, rejectWrite;
  const commit = new Promise((yes,no) => {resolve=yes;rejectWrite=no;});
  const saveInFlightRef = { current:false }, unconfirmedLocalWriteRef = {current:null};
  const ctx = {
    project: state.project,
    address: {blockNumber:24,miniBlockNumber:4},
    draftText: state.draftText,
    savedText: state.savedText,
    dirty: true,
    saveInFlightRef,
    filmSaveInFlightRef: { current: false },
    unconfirmedLocalWriteRef,
    setSavingWorkingText(value) {state.saving=value;},
    setStatus(value) {state.status=value;},
    setProject(value) {state.project=value;state.saveCalls.push("local-cache");},
    setSavedText(value) {state.savedText=value;state.confirmed=true;},
    updateBlockWritingEntry(writing, address, value) {return {...writing,entries:[{...address,text:value}]};},
    saveActiveLibraryProject(value) {return value;},
    persistActiveProfileProject: async (token, id) => {state.saveCalls.push("encrypted-write:"+id);await commit;},
    flushProfilePrivateWrites: async () => {state.saveCalls.push("flush");},
    sessionActiveProjectId: () => state.profileId,
    revisionImpact: null, markCreativeRevisionDependentsStale: () => {throw new Error("no impact fixture");},
    Date, String, Error,
  };
  const fn = vm.runInNewContext(extractSave(editor)+"\nsave",ctx);
  const pending = fn();
  await wait();
  assert.equal(state.saving,true);
  assert.equal(state.confirmed,false,"optimistic cache update cannot be called Saved");
  assert.deepEqual(state.saveCalls,["local-cache","encrypted-write:imported-story"]);
  assert.equal(unconfirmedLocalWriteRef.current.key,"imported-story:24:4");
  if (changedProject) state.profileId="other-project";
  if(reject) rejectWrite(new Error("Injected encrypted vault write failure"));
  else resolve();
  await pending;
  if (reject || changedProject) {
    assert.equal(state.confirmed,false);
    assert.equal(state.savedText,"old text");
    assert.match(state.status,/Save not confirmed/);
    assert.equal(unconfirmedLocalWriteRef.current.text,state.draftText,"retain local unconfirmed recovery evidence");
  } else {
    assert.equal(state.confirmed,true);
    assert.equal(state.savedText,state.draftText);
    assert.match(state.status,/Encrypted Save confirmed for Block 24/);
    assert.equal(unconfirmedLocalWriteRef.current,null);
  }
  assert.equal(state.saving,false);
  assert.equal(saveInFlightRef.current,false);
  return state;
}

test("#2953 Write Save requires acknowledged encrypted persistence and flush before success", async () => {
  const state=await runSaveCase();
  assert.deepEqual(state.saveCalls,["local-cache","encrypted-write:imported-story","flush"]);
  assert.equal(state.project.sourceEvidence.screenplay.sourceText,"Immutable imported screenplay");
});

test("#2953 injected vault failure leaves editor unsaved and full immutable imported source", async () => {
  const state=await runSaveCase({reject:true});
  assert.deepEqual(state.saveCalls,["local-cache","encrypted-write:imported-story"]);
  assert.equal(state.project.sourceEvidence.screenplay.sourceText,"Immutable imported screenplay");
  assert.equal(state.project.writing.entries[0].text,state.draftText);
});

test("#2953 project identity switch during persistence cannot produce a false saved badge", async () => {
  await runSaveCase({changedProject:true});
});

test("#2953 unchanged Matrix navigation still accepts all 24 x 4 addresses without mutating evidence", () => {
  const readonlySource=Object.freeze({text:"Original immutable script",id:"source-1"});
  const project=Object.freeze({id:"imported-story",sourceEvidence:readonlySource});
  for (let block=1;block<=24;block++)for(let mini=1;mini<=4;mini++){
    const calls=[];
    const href="http://127.0.0.1:4174/skin-v1?workspace=write&block=1&mini=1";
    const to=moveWriteStoryPosition({locationHref:href,history:{state:{projectId:project.id},replaceState(state,unused,target){calls.push({state,target});}},blockNumber:block,miniBlockNumber:mini,dirty:false,confirmDiscard(){throw new Error("clean navigation never confirms");}});
    assert.equal(to.blockNumber,block);assert.equal(to.miniBlockNumber,mini);
    assert.match(calls[0].target,/^\/skin-v1\?workspace=write&block=/);
    assert.equal(calls[0].state.projectId,project.id);
    assert.strictEqual(project.sourceEvidence,readonlySource);
  }
});

test("#2953 pending Save and unsaved exit controls enforce user authority", async () => {
  const source=await read("modules/write/ui/block-native-write-workspace.tsx");
  const editorReset=source.slice(source.indexOf("  useEffect(() => {\n    const key ="),source.indexOf("  if (!project) return"));
  assert.match(editorReset,/unconfirmedLocalWriteRef\.current/);
  assert.match(editorReset,/draftText !== savedText/);
  const pick=source.slice(source.indexOf("  function selectAddress("),source.indexOf("  async function save()"));
  assert.match(pick,/saveInFlightRef\.current/);
  assert.match(pick,/confirmDiscard/);
  assert.match(pick,/navigateFromWrite/);
  for(const destination of ["pageFlowHref","storyLearningHref"]){
    assert.match(source,new RegExp("navigateFromWrite\\("+destination+"\\("));
  }
  const outline=source.slice(source.indexOf("  function openOutlineFromWrite()"),source.indexOf("  async function save()"));
  assert.match(outline,/saveInFlightRef\.current \|\| filmSaveInFlightRef\.current/);
  assert.match(outline,/dirty && !window\.confirm/);
  assert.match(outline,/onOpenOutline\(address\)/);
  assert.doesNotMatch(outline,/window\.location\.assign/);
  assert.match(source,/disabled=\{!dirty \|\| savingWorkingText\}/);
  assert.match(source,/Encrypted Save pending/);
  assert.doesNotMatch(source,/window\.location\.assign\(storyLearningHref/);
  assert.doesNotMatch(source,/window\.location\.assign\(pageFlowHref/);
});
