import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2643 canonical Mind Map pagination is data-driven with a six-field page size", async () => {
  const model = await read("modules/learn/model/story-development-fields.ts");

  assert.match(model, /export const MIND_MAP_FIELD_PAGE_SIZE = 6/u);
  assert.match(model, /Math\.max\(1, Math\.ceil\(fields\.length \/ MIND_MAP_FIELD_PAGE_SIZE\)\)/u);
  assert.match(model, /Math\.floor\(index \/ MIND_MAP_FIELD_PAGE_SIZE\) \+ 1/u);
  assert.match(model, /fields\.slice\(start, start \+ MIND_MAP_FIELD_PAGE_SIZE\)/u);

  const pages = (count) => Math.max(1, Math.ceil(count / 6));
  assert.equal(pages(33), 6);
  assert.equal(pages(5), 1);
  assert.equal(pages(10), 2);
  assert.equal(pages(5), 1);
  assert.equal(pages(14), 3);
});

test("#2643 Mind Map renders only the selected six-field page and hides the pager for one-page topics", async () => {
  const surface = await read("app/skin-v1/discovery-surface.tsx");

  assert.match(surface, /const \[selectedFieldPage, setSelectedFieldPage\] = useState\(1\)/u);
  assert.match(surface, /storyDevelopmentFieldPageCount\(selectedCanonicalFields\)/u);
  assert.match(surface, /storyDevelopmentFieldsForPage\(selectedCanonicalFields, selectedFieldPage\)/u);
  assert.match(surface, /selectedFieldPageCount > 1 \? \(/u);
  assert.match(surface, /data-mind-map-field-pager=\{selectedTopic\}/u);
  assert.match(surface, /data-mind-map-field-page=\{page\}/u);
  assert.match(surface, /aria-current=\{selectedFieldPage === page \? "page" : undefined\}/u);
  assert.match(surface, /\{visibleCanonicalFields\.map\(\(field\) => \{/u);
  assert.doesNotMatch(surface, /\{selectedCanonicalFields\.map\(\(field\) => \{/u);
});

test("#2643 topic changes reset to page one while deep-linked fields open their owning page", async () => {
  const surface = await read("app/skin-v1/discovery-surface.tsx");

  assert.match(surface, /function changeTopic\(topic: LearnTopicSpineId\) \{[\s\S]*setSelectedTopic\(topic\);[\s\S]*setSelectedFieldPage\(1\);/u);
  assert.match(surface, /const actFields = storyDevelopmentFieldsForAct\(topicFields, selectedAct\)/u);\n  assert.match(surface, /const targetPage = storyDevelopmentFieldPageForId\(actFields, initialFieldId\)/u);
  assert.match(surface, /if \(selectedFieldPage !== targetPage\) \{[\s\S]*setSelectedFieldPage\(targetPage\);[\s\S]*return;/u);
  assert.match(surface, /fieldDrafts\[storageId\] \?\? persisted\.value/u);
  assert.match(surface, /setFieldDrafts\(Object\.fromEntries\(scopedFieldViews\.map/u);
});

test("#2643 pager uses the same visible selected-state language as other Mind Map navigation", async () => {
  const css = await read("app/skin-v1/discovery-surface.module.css");

  assert.match(css, /\.fieldPager \{/u);
  assert.match(css, /\.fieldPager button\[aria-current="page"\]/u);
  assert.match(css, /\.fieldPager button \{[\s\S]*min-width: 2\.75rem;/u);
});
