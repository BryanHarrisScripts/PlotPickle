import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseCmdSourceProposal, createCmdSourceProposalSession } from "../core/contracts/imported-screenplay-evidence/cmd-source-proposal.mjs";

const fixture = () => ({
  id: "synthetic-ppf-only", title: "Synthetic imported film", revision: 4, storyIntent: null,
  sourceEvidence: { screenplay: { sourceFileName: "synthetic.fdx", sourceFormat: "fdx",
    analysisStatus: "suggested", passagesTruncated: false, totalPassageCount: 3, storedPassageCount: 3,
    passages: [
      { id: "source-a", blockNumber: 1, miniBlockNumber: 1, sceneNumber: 1, type: "scene_heading", text: "INT. LIBRARY - DAY" },
      { id: "source-b", blockNumber: 1, miniBlockNumber: 1, sceneNumber: 1, type: "dialogue", text: "Nia: I borrowed the compass." },
      { id: "source-c", blockNumber: 1, miniBlockNumber: 2, sceneNumber: 2, type: "action", text: "Taro walks away." },
    ] } },
  storyDevelopment: { fields: {
    "foundations:logline:output-1": { value: "Existing accepted pitch", acceptedSource: "human", proposal: "", proposalSourceRef: null },
    "world:setting:output-1": { value: "", acceptedSource: null, proposal: "", proposalSourceRef: null },
    "world:existing:output-1": { value: "Approved existing world", acceptedSource: "human", proposal: "A previous saved proposal", proposalSourceRef: "source-c" },
  } },
  worldMap: { characterVisuals: [{ characterId: "synth", lockedVersionId: "never-touch", references: [] }] },
});
const fields = [
  { canonicalId: "foundations:logline:output-1", topicId: "foundations", lessonTitle: "Logline", fieldId: "output-1", scope: "project-wide" },
  { canonicalId: "world:setting:output-1", topicId: "world", lessonTitle: "Setting", fieldId: "output-1", scope: "repeatable-by-act" },
  { canonicalId: "world:existing:output-1", topicId: "world", lessonTitle: "Existing", fieldId: "output-1" },
  { canonicalId: "character:engine:output-1", topicId: "character", lessonTitle: "Engine", fieldId: "output-1" },
];
function harness() {
  let project = fixture();
  let profileId = "synthetic-human";
  let activeProjectId = project.id;
  let now = 10_000;
  let saves = 0, requestedInference = 0;
  const session = createCmdSourceProposalSession({
    snapshot: async () => ({ profileId, activeProjectId, project }),
    fields: async () => fields,
    token: () => "0123456789abcdef",
    now: () => now,
    save: async ({ project: before, field, proposal, passageId, expectedRevision, profileId: pinned }) => {
      saves++;
      assert.equal(pinned, profileId);
      assert.equal(project.id, before.id);
      assert.equal(project.revision, expectedRevision);
      assert.ok(project.sourceEvidence.screenplay.passages.some(p => p.id === passageId));
      const prior = project.storyDevelopment.fields[field.canonicalId] || { value: "", acceptedSource: null };
      project = { ...project, revision: project.revision + 1, storyDevelopment: {
        ...project.storyDevelopment, fields: { ...project.storyDevelopment.fields, [field.canonicalId]: {
          ...prior, proposal, proposalSourceRef: passageId, proposalGeneratedAt: "synthetic-time",
        } },
      } };
      return project;
    },
  });
  return { session, project: () => project, saves: () => saves, inference: () => requestedInference,
    advance: value => { now += value; }, changeProfile: () => { profileId = "other-human"; },
    changeActiveProject: () => { activeProjectId = "different-ppf"; },
    changeSource: () => { project.sourceEvidence.screenplay.passages[1].text = "Source changed after preview."; },
    changeRevision: () => { project.revision++; },
    truncate: () => { project.sourceEvidence.screenplay.passagesTruncated = true; },
    duplicate: () => { project.sourceEvidence.screenplay.passages[1].id = "source-a"; },
  };
}
test("#3004 grammar uses only bounded Mind Map / World Map source operations", () => {
  assert.deepEqual(parseCmdSourceProposal("PlotPickle mind-map fields foundations"), { action: "fields", area: "mind-map", topic: "foundations" });
  assert.deepEqual(parseCmdSourceProposal("PlotPickle world-map fields"), { action: "fields", area: "world-map", topic: "world" });
  assert.deepEqual(parseCmdSourceProposal("PlotPickle mind-map source Block 01 Mini 01"), { action: "source", area: "mind-map", block: 1, mini: 1 });
  assert.deepEqual(parseCmdSourceProposal("PlotPickle mind-map propose foundations:logline:output-1 from source-b"), { action: "propose", area: "mind-map", fieldId: "foundations:logline:output-1", passageId: "source-b" });
  assert.deepEqual(parseCmdSourceProposal("PlotPickle world-map confirm 0123456789abcdef"), { action: "confirm", area: "world-map", token: "0123456789abcdef" });
  assert.deepEqual(parseCmdSourceProposal("PlotPickle mind-map review foundations:logline:output-1"), { action: "review", area: "mind-map", fieldId: "foundations:logline:output-1" });
  assert.equal(parseCmdSourceProposal("PlotPickle world-map review INVALID=KEY").action, "invalid");
  assert.equal(parseCmdSourceProposal("PlotPickle world-map source Block 25 Mini 01").action, "invalid");
  assert.equal(parseCmdSourceProposal("PlotPickle mind-map source Block 01 Mini 05").action, "invalid");
  assert.equal(parseCmdSourceProposal("PlotPickle mind-map propose KEY=SECRET from source-a").action, "invalid");
  assert.equal(parseCmdSourceProposal("Please write a screenplay"), null);
  assert.equal(parseCmdSourceProposal("PlotPickle produce Block 01"), null);
});
test("#3004 source inspection and canonical fields are read-only with original passage IDs, not fabricated canon", async () => {
  const h = harness(); const before = structuredClone(h.project());
  const f = await h.session.execute({ action: "fields", area: "world-map", topic: "world" });
  assert.match(f, /world:setting:output-1/);
  assert.doesNotMatch(f, /character:engine:output-1/);
  const source = await h.session.execute({ action: "source", area: "mind-map", block: 1, mini: 1 });
  assert.match(source, /source-a \| scene_heading \| scene 1/);
  assert.match(source, /source-b \| dialogue \| scene 1/);
  assert.doesNotMatch(source, /source-c/);
  assert.doesNotMatch(source, /Nia: I borrowed/, "inventory lists IDs, not screenplay passages");
  assert.deepEqual(h.project(), before);
  assert.equal(h.saves(), 0); assert.equal(h.inference(), 0);
});
test("#3004 explicit preview and one-use confirmation save ONLY unaccepted proposal with exact source ID; no canon mutation", async () => {
  const h = harness(); const before = structuredClone(h.project());
  const action = parseCmdSourceProposal("PlotPickle mind-map propose foundations:logline:output-1 from source-b");
  const preview = await h.session.execute(action);
  assert.match(preview, /DERIVED-UNVERIFIED/);
  assert.match(preview, /Nia: I borrowed the compass/);
  assert.match(preview, /PlotPickle mind-map confirm 0123456789abcdef/);
  assert.equal(h.saves(), 0);
  const outcome = await h.session.execute(parseCmdSourceProposal("PlotPickle mind-map confirm 0123456789abcdef"));
  assert.match(outcome, /SAVED UNACCEPTED FIELD PROPOSAL/);
  assert.equal(h.saves(), 1);
  assert.equal(h.project().revision, 5);
  assert.equal(h.project().storyDevelopment.fields["foundations:logline:output-1"].acceptedSource, "human");
  assert.equal(h.project().storyDevelopment.fields["foundations:logline:output-1"].value, "Existing accepted pitch");
  assert.equal(h.project().storyDevelopment.fields["foundations:logline:output-1"].proposalSourceRef, "source-b");
  assert.deepEqual(h.project().sourceEvidence, before.sourceEvidence);
  assert.deepEqual(h.project().worldMap, before.worldMap);
  assert.equal(h.project().storyIntent, null);
  assert.equal(h.inference(), 0);
  assert.match(await h.session.execute(parseCmdSourceProposal("PlotPickle mind-map confirm 0123456789abcdef")), /BLOCKED/);
});
test("#3004 World Map uses existing textual world field proposal slot, never fake character images", async () => {
  const h = harness();const preview = await h.session.execute(parseCmdSourceProposal("PlotPickle world-map propose world:setting:output-1 from source-a"));
  assert.match(preview, /SOURCE-LINKED UNVERIFIED DRAFT/);
  assert.match(await h.session.execute(parseCmdSourceProposal("PlotPickle world-map confirm 0123456789abcdef")), /SAVED UNACCEPTED/);
  assert.equal(h.project().storyDevelopment.fields["world:setting:output-1"].proposalSourceRef, "source-a");
  assert.equal(h.project().worldMap.characterVisuals[0].lockedVersionId, "never-touch");
});
test("#3004 source proposals fail closed for wrong field, overwritten draft, truncated/duplicated source", async () => {
  const h = harness();
  assert.match(await h.session.execute(parseCmdSourceProposal("PlotPickle world-map propose character:engine:output-1 from source-a")), /BLOCKED/);
  assert.match(await h.session.execute(parseCmdSourceProposal("PlotPickle mind-map propose world:existing:output-1 from source-a")), /already contains a saved draft/);
  assert.match(await h.session.execute(parseCmdSourceProposal("PlotPickle mind-map propose foundations:logline:output-1 from fake-id")), /BLOCKED/);
  h.duplicate();
  assert.match(await h.session.execute(parseCmdSourceProposal("PlotPickle mind-map propose foundations:logline:output-1 from source-a")), /duplicate passage IDs/);
  const j = harness();j.truncate();
  assert.match(await j.session.execute(parseCmdSourceProposal("PlotPickle world-map propose world:setting:output-1 from source-a")), /Complete retained/);
  assert.equal(h.saves()+j.saves(), 0);
});
test("#3004 expired preview, changing source revision, profile and selected story prevent any write", async () => {
  for(const mutate of ["advance", "changeProfile", "changeActiveProject", "changeRevision", "changeSource"]) {
    const h = harness();
    await h.session.execute(parseCmdSourceProposal("PlotPickle mind-map propose foundations:logline:output-1 from source-b"));
    mutate === "advance" ? h.advance(120_001) : h[mutate]();
    const result = await h.session.execute(parseCmdSourceProposal("PlotPickle mind-map confirm 0123456789abcdef"));
    assert.match(result, /BLOCKED/, mutate); assert.equal(h.saves(), 0, mutate);
  }
});
test("#3004 cancellation and mismatched area tokens never write, nor replay after failure", async () => {
  const h=harness();
  await h.session.execute(parseCmdSourceProposal("PlotPickle mind-map propose foundations:logline:output-1 from source-a"));
  assert.match(await h.session.execute(parseCmdSourceProposal("PlotPickle world-map confirm 0123456789abcdef")), /BLOCKED/);
  assert.equal(h.saves(),0);
  await h.session.execute(parseCmdSourceProposal("PlotPickle mind-map propose foundations:logline:output-1 from source-a"));
  assert.match(await h.session.execute(parseCmdSourceProposal("PlotPickle mind-map cancel")), /CANCELLED/);
  assert.match(await h.session.execute(parseCmdSourceProposal("PlotPickle mind-map confirm 0123456789abcdef")), /BLOCKED/);
  assert.equal(h.saves(),0);
});
test("#3004 source proposal CMD uses durable canonical PPF writer and is dispatched before DSDD narration", async () => {
  const s=await readFile(new URL("../app/skin-v1/global-dsdd-conversation.tsx",import.meta.url),"utf8");
  const owner=await readFile(new URL("../core/project/story-development.ts",import.meta.url),"utf8");
  assert.match(s,/if \(await runCmdSourceProposal\(submitted\)\) return;/u);
  assert.match(s,/writeStoryDevelopmentFieldProposal\(/u);
  assert.match(s,/saveFoundationProjectDurably\(candidate, expectedRevision\)/u);
  assert.match(s,/profilePrivateBrowserReadyFor\(profileId\)/u);
  assert.match(owner,/proposalSourceRef: input.sourceRef/u);
  assert.doesNotMatch(s.slice(s.indexOf("async function runCmdSourceProposal"),s.indexOf("const agentHealthSession")),/\/api\/local-ai\/generate/);
});

test("#3004 Phase 3 review reads persisted source-linked proposal without promoting accepted source, changing revision or calling inference", async () => {
  const h = harness();
  await h.session.execute(parseCmdSourceProposal("PlotPickle mind-map propose foundations:logline:output-1 from source-b"));
  await h.session.execute(parseCmdSourceProposal("PlotPickle mind-map confirm 0123456789abcdef"));
  const before = structuredClone(h.project()), saves = h.saves();
  const readback = await h.session.execute(parseCmdSourceProposal("PlotPickle mind-map review foundations:logline:output-1"));
  assert.match(readback, /READ-ONLY.*NOT HUMAN-APPROVED/);
  assert.match(readback, /Direct imported-passage quote: VERIFIED/);
  assert.match(readback, /source-b/);
  assert.match(readback, /Existing accepted authority: human/);
  assert.match(readback, /Nia: I borrowed the compass/);
  assert.deepEqual(h.project(), before);
  assert.equal(h.saves(), saves);
  assert.equal(h.inference(), 0);
});

test("#3004 Phase 3 review refuses false provenance for saved edits and never treats quote as accepted canon", async () => {
  const h = harness(), before = structuredClone(h.project());
  const edited = await h.session.execute(parseCmdSourceProposal("PlotPickle world-map review world:existing:output-1"));
  assert.match(edited, /NOT VERIFIED/);
  assert.match(edited, /A previous saved proposal/);
  assert.match(edited, /NOT HUMAN-APPROVED/);
  assert.doesNotMatch(edited, /Direct imported-passage quote: VERIFIED/);
  const missing = await h.session.execute(parseCmdSourceProposal("PlotPickle world-map review world:setting:output-1"));
  assert.match(missing, /NO SAVED UNACCEPTED PROPOSAL/);
  assert.match(await h.session.execute(parseCmdSourceProposal("PlotPickle world-map review character:engine:output-1")), /BLOCKED/);
  h.changeProfile();
  assert.match(await h.session.execute(parseCmdSourceProposal("PlotPickle world-map review world:existing:output-1")), /BLOCKED/);
  assert.deepEqual(h.project(), before);
  assert.equal(h.saves(), 0);
});
