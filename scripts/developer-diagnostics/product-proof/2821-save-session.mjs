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
const artifactRoot = path.resolve(".artifacts/2821-save-session");
await mkdir(artifactRoot, { recursive: true });
const temporary = await mkdtemp(path.resolve("node_modules/.2821-rendered-"));
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
import React,{useEffect,useState} from "react";
import {createRoot} from "react-dom/client";
import Storyboard from "./app/_components/storyboard/storyboard-readiness-workspace.tsx";
import {createEmptyProject} from "./core/project/project.ts";
import {applyStoryCommand} from "./core/project/apply-command.ts";
import packagedAfterglow from "./data/afterglow-packaged-current/snapshot.json";
import {loadFoundationProject,saveFoundationProject,FOUNDATION_PROJECT_SAVED_EVENT} from "./core/storage/foundation-project-browser.ts";
import {hydrateProfilePrivateBrowser,flushProfilePrivateWrites} from "./core/storage/profile-private-browser.ts";
import {switchActiveLibraryProject,loadLibraryProjectSnapshot,archiveLibraryProject} from "./core/storage/project-library-browser.ts";
const status=await (await fetch("/api/auth/profile")).json();
await hydrateProfilePrivateBrowser(status.profile.profileId,status.csrfToken);
if(!loadLibraryProjectSnapshot("rendered-2821")) {
 for(let i=0;i<4;i++){
  saveFoundationProject(createEmptyProject({id:"other-"+i,title:"Other story "+i,now:"2026-10-07T12:00:00.000Z"}));
  await flushProfilePrivateWrites();
  if(i<2){archiveLibraryProject("other-"+i);await flushProfilePrivateWrites();}
 }
 const original=packagedAfterglow.project;
 const chosen=original.build.foundations.visualArtifacts.find(item=>item.frameNumber===1&&item.workflow==="storyboard-frame-webp-v2"&&item.assetUrl.startsWith("/assets/library/examples/")&&item.sourceDecisionKeys.includes("storyboard-anchor:block:block-01:mini-1"));
 if(!chosen)throw new Error("Committed Afterglow Shot 1 is missing.");
 const base={...original,id:"rendered-2821",build:{...original.build,foundations:{...original.build.foundations,visualArtifacts:[],acceptedVisualArtifactIds:[]}}};
 const artifact={...chosen,sourceDecisionKeys:chosen.sourceDecisionKeys.filter(key=>key!=="storyboard-local-save:v1"),reviewState:"draft"};
 saveFoundationProject(applyStoryCommand(base,{type:"foundations.visual.store",artifact,occurredAt:base.updatedAt}));
 await flushProfilePrivateWrites();
} else {switchActiveLibraryProject("rendered-2821");await flushProfilePrivateWrites();}
function Harness(){const[project,setProject]=useState(loadFoundationProject);useEffect(()=>{const refresh=()=>setProject(loadFoundationProject());window.addEventListener(FOUNDATION_PROJECT_SAVED_EVENT,refresh);return()=>window.removeEventListener(FOUNDATION_PROJECT_SAVED_EVENT,refresh)},[]);return <Storyboard project={project} legacyProject={null} onProjectChange={setProject} onOpenBuild={()=>{}} onOpenPrevis={()=>{}} initialBlockNumber={1} initialMiniBlockNumber={1}/>;}
createRoot(document.getElementById("root")).render(<Harness/>);
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
  const controls = page.locator('[aria-label="Review Storyboard Image for Shot 1"]');
  await controls.waitFor();
  const writes = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/auth/profile-private") && request.method() === "POST") writes.push(request.postDataJSON());
  });
  await controls.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Shot 01 of 25 saved locally with this story.", { exact: true }).waitFor();
  assert.deepEqual(writes.filter((item) => item.action === "save-project").map((item) => item.project.id), ["rendered-2821"], "one rendered Save writes only Afterglow once");
  assert.equal(writes.filter((item) => item.action === "sync-library-index").length, 1);
  writes.length = 0;
  await controls.getByRole("button", { name: "Lock", exact: true }).click();
  await page.getByText("Shot 01 of 25 kept and locked.", { exact: true }).waitFor();
  await controls.getByText("Locked · Saved locally", { exact: true }).waitFor();
  assert.deepEqual(writes.filter((item) => item.action === "save-project").map((item) => item.project.id), ["rendered-2821"], "one rendered Lock writes only Afterglow once");
  await controls.locator("..").screenshot({ path: path.join(artifactRoot, "saved-locked.png") });
  await controls.getByRole("button", { name: "Unlock", exact: true }).click();
  await page.getByText("Shot 01 of 25 unlocked.", { exact: true }).waitFor();
  await controls.getByText("Saved locally", { exact: true }).waitFor();
  await page.route("**/api/auth/profile-private", (route) => route.request().method() === "POST"
    ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Injected encrypted write failure" }) }) : route.continue());
  await controls.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText(/Save failed: Injected encrypted write failure/u).waitFor();
  assert.equal(await controls.getByText("Saved locally", { exact: true }).count(), 0, "failed acknowledgement cannot display Saved locally");
  await controls.locator("..").screenshot({ path: path.join(artifactRoot, "save-failed.png") });
  await page.unroute("**/api/auth/profile-private");
  await controls.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Shot 01 of 25 saved locally with this story.", { exact: true }).waitFor();
  await controls.getByRole("button", { name: "Lock", exact: true }).click();
  await page.getByText("Shot 01 of 25 kept and locked.", { exact: true }).waitFor();
  // #2839 exercise the actual Create Narration and approval controls with a
  // bounded text-agent fixture; no provider inference or paid request.
  let narrationPayload;
  await page.route("**/api/previs/narration", async (route) => {
    narrationPayload = route.request().postDataJSON();
    assert.equal(narrationPayload.mode, "storyboard-shot");
    assert.equal("contactSheet" in narrationPayload, false);
    assert.equal("image" in narrationPayload, false);
    assert.ok(narrationPayload.passages.length);
    assert.ok(narrationPayload.shot.sceneBeat);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, panels: [{ position: 1, narration: "The moment hangs in silence.", bubbles: [] }] }) });
  });
  const handoff = page.locator('[data-storyboard-handoff-shot="1"]');
  await handoff.getByRole("button", { name: "Create Narration", exact: true }).click();
  await handoff.getByText("The moment hangs in silence.", { exact: true }).waitFor();
  assert.ok(narrationPayload, "rendered narration must submit text evidence");
  await handoff.screenshot({ path: path.join(artifactRoot, "narration-draft.png") });
  await handoff.getByRole("button", { name: "Approve text", exact: true }).click();
  await handoff.getByText("Narration / bubble approved for Previs and Timeline.", { exact: true }).waitFor();
  await page.reload();
  await controls.getByText("Locked · Saved locally", { exact: true }).waitFor();
  await controls.locator("..").screenshot({ path: path.join(artifactRoot, "reopened.png") });
  await handoff.getByText("The moment hangs in silence.", { exact: true }).waitFor();
  assert.equal(await handoff.getByRole("button", { name: "Approve text", exact: true }).count(), 0, "reopened text is approved, not a draft");
  await handoff.screenshot({ path: path.join(artifactRoot, "narration-reopened.png") });
  assert.deepEqual(errors, []);
  const report = { status: "PASS", sourceHead: process.env.PLOTPICKLE_PROOF_SOURCE_HEAD || "local-working-tree", scope: "Real Storyboard surface, committed packaged Afterglow image/story, local HTTP auth and encrypted vault in isolated verification profile", observations: ["enabled Save feedback", "one Save/Lock writes only Afterglow once in a five-story Library", "Lock and Unlock retain saved image", "failed write feedback and truthful saved badge", "retry and browser reload retain saved/locked state", "Storyboard Create Narration submits text-only shot facts", "approved short narration survives encrypted reload"], screenshots: ["saved-locked.png", "save-failed.png", "reopened.png", "narration-draft.png", "narration-reopened.png"], providerInference: false, humanAcceptance: "PENDING" };
  await writeFile(path.join(artifactRoot, "proof.json"), JSON.stringify(report, null, 2) + "\n");
  console.log("#2821 rendered Save/Lock/retry/reopen proof PASS");
} finally {
  await browser?.close();
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  await runtime?.resetProfileExperienceRuntime();
  if (previousHome === undefined) delete process.env.PLOTPICKLE_HOME; else process.env.PLOTPICKLE_HOME = previousHome;
  if (previousState === undefined) delete process.env.PLOTPICKLE_AUTH_STATE_PATH; else process.env.PLOTPICKLE_AUTH_STATE_PATH = previousState;
  await rm(temporary, { recursive: true, force: true });
}
