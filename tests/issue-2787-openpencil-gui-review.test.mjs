import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createOpenPencilGuiController,
  OPENPENCIL_DESKTOP_VERSION,
  resolveOpenPencilCliLaunch,
  resolveOpenPencilDesktopLaunch,
  resolveOpenPencilSurface,
} from "../build/openpencil/openpencil-gui-runtime.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const json = async (path) => JSON.parse(await read(path));

test("#2787 Command requires an explicit named OpenPencil surface and preserves multi-word names", async () => {
  const [parser, conversation, adapter] = await Promise.all([
    read("app/_components/settings/openpencil-command.ts"),
    read("app/skin-v1/global-dsdd-conversation.tsx"),
    json("config/openpencil-adapter.json"),
  ]);

  assert.match(parser, /action: "open"; surfaceName: string/u);
  assert.match(parser, /action: "review"; surfaceName: string/u);
  assert.match(parser, /OpenPencil open <surface name>/u);
  assert.match(parser, /OpenPencil review <surface name>/u);
  assert.match(parser, /surfaceName = cleanRoot/u);
  assert.match(conversation, /body: JSON\.stringify\(\{ action: command\.action, surfaceName: command\.surfaceName \}\)/u);
  assert.match(conversation, /setDraft\(body\.result\.handoffDraft\)/u);
  assert.equal(adapter.command.contextAwareSurfaceInference, false);
  assert.equal(adapter.command.reviewHandoff.delivery, "github-issue");
  assert.equal(adapter.command.reviewHandoff.implementationPullRequest, false);
});

test("#2787 repository registry covers the explicit PlotPickle surface names without inferred routes", async () => {
  const registry = await json("designs/openpencil/surfaces.json");
  const expected = [
    "Learn", "Library", "Community", "Screening", "Reports",
    "Mind Map", "World Map", "Write", "Edit", "Refine",
    "Outline", "Storyboard", "Previs", "Timeline", "Rough Cut",
    "Deck", "Package", "Feedback",
    "Identity", "Wyrmwood", "Unwritten",
    "Foley", "Narration", "Music", "Settings", "Command",
  ];
  assert.deepEqual(registry.surfaces.map((surface) => surface.name), expected);
  for (const surface of registry.surfaces) {
    assert.equal(surface.file, "design.fig", surface.name);
    assert.equal(surface.page, surface.name, surface.name);
    assert.equal("route" in surface, false, surface.name);
  }
});

test("#2787 surface resolution is explicit, case-insensitive, multi-word, and workspace confined", async () => {
  const registry = await read("designs/openpencil/surfaces.json");
  const dependencies = {
    platform: "win32",
    repositoryRoot: "C:\\Repo",
    env: {},
    readText: async () => registry,
  };
  const timeline = await resolveOpenPencilSurface("timeline", dependencies);
  assert.equal(timeline.name, "Timeline");
  assert.equal(timeline.page, "Timeline");
  assert.equal(timeline.designFile, "C:\\Repo\\designs\\openpencil\\design.fig");

  const mindMap = await resolveOpenPencilSurface("Mind   Map", dependencies);
  assert.equal(mindMap.name, "Mind Map");
  assert.equal(mindMap.page, "Mind Map");

  await assert.rejects(
    resolveOpenPencilSurface("Current Page", dependencies),
    (error) => error?.message === "OPENPENCIL_SURFACE_UNKNOWN" && error.supported.includes("Timeline"),
  );
});

