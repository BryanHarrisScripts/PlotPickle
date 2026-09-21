import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("#2327 recognizes both production public hostnames without changing local routing", async () => {
  const worker = await read("worker/index.ts");
  assert.match(worker, /PUBLIC_WEB_HOSTS = new Set\(\[[\s\S]*"plotpickle\.com"[\s\S]*"plotpickle\.avairis\.chatgpt\.site"[\s\S]*\]\)/u);
  assert.match(worker, /function isPublicWebHost\(hostname: string\)/u);
  assert.match(worker, /isPublicWebHost\(url\.hostname\)[\s\S]*url\.pathname === "\/skin-v1"/u);
  assert.match(worker, /isPublicWebHost\(url\.hostname\) && url\.pathname === "\/"/u);
  assert.match(worker, /publicUrl\.pathname = "\/site"/u);
  assert.match(worker, /withPublicWebRequest\(request, publicUrl\)/u);
  assert.doesNotMatch(worker, /PUBLIC_WEB_HOSTS[\s\S]*localhost|PUBLIC_WEB_HOSTS[\s\S]*127\.0\.0\.1/u);
});

test("#2327 publishes a complete in-site article for every September Radar date", async () => {
  const corpus = JSON.parse(await read("content/blog/posts.json"));
  const index = corpus.posts.find((post) => post.slug === "oss-radar-september-2026-by-date");
  assert.ok(index);

  const datedSections = index.sections.filter((section) => /^September \d{1,2}, 2026$/.test(section.heading));
  assert.equal(datedSections.length, 8);

  const expected = [
    ["September 20, 2026", "2026-09-20"],
    ["September 19, 2026", "2026-09-19"],
    ["September 18, 2026", "2026-09-18"],
    ["September 17, 2026", "2026-09-17"],
    ["September 16, 2026", "2026-09-16"],
    ["September 15, 2026", "2026-09-15"],
    ["September 14, 2026", "2026-09-14"],
    ["September 13, 2026", "2026-09-13"],
  ];

  for (const [heading, iso] of expected) {
    const post = corpus.posts.find((candidate) => candidate.slug === "oss-radar-" + iso);
    const sourceSection = datedSections.find((section) => section.heading === heading);
    assert.ok(post, "missing daily article for " + heading);
    assert.equal(post.status, "published");
    assert.equal(post.series, "OSS Radar");
    assert.equal(post.publishedAt, iso);
    assert.ok(post.sections.length >= 2);
    assert.deepEqual(post.sections[0].paragraphs, sourceSection.paragraphs);
    assert.ok(post.sources.some((source) => source.url.includes("github.com/BryanHarrisScripts/PlotPickle/issues/2014")));
  }
});

test("#2327 makes index dates internal links with visible keyboard focus", async () => {
  const [article, blogLib, css] = await Promise.all([
    read("app/blog/[slug]/page.tsx"),
    read("lib/public-site/blog.ts"),
    read("app/blog/blog.module.css"),
  ]);

  assert.match(article, /publicBlogPostForDateHeading/u);
  assert.match(article, /post\.slug === "oss-radar-september-2026-by-date"/u);
  assert.match(article, /href=\{"\/blog\/" \+ linkedPost\.slug\}/u);
  assert.match(article, /className=\{styles\.dateLink\}/u);
  assert.match(blogLib, /return publicBlogPost\(`oss-radar-\$\{isoDate\}`\)/u);
  assert.match(css, /\.dateLink:hover/u);
  assert.match(css, /\.dateLink:focus-visible/u);
  assert.match(css, /\.card:focus-visible/u);
  assert.match(css, /\.nav a:focus-visible/u);
});

test("#2327 keeps feed, JSON discovery, sitemap and provenance repository-owned", async () => {
  for (const path of [
    "app/blog/feed.xml/route.ts",
    "app/blog/index.json/route.ts",
    "app/sitemap.ts",
    "app/robots.ts",
    "scripts/write-public-source-provenance.mjs",
    "scripts/verify-public-site-drift.mjs",
  ]) {
    assert.ok((await read(path)).length > 0, path + " should remain present");
  }

  assert.match(await read("app/blog/feed.xml/route.ts"), /publishedBlogPosts\(\)/u);
  assert.match(await read("app/blog/index.json/route.ts"), /publishedBlogPosts\(\)/u);
  assert.match(await read("app/sitemap.ts"), /publishedBlogPosts\(\)/u);
  assert.match(await read("scripts/write-public-source-provenance.mjs"), /authority: "github-main"/u);
});
