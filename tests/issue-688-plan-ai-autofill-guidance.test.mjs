import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("each PLAN field exposes exactly three helper questions", async () => {
  const [contract, workspace] = await Promise.all([
    read("core/contracts/foundation-plan.ts"),
    read("modules/plan/ui/foundations-plan-workspace.tsx"),
  ]);

  assert.match(contract, /guidingQuestionsForFoundationField/);
  const helperMatch = contract.match(/export function guidingQuestionsForFoundationField[\s\S]*?\r?\n}\r?\n/);
  assert.ok(helperMatch, "the guidance helper should be present on LF or CRLF checkouts");
  const returnMatch = helperMatch[0].match(/return \[([\s\S]*?)\r?\n\s*\];/);
  assert.ok(returnMatch, "the guidance helper should return a literal three-item tuple");
  assert.equal((returnMatch[1].match(/^\s*(?:`|")/gm) ?? []).length, 3, "the guidance helper should return exactly three questions");
  assert.match(workspace, /guidingQuestionsForFoundationField\(field\)\.map/);
  assert.match(workspace, /Three questions to help you answer/);
});

test("selected PLAN AI drafts are inserted immediately without a second accept click", async () => {
  const workspace = await read("modules/plan/ui/foundations-plan-workspace.tsx");

  assert.match(workspace, /Use local AI to draft this answer/);
  assert.match(workspace, /const selectedFields = activeLesson\.fields\.filter/);
  assert.match(workspace, /function applyGeneratedDraft/);
  assert.match(workspace, /type: "foundations\.proposal\.store"/);
  assert.match(workspace, /type: "foundations\.proposal\.accept"/);
  assert.match(workspace, /applyGeneratedDraft\(lessonId, proposal\)/);
  assert.match(workspace, /setDraftFieldIds\(\[\]\)/);
  assert.match(workspace, /AI draft inserted into your editable fields/);
  assert.doesNotMatch(workspace, /Accept selected proposal into my fields/);
});

test("PLAN local generation targets two to four short paragraphs and hard-caps output at four", async () => {
  const drafter = await read("modules/plan/foundations-plan-drafter.ts");

  assert.match(drafter, /normalizeFoundationDraftParagraphs/);
  assert.match(drafter, /\.slice\(0, 4\)/);
  assert.match(drafter, /Aim for 2 short paragraphs per field/);
  assert.match(drafter, /Never exceed four paragraphs/);
  assert.match(drafter, /provider: "local"/);
  assert.doesNotMatch(drafter, /provider: "openai"|provider: "minimax"/);
});

test("PLAN still protects unselected fields by generating only selected IDs", async () => {
  const workspace = await read("modules/plan/ui/foundations-plan-workspace.tsx");
  assert.match(workspace, /fields: selectedFields/);
  assert.match(workspace, /Existing text in those selected fields will be replaced/);
  assert.match(workspace, /No answers selected for AI\. Manual writing remains unchanged/);
});

test("PLAN recovers failed Quality fields through the Fast local role before giving up", async () => {
  const drafter = await read("modules/plan/foundations-plan-drafter.ts");

  assert.match(drafter, /type PlanModelRole = "quality" \| "fast"/);
  assert.match(drafter, /function fastSingleFieldMessage/);
  assert.match(drafter, /\{ role: "quality", message: compactMessage/);
  assert.match(drafter, /\{ role: "fast", message: fastMessage/);
  assert.ok(drafter.indexOf('{ role: "quality", message: compactMessage') < drafter.indexOf('{ role: "fast", message: fastMessage'), "Quality should stay primary and Fast should be bounded recovery");
  assert.match(drafter, /"X-PlotPickle-Model-Role": modelRole/);
  assert.match(drafter, /modelRole,/);
  assert.match(drafter, /after Quality and Fast local recovery/);
});

test("a PPF can be reduced to read-only story evidence for PLAN Foundations", async () => {
  const [gateway, context, localGateway] = await Promise.all([
    read("build/foundations-ppf-gateway.ts"),
    read("lib/foundation-source-context.ts"),
    read("build/local-ai-gateway.ts"),
  ]);

  assert.match(gateway, /\/api\/plan\/foundations\/ppf-context/);
  assert.match(gateway, /parsePortableProjectFile\(text\)/);
  assert.match(gateway, /projectFromPackage\(buffer\)/);
  assert.match(gateway, /integrityValid/);
  assert.match(gateway, /assembleFoundationSourceContext\(project\)/);
  assert.match(gateway, /isLocalRequest\(request\)/);
  assert.match(localGateway, /registerFoundationsPpfGateway\(server\)/);
  assert.match(context, /project\.story\.premise/);
  assert.match(context, /project\.characters/);
  assert.match(context, /project\.blocks/);
  assert.doesNotMatch(context, /project\.collaboration|apiKey|password|providerConfiguration|privateLocalPath/);
});

test("PPF auto-complete fills only empty Foundations fields and saves the Foundations brief", async () => {
  const workspace = await read("modules/plan/ui/foundations-plan-workspace.tsx");
  const batchMatch = workspace.match(/async function autoCompleteAllFoundations\(\) \{[\s\S]*?\n  }\n\n  async function requestLocalDraft/);
  assert.ok(batchMatch, "the whole-Foundations auto-complete function should be present");
  const batch = batchMatch[0];

  assert.match(workspace, /Auto-complete Foundations only/);
  assert.match(batch, /!isUsableFoundationAnswer\(currentAnswers\[field\.id\]\)/);
  assert.match(batch, /sourceStoryContext: ppfSource\.context/);
  assert.match(batch, /type: "foundations\.proposal\.store"/);
  assert.match(batch, /type: "foundations\.proposal\.accept"/);
  assert.match(batch, /type: "foundations\.brief\.save"/);
  assert.doesNotMatch(batch, /type: "lesson\.|type: "foundations\.answer\.update"|BUILD|STORYBOARD|PREVIS|WRITE|EDIT|FEEDBACK|REFINE|REPORTS/);
});

test("the Foundations drafter treats imported PPF evidence as read-only source canon", async () => {
  const drafter = await read("modules/plan/foundations-plan-drafter.ts");

  assert.match(drafter, /readonly sourceStoryContext\?: string/);
  assert.match(drafter, /<source_story_context>/);
  assert.match(drafter, /Imported PPF evidence is read-only/);
  assert.match(drafter, /never alter or discuss unselected fields/i);
  assert.match(drafter, /provider: "local"/);
});

test("PLAN Foundations opens on a welcome choice before lesson editing", async () => {
  const workspace = await read("modules/plan/ui/foundations-plan-workspace.tsx");

  assert.match(workspace, /const \[showWelcome, setShowWelcome\] = useState\(true\)/);
  assert.match(workspace, /setShowWelcome\(!requested\)/);
  assert.match(workspace, /Foundations welcome choices/);
  assert.match(workspace, /Choose how you want to begin/);
  assert.match(workspace, /RECOMMENDED FOR AN EXISTING STORY · PPF AUTO-COMPLETE/);
  assert.match(workspace, /Or build Foundations yourself/);
  assert.match(workspace, /function openFoundationsWelcome\(\)/);
  assert.match(workspace, /url\.searchParams\.delete\("lesson"\)/);
  assert.match(workspace, /setShowWelcome\(false\)/);
  assert.match(workspace, /← Foundations welcome/);
});