test("#2787 managed CLI and reviewed Desktop executable resolve without a shell", () => {
  assert.equal(OPENPENCIL_DESKTOP_VERSION, "0.15.1");
  const cli = "C:\\Users\\Bryan\\AppData\\Local\\PlotPickle\\tools\\openpencil\\node_modules\\@open-pencil\\cli\\bin\\openpencil.js";
  const desktop = "C:\\Users\\Bryan\\AppData\\Local\\Programs\\OpenPencil\\OpenPencil.exe";
  const found = new Set([cli, desktop]);

  assert.deepEqual(resolveOpenPencilCliLaunch({
    platform: "win32",
    env: { LOCALAPPDATA: "C:\\Users\\Bryan\\AppData\\Local", PATH: "" },
    nodeExecutable: "C:\\Program Files\\nodejs\\node.exe",
    exists: (value) => found.has(value),
  }), {
    executable: "C:\\Program Files\\nodejs\\node.exe",
    args: [cli],
    source: "plotpickle-managed",
  });

  assert.deepEqual(resolveOpenPencilDesktopLaunch({
    platform: "win32",
    env: { LOCALAPPDATA: "C:\\Users\\Bryan\\AppData\\Local" },
    exists: (value) => found.has(value),
  }), {
    executable: desktop,
    source: "installed",
  });
});

test("#2787 explicit GUI launch verifies the page then activates exactly that page in the running editor", async () => {
  const registry = await read("designs/openpencil/surfaces.json");
  const designFile = "C:\\Repo\\designs\\openpencil\\design.fig";
  const cli = "C:\\Users\\Bryan\\AppData\\Local\\PlotPickle\\tools\\openpencil\\node_modules\\@open-pencil\\cli\\bin\\openpencil.js";
  const desktop = "C:\\Users\\Bryan\\AppData\\Local\\Programs\\OpenPencil\\OpenPencil.exe";
  const found = new Set([designFile, cli, desktop]);
  const runs = [];
  const spawns = [];

  const controller = createOpenPencilGuiController({
    platform: "win32",
    repositoryRoot: "C:\\Repo",
    env: { LOCALAPPDATA: "C:\\Users\\Bryan\\AppData\\Local", PATH: "" },
    nodeExecutable: "C:\\Program Files\\nodejs\\node.exe",
    exists: (value) => found.has(value),
    readText: async () => registry,
    wait: async () => {},
    spawnProcess: (command, args, options) => {
      spawns.push({ command, args: [...args], options });
      return { unref() {} };
    },
    runProcess: async (command, args, options) => {
      runs.push({ command, args: [...args], options });
      if (args.includes("pages")) return { stdout: JSON.stringify([{ id: "0:4", name: "Timeline", nodes: 12 }]), stderr: "", code: 0 };
      if (args.includes("list")) return { stdout: JSON.stringify([{ id: "tab-1", path: designFile, active: true, pages: [] }]), stderr: "", code: 0 };
      if (args.includes("activate")) return { stdout: JSON.stringify({ ok: true }), stderr: "", code: 0 };
      throw new Error("unexpected CLI call: " + args.join(" "));
    },
  });

  const result = await controller.openSurface("Timeline");
  assert.equal(result.state, "ready");
  assert.equal(result.surface, "Timeline");
  assert.equal(result.page, "Timeline");
  assert.equal(spawns.length, 1);
  assert.equal(spawns[0].command, desktop);
  assert.deepEqual(spawns[0].args, [designFile]);
  assert.equal(spawns[0].options.shell, false);
  assert.equal(spawns[0].options.windowsHide, false);

  const activation = runs.find((run) => run.args.includes("activate"));
  assert.ok(activation);
  assert.ok(activation.args.includes("tab-1"));
  assert.deepEqual(activation.args.slice(-3), ["--page-id", "0:4", "--json"]);
});

test("#2787 GUI launch fails truthfully for missing registered artifacts rather than inventing a design", async () => {
  const registry = await read("designs/openpencil/surfaces.json");
  const base = {
    platform: "win32",
    repositoryRoot: "C:\\Repo",
    env: { LOCALAPPDATA: "C:\\Users\\Bryan\\AppData\\Local", PATH: "" },
    nodeExecutable: "C:\\node.exe",
    readText: async () => registry,
    wait: async () => {},
    runProcess: async () => ({ stdout: "[]", stderr: "", code: 0 }),
    spawnProcess: () => { throw new Error("must not launch"); },
  };
  const missingFile = createOpenPencilGuiController({ ...base, exists: () => false });
  await assert.rejects(missingFile.openSurface("Timeline"), /OPENPENCIL_DESIGN_FILE_MISSING/u);

  const designFile = "C:\\Repo\\designs\\openpencil\\design.fig";
  const cli = "C:\\Users\\Bryan\\AppData\\Local\\PlotPickle\\tools\\openpencil\\node_modules\\@open-pencil\\cli\\bin\\openpencil.js";
  const desktop = "C:\\Users\\Bryan\\AppData\\Local\\Programs\\OpenPencil\\OpenPencil.exe";
  const found = new Set([designFile, cli, desktop]);
  const missingPage = createOpenPencilGuiController({
    ...base,
    exists: (value) => found.has(value),
    runProcess: async () => ({ stdout: JSON.stringify([{ id: "0:1", name: "Other" }]), stderr: "", code: 0 }),
  });
  await assert.rejects(missingPage.openSurface("Timeline"), /OPENPENCIL_DESIGN_PAGE_MISSING/u);
});

