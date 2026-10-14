import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  validateNewStoryIntent,
  NEW_STORY_FORMATS,
} from "../modules/library/model/new-story-intent.mjs";
import {
  createProfileUserProject,
  initializeProfileProjectLibrary,
  listProfileProjectSummaries,
  projectLibraryProjectKey,
} from "../core/storage/project-library-core.mjs";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const NOW = "2026-10-13T19:00:00.000Z";
class MemoryStorage {
  values = new Map();
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.get(String(key)) ?? null; }
  setItem(key, value) { this.values.set(String(key), String(value)); }
  removeItem(key) { this.values.delete(String(key)); }
}
function harness(storage, profileId, ids) {
  const createProject = ({ id, now, title, storyIntent }) => ({
    id, title, createdAt: now, updatedAt: now, revision: 0,
    learning: { completedLessonIds: [] }, foundations: { lessons: {} },
    world: { lessons: {} }, build: { foundations: {}, world: {} },
    creativeRoom: { threadId: null }, storyIntent: storyIntent ?? null,
    structure: { blocks: Array.from({length:24},(_,i)=>({ number:i+1,miniBlocks:[{},{},{},{}] })) },
  });
  let next=0;
  return {
    storage, profileId, now:()=>NOW,
    idFactory:()=>ids[next++] ?? `generated-${next}`,
    createProject,
    normalizeProject:value=>value,
    describeProject:()=>({ progress:0, frontier:"Foundations",thumbnail:"" }),
  };
}

test("#2961 format and target runtime must be explicitly selected with an actual title", () => {
  assert.deepEqual(NEW_STORY_FORMATS, ["Short Film","Feature"]);
  assert.deepEqual(validateNewStoryIntent({title:"  Northern Lights  ",format:"Short Film",targetMinutes:"15"}),
    {title:"Northern Lights",format:"Short Film",targetMinutes:15});
  assert.deepEqual(validateNewStoryIntent({title:"Feature Draft",format:"Feature",targetMinutes:120}),
    {title:"Feature Draft",format:"Feature",targetMinutes:120});
  for (const candidate of [
    { title:"", format:"Short Film",targetMinutes:15 },
    { title:" ".repeat(6),format:"Feature",targetMinutes:120 },
    { title:"A",format:"",targetMinutes:15 },
    { title:"A",format:"Unknown",targetMinutes:15 },
    { title:"A",format:"Short Film",targetMinutes:"" },
    { title:"A",format:"Short Film",targetMinutes:0 },
    { title:"A",format:"Short Film",targetMinutes:2.5 },
    { title:"A",format:"Feature",targetMinutes:241 },
    { title:"x".repeat(161),format:"Feature",targetMinutes:120 },
  ]) {
    assert.throws(()=>validateNewStoryIntent(candidate),/title|format|minutes/i,JSON.stringify(candidate));
  }
});

test("#2961 core Library creates new exact user title, format and PPF intent without modifying older story", () => {
  const storage = new MemoryStorage();
  const profile = "profile-2961";
  const input = harness(storage,profile,["startup-placeholder","prior-feature","human-short"]);
  const prior = createProfileUserProject({...input,title:"Prior Feature",format:"Feature",
    storyIntent:{format:"Feature",targetMinutes:120}}).activeProject;
  const priorRaw=storage.getItem(projectLibraryProjectKey(profile,prior.id));
  const chosen = validateNewStoryIntent({title:"Human Short Film",format:"Short Film",targetMinutes:"13"});
  const created = createProfileUserProject({...input,title:chosen.title,format:chosen.format,
    storyIntent:{format:chosen.format,targetMinutes:chosen.targetMinutes}}).activeProject;
  assert.notEqual(created.id,prior.id,"new means new identity, not rename or overwrite");
  assert.equal(created.title,"Human Short Film");
  assert.deepEqual(created.storyIntent,{format:"Short Film",targetMinutes:13});
  assert.equal(created.structure.blocks.length,24,"intended duration may not resize film structure");
  assert.equal(created.structure.blocks.flatMap(b=>b.miniBlocks).length,96);
  assert.equal(storage.getItem(projectLibraryProjectKey(profile,prior.id)),priorRaw,"existing snapshot stays byte-identical");
  assert.equal(JSON.parse(storage.getItem(projectLibraryProjectKey(profile,created.id))).project.storyIntent.targetMinutes,13);
  const summaries=listProfileProjectSummaries(input);
  const short=summaries.find(x=>x.id===created.id);
  const feature=summaries.find(x=>x.id===prior.id);
  assert.equal(short.title,"Human Short Film");assert.equal(short.format,"Short Film");
  assert.equal(feature.title,"Prior Feature");assert.equal(feature.format,"Feature");
  const reloaded=initializeProfileProjectLibrary(input);
  assert.deepEqual(reloaded.activeProject.storyIntent,{format:"Short Film",targetMinutes:13},"actual profile registry + project roundtrip");
});

