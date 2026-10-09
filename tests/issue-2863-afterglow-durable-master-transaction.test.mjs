import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createProfilePrivateStorageService } from "../core/storage/profile-private/profile-private-storage-core.mjs";

const authService = {
  createProfileVaultCapability(context) {
    return {
      profileId: context.profileId ?? "profile_afterglow_2863",
      async wrapSecret({secret}) { return {payload: Buffer.from(secret).toString("base64")}; },
      async unwrapSecret({envelope}) { return Uint8Array.from(Buffer.from(envelope.payload, "base64")); },
    };
  },
  registerVaultCleanupHook() { return () => undefined; },
  resolveSession() { return {profileId:"profile_afterglow_2863"}; },
};
const makeProject = (id, note = id) => ({
  id, format:"2.0-foundation", title:"Afterglow", revision:0,
  createdAt:"2026-10-09T08:00:00.000Z", updatedAt:"2026-10-09T08:00:00.000Z",
  sourceEvidence:{referenceFixture:{sourceId:"afterglow-v9-complete-baseline"}},
  storyDevelopment:{fields:{["character:"+id]:{value:note,acceptedSource:"human"}}},
});
const hashProject = project => "sha256:"+createHash("sha256").update(JSON.stringify(project)).digest("hex");
async function setup(t, count, authorize) {
  const root = await mkdtemp(path.join(os.tmpdir(),"plotpickle-2863-master-"));
  const context = {sessionId:"session-2863",profileId:"profile_afterglow_2863"};
  const makeStore = (gate = authorize) => createProfilePrivateStorageService({
    root,authService,normalizeProject: project => structuredClone(project),
    ...(gate === undefined ? {} : {authorizeAfterglowMasterCommit:gate}),
  });
  const storage = makeStore();
  t.after(async()=>{storage.close();await rm(root,{recursive:true,force:true});});
  for(let i=0;i<count;i++) {
    await storage.saveProject(context,{
      project:makeProject("afterglow-source-"+i),
      summary:{sourceKind:"example",sourceId:"afterglow-v9"},activate:false,
    });
  }
  async function proofs(){
    const summaries=await storage.listProjects(context);
    return Promise.all(summaries.filter(s=>!s.archivedAt && s.sourceId==="afterglow-v9").map(async s=>{
      const p=await storage.loadProject(context,s.projectId);
      return {projectId:s.projectId,revision:p.revision,updatedAt:s.updatedAt,digest:hashProject(p)};
    }));
  }
  return {storage,root,context,makeStore,proofs,master:makeProject("afterglow-master-"+count,"Union of every accepted decision.")};
}
const allow = ({candidate,originals}) => Boolean(candidate && originals.length);
test("#2863 durable master stages encrypted bytes, atomically updates index, preserves N originals and reopens after restart",async t=>{
  for(const n of [1,4,50]) await t.test("N="+n,async t=>{
    const {storage,context,makeStore,proofs,master}=await setup(t,n,allow);
    const evidence=await proofs();
    const result=await storage.commitAfterglowMaster(context,{master,sources:evidence});
    assert.deepEqual(result,{masterId:master.id,sourceCount:n,archivedSourceCount:n,readbackVerified:true});
    const summaries=await storage.listProjects(context);
    assert.equal(summaries.filter(s=>!s.archivedAt && s.sourceId==="afterglow-v9").length,1);
    assert.equal(summaries.filter(s=>s.archivedAt && s.sourceId==="afterglow-v9").length,n);
    assert.deepEqual(await storage.loadActiveProject(context),master);
    for(const original of evidence){
      const saved=await storage.loadProject(context,original.projectId);
      assert.equal(hashProject(saved),original.digest,"original creative work must remain intact");
    }
    const restarted=makeStore();
    try{
      const reopened=await restarted.loadActiveProject({sessionId:"new-session",profileId:context.profileId});
      assert.deepEqual(reopened,master,"restart must resolve persisted registry, not old session cache");
    }finally{restarted.close();}
  });
});
test("#2863 no trusted independent approval gate means no master and no source archives",async t=>{
  const {storage,context,proofs,master}=await setup(t,4);
  await assert.rejects(storage.commitAfterglowMaster(context,{master,sources:await proofs()}),/trusted Afterglow media/);
  assert.equal(await storage.loadProject(context,master.id),null);
  assert.equal((await storage.listProjects(context)).filter(s=>s.archivedAt).length,0);
});
test("#2863 explicit trusted approval rejection cannot mutate the vault",async t=>{
  const {storage,context,proofs,master}=await setup(t,4,()=>false);
  await assert.rejects(storage.commitAfterglowMaster(context,{master,sources:await proofs()}),/Human confirmation/);
  assert.equal(await storage.loadProject(context,master.id),null);
  assert.equal((await storage.listProjects(context)).filter(s=>s.archivedAt).length,0);
});
test("#2863 missing, duplicate or extra source proofs cannot drop a working copy",async t=>{
  const {storage,context,proofs,master}=await setup(t,4,allow);
  const list=await proofs();
  for(const sources of [list.slice(1),[...list,list[0]],[...list,{...list[0],projectId:"unknown"}]]) {
    await assert.rejects(storage.commitAfterglowMaster(context,{master,sources}),/source set|duplicated/);
  }
  assert.equal(await storage.loadProject(context,master.id),null);
});
test("#2863 same revision and timestamp but changed source content invalidates the review",async t=>{
  const {storage,context,proofs,master}=await setup(t,4,allow);
  const captured=await proofs();
  const changed=makeProject("afterglow-source-2","A materially different answer.");
  await storage.saveProject(context,{project:changed,
    summary:{sourceKind:"example",sourceId:"afterglow-v9",updatedAt:changed.updatedAt},activate:false});
  await assert.rejects(storage.commitAfterglowMaster(context,{master,sources:captured}),/source changed/);
  assert.equal(await storage.loadProject(context,master.id),null);
  assert.equal((await storage.listProjects(context)).filter(s=>s.archivedAt).length,0);
});
test("#2863 no HTTP action or UI Save button exposes the internal transaction early",async()=>{
  const api=await readFile(new URL("../app/api/auth/profile-private/route.ts",import.meta.url),"utf8");
  const panel=await readFile(new URL("../modules/library/ui/afterglow-management-panel.tsx",import.meta.url),"utf8");
  assert.doesNotMatch(api,/commit-afterglow-master|commitAfterglowMaster/u);
  assert.doesNotMatch(panel,/onClick=\{\(\) => void commitAfterglowMaster/u);
  assert.match(panel,/No Save Current Master action is enabled/u);
});
