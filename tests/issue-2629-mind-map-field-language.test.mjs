import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2629 canonical field actions use one consistent Human-facing language", async () => {
  const [surface, model] = await Promise.all([
    read("app/skin-v1/discovery-surface.tsx"),
    read("modules/learn/model/story-development-fields.ts"),
  ]);

  assert.match(model, /actionLabel: "Ask Agent"/u);
  assert.doesNotMatch(model, /actionLabel: `Create \$\{lesson\.title\} Proposal`/u);

  assert.match(surface, /"Save Changes"/u);
  assert.match(surface, /selectedField\.actionLabel/u);
  assert.match(surface, /"Use Suggestion"/u);
  assert.match(surface, /Asking Agent…/u);
  assert.doesNotMatch(surface, /Save \{field\.lessonTitle\}|Use Proposal|Creating Proposal…/u);
});

test("#2629 Project Value is explicit canonical truth and Agent Suggestion remains separate", async () => {
  const surface = await read("app/skin-v1/discovery-surface.tsx");

  assert.match(surface, /<span>PROJECT VALUE<\/span>/u);
  assert.match(surface, /className=\{styles\.projectValue\}/u);
  assert.match(surface, /AGENT SUGGESTION · editable before use/u);
  assert.match(surface, /A suggestion never replaces Project Value until you choose Use Suggestion/u);
  assert.match(surface, /acceptStoryDevelopmentFieldProposal/u);
  assert.match(surface, /writeStoryDevelopmentFieldValue/u);
});

test("#2629 Project Value uses a 1px semantic yellow border without hard-coded palette values", async () => {
  const css = await read("app/skin-v1/discovery-surface.module.css");
  const start = css.indexOf(".projectValue {");
  const end = css.indexOf(".fieldProposal {", start);
  const block = css.slice(start, end);

  assert.match(block, /border: 1px solid var\(--pp-skin-warning\)/u);
  assert.match(block, /color: var\(--pp-skin-warning\)/u);
  assert.match(block, /border-color: var\(--pp-skin-warning\)/u);
  assert.doesNotMatch(block, /#[0-9a-f]{3,8}|rgb\(/iu);
});

test("#2629 keeps canonical storage and Agent provenance unchanged", async () => {
  const adapter = await read("core/project/story-development.ts");
  assert.match(adapter, /field\.topicId === "foundations"[\s\S]*project\.foundations\.lessons/u);
  assert.match(adapter, /field\.topicId === "world"[\s\S]*project\.world\.lessons/u);
  assert.match(adapter, /source: "agent-proposal"/u);
  assert.match(adapter, /acceptedSource: input\.source/u);
});
