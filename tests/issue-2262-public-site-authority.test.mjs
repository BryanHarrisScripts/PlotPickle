import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderPublicBlogDraft } from "../lib/verification/oss-radar/blog-draft.mjs";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("#2262 keeps the existing ChatGPT Sites project binding and makes GitHub authoritative", async () => {
  const hosting = JSON.parse(await read(".openai/hosting.json"));
  const [worker, build, packageJson] = await Promise.all([
    read("worker/index.ts"),
    read("scripts/build-verified.mjs"),
    read("package.json"),
  ]);
  assert.equal(hosting.project_id, "appgprj_6a5e2646a06081918b0f4809b6af5cc6");
  assert.match(worker, /url\.hostname === "plotpickle\.com"/);
  assert.match(worker, /publicUrl\.pathname = "\/site"/);
  assert.match(worker, /www\.plotpickle\.com/);
  assert.match(build, /write-public-source-provenance\.mjs/);
  const pkg = JSON.parse(packageJson);
  assert.equal(pkg.scripts["site:verify-drift"], "node scripts\/verify-public-site-drift\.mjs".replace("\\/","/"));
});

test("#2262 checks the current live PlotPickle.com narrative into repository source", async () => {
  const site = await read("app/site/page.tsx");
  for (const phrase of [
    "A visual writer for the stories in your head",
    "Storywriting has changed.",
    "Now shape it.",
    "HUMAN-ONLY",
    "AI-OPTIONAL",
    "LOCAL-FIRST",
    "WRITER-CONTROLLED",
    "81 lessons",
    "24 story Blocks",
    "96 mini-Blocks",
    "Human, Node and Agent boundaries",
    "A writers&apos; hall connected by BUZZ.",
    "So what is a Plot Pickle?",
  ]) assert.ok(site.includes(phrase), "public site is missing: " + phrase);
});

test("#2262 keeps public web pages outside profile and legacy application gates", async () => {
  const [routes, profile, legacy, sitemap] = await Promise.all([
    read("app/public-web-route.ts"),
    read("app/profile-access/profile-access-router.tsx"),
    read("app/legacy-skin-only.tsx"),
    read("app/navigation/sitemap-route-context.ts"),
  ]);
  assert.match(routes, /pathname === "\/site"/);
  assert.match(routes, /pathname\.startsWith\("\/blog\/"\)/);
  assert.match(profile, /isPublicWebPath\(pathname\)/);
  assert.match(legacy, /isPublicWebPath\(pathname\)/);
  assert.match(sitemap, /Blog article/);
});

test("#2262 publishes Blog and machine-readable discovery from one versioned corpus", async () => {
  const corpus = JSON.parse(await read("content/blog/posts.json"));
  assert.equal(corpus.schemaVersion, 1);
  assert.ok(corpus.posts.length >= 2);
  assert.ok(corpus.posts.every((post) => post.status === "published"));
  for (const path of [
    "app/blog/page.tsx",
    "app/blog/[slug]/page.tsx",
    "app/blog/feed.xml/route.ts",
    "app/blog/index.json/route.ts",
    "app/llms.txt/route.ts",
    "app/sitemap.ts",
    "app/robots.ts",
  ]) assert.ok((await read(path)).length > 0, path + " should exist");
  assert.match(await read("app/llms.txt/route.ts"), /progressive discovery/i);
});

test("#2262 exposes exact-commit provenance and a fail-visible drift checker", async () => {
  const [writer, drift] = await Promise.all([
    read("scripts/write-public-source-provenance.mjs"),
    read("scripts/verify-public-site-drift.mjs"),
  ]);
  assert.match(writer, /rev-parse/);
  assert.match(writer, /public", "source\.json"/);
  assert.match(writer, /authority: "github-main"/);
  assert.match(drift, /Public-site drift/);
  assert.match(drift, /sourceCommit/);
});

test("#2262 OSS Radar produces a public draft without granting publication authority", () => {
  const draft = renderPublicBlogDraft({
    reportDate: "2026-09-19",
    candidates: [{
      fullName: "example/story-tool",
      url: "https://github.com/example/story-tool",
      description: "A story workflow tool.",
      matchedLaneIds: ["writer-craft"],
      license: "MIT",
      scoreEvidence: { secretInternalScore: 99 },
      plotPickleFit: "private roadmap issue #9999",
    }],
  });
  assert.match(draft, /status: draft/);
  assert.match(draft, /publicationAuthority: human-only/);
  assert.match(draft, /example\/story-tool/);
  assert.match(draft, /Human review is required/);
  assert.doesNotMatch(draft, /99|#9999|secretInternalScore/);
});

test("#2262 does not add Blog to the application navigation", async () => {
  const [page, shortcuts] = await Promise.all([
    read("app/page.tsx"),
    read("app/navigation/global-shortcuts.ts"),
  ]);
  assert.doesNotMatch(page, /href=["']\/blog/);
  assert.doesNotMatch(shortcuts, /label:\s*["']Blog["']/);
});
