import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

async function feedbackContract() {
  let compiled = stripTypeScriptTypes(await source("lib/product-feedback.ts"), { mode: "transform" });
  compiled = compiled.replace('import { PLOTPICKLE_REPOSITORY_URL } from "./product-direction";', 'const PLOTPICKLE_REPOSITORY_URL = "https://github.com/BryanHarrisScripts/PlotPickle";');
  return import(`data:text/javascript;base64,${Buffer.from(compiled, "utf8").toString("base64")}`);
}

test("issue #297 builds bounded sanitized official-repository drafts", async () => {
  const contract = await feedbackContract();
  const issue = contract.buildProductFeedbackIssue({
    kind: "bug",
    title: "A".repeat(180),
    description: "word ".repeat(2_000),
    reproduction: "step ".repeat(1_500),
    expected: "expected ".repeat(1_000),
    actual: "actual ".repeat(1_000),
    safeDiagnostics: "diagnostic ".repeat(500),
    privacyConfirmed: true,
  });
  assert.ok(issue.url.length < 8_000, `Issue URL is too large: ${issue.url.length}`);
  assert.match(issue.body, /## Privacy confirmation/);
  assert.match(issue.body, /- \[x\] The reporter confirmed/);
});

test("issue #297 redacts credentials, tokens, local paths and private repository links", async () => {
  const contract = await feedbackContract();
  const unsafe = "token=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456 C:\\Users\\Bryan\\AppData\\Local\\PlotPickle\\secret.json /Users/bryan/story/private.ppf sk-examplecredential12345";
  const safe = contract.redactProductFeedbackText(unsafe);
  assert.doesNotMatch(safe, /ghp_|C:\\Users|\/Users\/bryan|sk-example/);
  assert.match(safe, /redacted/gi);
  assert.doesNotMatch(contract.redactProductFeedbackText("See https://github.com/private-owner/private-story"), /private-owner|private-story/);
});