test("#2787 design review uses repository-relative read-only Git evidence and stops at a GitHub issue handoff", async () => {
  const registry = await read("designs/openpencil/surfaces.json");
  const designFile = "C:\\Repo\\designs\\openpencil\\design.fig";
  const calls = [];
  const controller = createOpenPencilGuiController({
    platform: "win32",
    repositoryRoot: "C:\\Repo",
    env: {},
    exists: (value) => value === designFile,
    readText: async () => registry,
    runProcess: async (command, args, options) => {
      calls.push({ command, args: [...args], options });
      if (args[0] === "status") return { stdout: " M designs/openpencil/design.fig\n", stderr: "", code: 0 };
      if (args[0] === "diff") return { stdout: "1\t1\tdesigns/openpencil/design.fig\n", stderr: "", code: 0 };
      throw new Error("unexpected git call");
    },
  });
  const result = await controller.reviewSurface("Timeline");
  assert.equal(result.state, "review-ready");
  assert.match(result.handoffDraft, /GitHub issue/u);
  assert.match(result.handoffDraft, /Do not implement source code or create an implementation PR/u);
  assert.ok(calls.every((call) => call.command === "git"));
  assert.ok(calls.every((call) => call.args.at(-1) === "designs\\openpencil\\design.fig"));
  assert.ok(calls.every((call) => call.options.cwd === "C:\\Repo"));
});

test("#2787 startup prepares the pinned CLI/Desktop but never launches the GUI", async () => {
  const setup = await read("scripts/ensure-openpencil-mcp.ps1");
  assert.match(setup, /@open-pencil\/mcp@\$Version/u);
  assert.match(setup, /@open-pencil\/cli@\$Version/u);
  assert.match(setup, /OpenPencil_0\.15\.1_x64-setup\.exe/u);
  assert.match(setup, /5e06bc1b58afc80e16c7a5828fced68c3b3aa656b32c20f4fe9c651feab6f5f9/u);
  assert.match(setup, /Start-Process -FilePath \$installer -ArgumentList "\/S" -Wait -PassThru/u);
  assert.match(setup, /\$env:CI -ne "true"/u);
  assert.match(setup, /OpenPencil is not launched or connected during startup/u);
  assert.doesNotMatch(setup, /Start-Process -FilePath \$desktop/u);
});

test("#2787 GUI gateway remains inside the authenticated OpenPencil profile boundary", async () => {
  const [gateway, context, architecture] = await Promise.all([
    read("build/openpencil/openpencil-gui-gateway.ts"),
    read("build/auth/profile-request-context.ts"),
    read("docs/architecture/OPENPENCIL-DESIGN-BRIDGE.md"),
  ]);
  assert.match(context, /"\/api\/openpencil"/u);
  assert.match(gateway, /currentProfileRequestContext\(\)/u);
  assert.match(gateway, /acceptsDsddLoopbackRequest\(request, OPENPENCIL_GUI_API\)/u);
  assert.match(gateway, /action === "open"/u);
  assert.match(gateway, /action === "review"/u);
  assert.match(architecture, /Context-aware\/current-surface inference is outside the Phase 4 contract/u);
  assert.match(architecture, /GitHub issue/u);
  assert.match(architecture, /does not create an implementation pull request/u);
});