test("#2961 creation UI has explicit accessible Human choices, awaits encrypted persistence and prevents duplicate retry",async()=>{
  const source=await read("modules/library/ui/library-workspace.tsx");
  assert.match(source,/<h3>New Project<\/h3>/);
  assert.match(source,/>Create New Project<\/button>/);
  assert.match(source,/data-library-new-story-form="identity-intent"/);
  assert.match(source,/htmlFor="library-new-title"/);
  assert.match(source,/htmlFor="library-new-format"/);
  assert.match(source,/htmlFor="library-new-target-minutes"/);
  assert.match(source,/<option value="Short Film">Short Film<\/option>/);
  assert.match(source,/<option value="Feature">Feature<\/option>/);
  assert.match(source,/value=\{format\} required/);
  assert.match(source,/validateNewStoryIntent\(\{ title, format, targetMinutes \}\)/);
  assert.match(source,/validateNewStoryIntent\(request\)/);
  assert.match(source,/createLibraryUserProject\(\{\s*title: intent.title,\s*format: intent.format,\s*storyIntent: \{ format: intent.format, targetMinutes: intent.targetMinutes \}/);
  assert.match(source,/pendingNewStoryRef.current/);
  assert.match(source,/const previous = pending \? loadLibraryProjectSnapshot\(pending.projectId\) : null/);
  assert.match(source,/await persistActiveProfileProject\("", project.id\)/);
  assert.match(source,/await flushProfilePrivateWrites\(\)/);
  assert.match(source,/sessionActiveProjectId\(\) !== project.id/);
  assert.match(source,/intendedRuntime !== null \? ` · Target \$\{intendedRuntime\} min`/);
  assert.doesNotMatch(source,/createLibraryUserProject\(\{ title: "Untitled Story", format: "Feature" \}\)/);
});

test("#2961 canonical PPF normalizes optional intent and older saves preserve selected identity; defaults unchanged",async()=>{
  const [library,browser,core,structure] = await Promise.all([
    read("core/storage/library-project.ts"),read("core/storage/project-library-browser.ts"),
    read("core/storage/project-library-core.mjs"),read("core/project/story-structure-v2.ts")
  ]);
  assert.match(library,/export function normalizeLibraryStoryIntent\(value: unknown\)/);
  assert.match(library,/readonly storyIntent: LibraryStoryIntent \| null/);
  assert.match(library,/const storyIntent = normalizeLibraryStoryIntent\(source.storyIntent\)/);
  assert.match(browser,/input.storyIntent \? \{ storyIntent: input.storyIntent \}/);
  assert.match(browser,/initialized.activeProject\?\.storyIntent/);
  assert.match(core,/\.\.\.\(input.storyIntent \? \{ storyIntent: input.storyIntent \} : \{\}\)/);
  assert.match(structure,/STORY_BLOCK_COUNT = 24/);
  assert.match(structure,/MINI_BLOCKS_PER_BLOCK = 4/);
  assert.doesNotMatch(browser,/setItem\(["']plotpickle.project.v1/);
});
