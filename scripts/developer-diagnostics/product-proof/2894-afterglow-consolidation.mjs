import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { ensureVerificationTools } from "../../run-webmcp-startup-uat.mjs";
import { createVerificationSyntheticProfile, authenticateVerificationSyntheticProfile } from "../../full-verification-auth.mjs";

// Committed Afterglow media renders through the real surface/login/vault in an
// isolated verification profile. No Human profile or provider inference is used.
const artifactRoot = path.resolve(".artifacts/2894-afterglow-consolidation");
await mkdir(artifactRoot, { recursive: true });
const temporary = await mkdtemp(path.resolve("node_modules/.2894-rendered-"));
const previousHome = process.env.PLOTPICKLE_HOME;
const previousState = process.env.PLOTPICKLE_AUTH_STATE_PATH;
process.env.PLOTPICKLE_HOME = temporary;
process.env.PLOTPICKLE_AUTH_STATE_PATH = path.join(temporary, "auth/state.json");
let server, browser, runtime;
try {
  const serverFile = path.join(temporary, "gateway.mjs");
  await build({ stdin: { contents: 'export {localProfileAuthGateway} from "./build/local-profile-auth-gateway.ts";export {resetProfileExperienceRuntime} from "./core/auth/profile-experience/profile-experience-runtime.ts";', resolveDir: process.cwd(), loader: "ts" }, bundle: true, platform: "node", format: "esm", packages: "external", outfile: serverFile, logLevel: "silent" });
  runtime = await import(pathToFileURL(serverFile).href);
  const client = await build({ stdin: { contents: `
import React from "react";
import {createRoot} from "react-dom/client";
import Panel from "./modules/library/ui/afterglow-management-panel.tsx";
import packaged from "./data/afterglow-packaged-current/snapshot.json";
import {normalizeLibraryProject} from "./core/storage/library-project.ts";
import {saveFoundationProject} from "./core/storage/foundation-project-browser.ts";
import {hydrateProfilePrivateBrowser,flushProfilePrivateWrites} from "./core/storage/profile-private-browser.ts";
import {listAfterglowExampleProjects} from "./core/storage/project-library-browser.ts";
import {plotPickleCurriculum} from "./adapters/curriculum/current-catalog.ts";
import {buildStoryDevelopmentFields} from "./modules/learn/model/story-development-fields.ts";
const status=await (await fetch("/api/auth/profile")).json();
await hydrateProfilePrivateBrowser(status.profile.profileId,status.csrfToken);
if(!listAfterglowExampleProjects().length){
 const field=buildStoryDevelopmentFields(plotPickleCurriculum).find(f=>f.scope==="project-wide");
 for(let n=0;n<2;n++){
  const p=normalizeLibraryProject(packaged.project);p.id="rendered-2894-"+n;
  p[field.topicId].lessons[field.lessonId]={answers:{[field.fieldId]:"Synthetic reviewed story answer"},draftProposals:[]};
  if(n)p.build.foundations.visualArtifacts[0].sourceDecisionKeys.push("synthetic-recorded-bookkeeping");
  saveFoundationProject(p);await flushProfilePrivateWrites();
 }
}
createRoot(document.getElementById("root")).render(<Panel/>);
`, resolveDir: process.cwd(), loader: "tsx" }, bundle: true, platform: "browser", format: "esm", jsx: "automatic", outfile: "fixture.js", write: false, logLevel: "silent" });
  const javascript = client.outputFiles.find((file) => file.path.endsWith(".js")).text;
  const css = (await readFile("app/skin-v1-definition.css", "utf8")) + (client.outputFiles.find((file) => file.path.endsWith(".css"))?.text ?? "");
  const fonts = new Map(await Promise.all(["Regular", "SemiBold", "Bold"].map(async (weight) => { const url = `/fonts/jetbrains-mono/JetBrainsMono-${weight}.woff2`; return [url, await readFile(`public${url}`)]; })));
  const snapshot = JSON.parse(await readFile("data/afterglow-packaged-current/snapshot.json", "utf8"));
  const packagedImages = new Map(await Promise.all(snapshot.project.build.foundations.visualArtifacts
    .filter((item) => item.assetUrl.startsWith("/assets/library/examples/"))
    .map(async (item) => [item.assetUrl, await readFile(path.join("public", item.assetUrl))])));
  let middleware;
  runtime.localProfileAuthGateway().configureServer({ middlewares: { use(handler) { middleware = handler; } } });
  server = createServer((request, response) => middleware(request, response, () => {
    if (fonts.has(request.url)) { response.setHeader("Content-Type", "font/woff2"); response.end(fonts.get(request.url)); return; }
    if (packagedImages.has(request.url)) { response.setHeader("Content-Type", "image/webp"); response.end(packagedImages.get(request.url)); return; }
    if (request.url === "/fixture.js") { response.setHeader("Content-Type", "text/javascript"); response.end(javascript); return; }
    if (request.url === "/fixture.css") { response.setHeader("Content-Type", "text/css"); response.end(css); return; }
    if (request.url?.startsWith("/api/local-ai/assets/")) { response.setHeader("Content-Type", "image/svg+xml"); response.end('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#20364a"/><text x="160" y="180" fill="white" font-size="28">Synthetic Shot 1 fixture</text></svg>'); return; }
    response.setHeader("Content-Type", "text/html");
    response.end('<!doctype html><html data-plotpickle-skin="skin-v1"><head><title>Save/Lock product proof</title><link rel="stylesheet" href="/fixture.css"/><style>body{margin:24px;background:#0b1219;color:#e9edf3;font-family:Arial,sans-serif;--pp-surface:#162330;--pp-text:#e9edf3;--pp-border:#476075;--pp-accent:#77aedd}button{cursor:pointer}button:disabled{cursor:default}</style></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>');
  }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const profile = await createVerificationSyntheticProfile({ baseUrl, home: temporary });
  const session = await authenticateVerificationSyntheticProfile({ baseUrl, ...profile });
  let chromium;
  if (process.env.PLOTPICKLE_PRODUCT_PLAYWRIGHT_MODULE) {
    ({ chromium } = await import(pathToFileURL(path.resolve(process.env.PLOTPICKLE_PRODUCT_PLAYWRIGHT_MODULE)).href));
  } else {
    const tools = path.join(artifactRoot, "tools");
    await ensureVerificationTools(tools);
    ({ chromium } = createRequire(path.join(tools, "package.json"))("@playwright/test"));
  }
  browser = await chromium.launch({ headless: true,
    ...(process.env.PLOTPICKLE_PRODUCT_BROWSER_EXECUTABLE ? { executablePath: process.env.PLOTPICKLE_PRODUCT_BROWSER_EXECUTABLE } : {}),
    args: ["--disable-background-networking", "--disable-gpu", "--disable-software-rasterizer"],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const cookie = session.environment.PLOTPICKLE_VERIFICATION_AUTH_COOKIE.split("=");
  await context.addCookies([{ name: cookie[0], value: cookie.slice(1).join("="), url: baseUrl, httpOnly: true, sameSite: "Strict" }]);
  // This fixture is offline apart from its own loopback server.
  await context.route("**/*", (route) => new URL(route.request().url()).origin === baseUrl ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(baseUrl);
  await page.getByRole("button",{name:"Review Consolidation",exact:true}).click();
  await page.getByText("CONSOLIDATED creative work",{exact:true}).waitFor();
  await page.locator('details').evaluateAll(nodes=>nodes.forEach(node=>node.open=true));
  for(const button of await page.getByRole("button",{name:"Confirm current",exact:true}).all())await button.click();
  // Choose one image per character/view; the actual control excludes competitors.
  // Image cards are inside details; choose first unreviewed slot each pass.
  for(let n=0;n<150;n++){
    const unselected=page.locator('button[aria-pressed="false"]').filter({hasText:/^Keep$/});
    if(!await unselected.count())break;
    await unselected.first().click();
  }
  const save=page.getByRole("button",{name:"Save Consolidated Afterglow",exact:true});
  assert.equal(await save.isEnabled(),true,"completed creative review enables independent Save despite bookkeeping conflicts");
  assert.equal(await page.getByText(/Advanced verification details|Unresolved review items/).count(),0);
  await save.scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(artifactRoot,"ready-to-save.png")});
  await save.click();
  await page.getByText("Consolidated Afterglow saved successfully and verified in Library.",{exact:true}).waitFor({timeout:30000});
  await page.screenshot({path:path.join(artifactRoot,"saved.png")});
  assert.deepEqual(errors,[]);
  await page.reload();
  await page.getByRole("button",{name:"Review Consolidation",exact:true}).waitFor();
  const report={status:"PASS",sourceHead:process.env.PLOTPICKLE_PROOF_SOURCE_HEAD||"local-working-tree",scope:"Real Afterglow management, synthetic authenticated profile, compatible saved image bookkeeping and encrypted master commit",observations:["completed creative review enables Save","raw diagnostic cards are absent","server reconciles saved image bookkeeping","encrypted readback confirms consolidated master in Library","profile reopens after save"],providerInference:false,humanAcceptance:"PENDING"};
  await writeFile(path.join(artifactRoot,"proof.json"),JSON.stringify(report,null,2)+"\n");
  console.log("#2894 rendered consolidation proof PASS");
} finally {
  await browser?.close();
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  await runtime?.resetProfileExperienceRuntime();
  if (previousHome === undefined) delete process.env.PLOTPICKLE_HOME; else process.env.PLOTPICKLE_HOME = previousHome;
  if (previousState === undefined) delete process.env.PLOTPICKLE_AUTH_STATE_PATH; else process.env.PLOTPICKLE_AUTH_STATE_PATH = previousState;
  await rm(temporary, { recursive: true, force: true });
}
