import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #345 gives About and licensing surfaces keyboard entry points", async () => {
  const about = await source("app/about/page.tsx");
  const legal = await source("app/legal/page.tsx");
  assert.match(about, /href="#about-main">Skip to main content<\/a>/);
  assert.match(about, /id="about-main" tabIndex=\{-1\}/);
  assert.match(about, /aria-label="About page sections"/);
  assert.match(legal, /href="#legal-main">Skip to main content<\/a>/);
  assert.match(legal, /id="legal-main" tabIndex=\{-1\}/);
  assert.match(legal, /aria-label="Licensing page sections"/);
});

test("issue #345 separates product, learning, legal and support destinations", async () => {
  const about = await source("app/about/page.tsx");
  const legal = await source("app/legal/page.tsx");
  for (const destination of [
    'href="/"',
    'href="/read-learn?module=why-plotpickle-works-in-layers"',
    'href="/legal"',
    'href="/suggest-report"',
  ]) assert.ok(about.includes(destination), `Missing About destination: ${destination}`);
  assert.match(about, /Choose the path that matches the problem/);
  assert.match(legal, /Use the right support path/);
  assert.match(legal, /href="\/suggest-report"/);
});

test("issue #345 announces external links and preserves ownership boundaries", async () => {
  const about = await source("app/about/page.tsx");
  const legal = await source("app/legal/page.tsx");
  assert.match(about, /opens in a new tab/);
  assert.match(legal, /opens in a new tab/);
  assert.match(legal, /Your story remains yours/);
  assert.match(legal, /does not transfer ownership/);
  assert.match(legal, /AGPL-3\.0-or-later/);
  assert.match(legal, /CC BY-SA 4\.0/);
  assert.match(legal, /not legal advice/);
});

test("issue #345 protects touch targets, safe areas, focus and reduced motion", async () => {
  const aboutCss = await source("app/about/about.module.css");
  const legalCss = await source("app/legal/legal.module.css");
  for (const css of [aboutCss, legalCss]) {
    assert.match(css, /min-height: 44px/);
    assert.match(css, /env\(safe-area-inset-top\)/);
    assert.match(css, /:focus-visible/);
    assert.match(css, /a\[target="_blank"\]::after/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(css, /scroll-margin-top/);
  }
});
