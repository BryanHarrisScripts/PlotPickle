import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(source, before, after, path) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one match, found ${count}`);
  return source.replace(before, after);
}

const pagePath = "app/page.tsx";
let page = readFileSync(pagePath, "utf8");
page = replaceOnce(page, 'import Link from "next/link";\n', 'import MarketingSplash from "./marketing-splash";\n', pagePath);
const landingStart = page.indexOf("function LandingPage(");
const homeStart = page.indexOf("\nexport default function Home()", landingStart);
if (landingStart < 0 || homeStart < 0) throw new Error("app/page.tsx: could not locate LandingPage boundary");
page = `${page.slice(0, landingStart)}function LandingPage({ onEnter }: { onEnter: () => void }) {\n  return <MarketingSplash onEnter={onEnter} downloadUrl={WINDOWS_DOWNLOAD_URL} components={PRODUCT_COMPONENTS} />;\n}\n${page.slice(homeStart)}`;
writeFileSync(pagePath, page);

const renderedPath = "tests/rendered-html.test.mjs";
let rendered = readFileSync(renderedPath, "utf8");
const renderedStart = rendered.indexOf('test("renders the premium startup splash');
const renderedNext = rendered.indexOf('\ntest("registers the legal route', renderedStart);
if (renderedStart < 0 || renderedNext < 0) throw new Error("tests/rendered-html.test.mjs: could not locate root splash test");
const renderedTest = `test("renders the approved whole-film startup splash and preserves the local-first workspace contract", async () => {\n  const html = await render("/");\n  assert.match(html, developmentPreviewMeta);\n  for (const phrase of [\n    "PlotPickle Playhouse",\n    "Your whole film.",\n    "One canonical project.",\n    "Complete screenplay studio",\n    "81-module learning system",\n    "Visual continuity engine",\n    "Local-first ownership with optional AI",\n    "Distributed PlotPickle collaboration",\n    "An open film-development platform.",\n    "Complete installations. One approved film.",\n  ]) {\n    assert.ok(html.includes(phrase), "Rendered splash is missing: " + phrase);\n  }\n  assert.match(html, /\\/brand\\/favicon\\/plotpickle-icon-128\\.png/);\n\n  const [source, navigation, splash] = await Promise.all([\n    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),\n    readFile(new URL("../lib/product-direction.ts", import.meta.url), "utf8"),\n    readFile(new URL("../app/marketing-splash.tsx", import.meta.url), "utf8"),\n  ]);\n  for (const phrase of [\n    'id: "simpleStart", code: "SS", label: "Simple Start"',\n    'id: "overview", code: "OV", label: "Project Overview"',\n    'id: "structureMap", code: "ST", label: "Structure Map"',\n    "One story. Five connected workspaces.",\n    "Script Viewer",\n  ]) {\n    assert.ok(source.includes(phrase), "Root workspace source is missing: " + phrase);\n  }\n  assert.match(splash, /Copyright & licensing/);\n  assert.match(splash, /plotpickle-multi-server-collaboration\\.svg/);\n  assert.ok(navigation.includes('{ id: "reports", label: "Reports", description: "Understand the screenplay" }'));\n  assert.ok(navigation.includes('{ id: "dashboard", label: "Dashboard"'));\n  assert.ok(!source.includes("PlotPickle Online"), "Official product page should not advertise an online PlotPickle edition");\n});\n`;
rendered = `${rendered.slice(0, renderedStart)}${renderedTest}${rendered.slice(renderedNext)}`;
writeFileSync(renderedPath, rendered);

const splashPath = "app/marketing-splash.tsx";
let splash = readFileSync(splashPath, "utf8");
splash = replaceOnce(
  splash,
  '        <div className={styles.wrap}><span><strong>PlotPickle Playhouse</strong> · Local-first screenplay and film development</span><span>Open software · Optional AI · Writer-controlled canon</span></div>',
  '        <div className={styles.wrap}><span><strong>PlotPickle Playhouse</strong> · Local-first screenplay and film development</span><nav aria-label="PlotPickle information"><a href="/about">About</a><a href="/legal">Copyright & licensing</a><a href="https://github.com/BryanHarrisScripts/PlotPickle" target="_blank" rel="noreferrer">Source</a></nav><span>Open software · Optional AI · Writer-controlled canon</span></div>',
  splashPath,
);
writeFileSync(splashPath, splash);

const cssPath = "app/marketing-splash.module.css";
let css = readFileSync(cssPath, "utf8");
css = replaceOnce(css, '.footer strong{color:#fff}', '.footer strong{color:#fff}.footer nav{display:flex;gap:16px}.footer nav a{color:#d6e4e7;font-weight:760}.footer nav a:hover{color:#fff}', cssPath);
writeFileSync(cssPath, css);

console.log("Issue #102 splash integration applied.");
