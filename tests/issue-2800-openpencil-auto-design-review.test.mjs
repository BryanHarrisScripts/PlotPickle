import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createOpenPencilDesignReviewPublisher } from "../build/openpencil/openpencil-design-review-publisher.mjs";

function hash(value) {
  return createHash("sha256").update(Buffer.from(value)).digest("hex");
}

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-2800-"));
  const stateRoot = path.join(root, "state");
  const designFile = path.join(root, "designs", "openpencil", "timeline-live.fig");
  await import("node:fs/promises").then(({ mkdir }) => mkdir(path.dirname(designFile), { recursive: true }));
  await writeFile(designFile, "before-design", "utf8");
  return {
    root,
    stateRoot,
    designFile,
    target: {
      name: "Timeline",
      page: "Timeline",
      designFile,
      relativeFile: "timeline-live.fig",
    },
  };
}

test("#2800 publishes one saved OpenPencil design through an isolated branch and GitHub issue", async (t) => {
  const fx = await fixture();
  t.after(() => rm(fx.root, { recursive: true, force: true }));
  const calls = [];
  let issueBody = "";

  const publisher = createOpenPencilDesignReviewPublisher({
    repositoryRoot: fx.root,
    stateRoot: fx.stateRoot,
    env: {},
    randomId: () => "session-2800",
    now: () => new Date("2026-10-06T18:10:00.000Z"),
    runProcess: async (command, args, options) => {
      calls.push({ command, args: [...args], cwd: options.cwd });
      if (command === "git" && args[0] === "rev-parse" && args[1] === "origin/main") {
        return { stdout: "base-main-sha\n", stderr: "", code: 0 };
      }
      if (command === "gh" && args[0] === "auth") return { stdout: "ok\n", stderr: "", code: 0 };
      if (command === "git" && args[0] === "ls-remote") return { stdout: "", stderr: "", code: 0 };
      if (command === "git" && args[0] === "worktree" && args[1] === "add") return { stdout: "", stderr: "", code: 0 };
      if (command === "git" && args[0] === "checkout") return { stdout: "", stderr: "", code: 0 };
      if (command === "git" && args[0] === "add") return { stdout: "", stderr: "", code: 0 };
      if (command === "git" && args[0] === "diff") return { stdout: "designs/openpencil/timeline-live.fig\n", stderr: "", code: 0 };
      if (command === "git" && args[0] === "commit") return { stdout: "", stderr: "", code: 0 };
      if (command === "git" && args[0] === "rev-parse" && args[1] === "HEAD") return { stdout: "design-commit-sha\n", stderr: "", code: 0 };
      if (command === "git" && args[0] === "push") return { stdout: "", stderr: "", code: 0 };
      if (command === "git" && args[0] === "worktree" && args[1] === "remove") return { stdout: "", stderr: "", code: 0 };
      if (command === "gh" && args[0] === "issue" && args[1] === "list") return { stdout: "[]", stderr: "", code: 0 };
      if (command === "gh" && args[0] === "issue" && args[1] === "create") {
        const bodyPath = args[args.indexOf("--body-file") + 1];
        issueBody = await readFile(bodyPath, "utf8");
        return { stdout: "https://github.com/BryanHarrisScripts/PlotPickle/issues/3000\n", stderr: "", code: 0 };
      }
      throw new Error(`unexpected command: ${command} ${args.join(" ")}`);
    },
  });

  const session = await publisher.begin(fx.target);
  assert.equal(session.id, "session-2800");
  assert.equal(session.baseSha, "base-main-sha");
  await writeFile(fx.designFile, "after-design", "utf8");

  const result = await publisher.finalize("Timeline", session.id);
  assert.equal(result.state, "published");
  assert.equal(result.issueNumber, 3000);
  assert.match(result.branch, /^design\/openpencil\/timeline-[a-f0-9]{12}$/u);
  assert.equal(result.commitSha, "design-commit-sha");
  assert.match(issueBody, /Developer Brief — OpenPencil design review: Timeline/u);
  assert.match(issueBody, /Design-review branch/u);
  assert.match(issueBody, /No implementation PR was created automatically/u);
  assert.match(issueBody, /plotpickle-openpencil-design:timeline:/u);

  const primaryCheckoutMutation = calls.filter((call) => (
    call.cwd === fx.root
    && call.command === "git"
    && ["checkout", "add", "commit", "push"].includes(call.args[0])
  ));
  assert.deepEqual(primaryCheckoutMutation, []);
  const add = calls.find((call) => call.command === "git" && call.args[0] === "add");
  assert.deepEqual(add.args.slice(-2), ["--", "designs/openpencil/timeline-live.fig"]);
});

test("#2800 no saved design delta creates no Git branch, push or issue", async (t) => {
  const fx = await fixture();
  t.after(() => rm(fx.root, { recursive: true, force: true }));
  const calls = [];
  const publisher = createOpenPencilDesignReviewPublisher({
    repositoryRoot: fx.root,
    stateRoot: fx.stateRoot,
    env: {},
    randomId: () => "session-unchanged",
    runProcess: async (command, args) => {
      calls.push({ command, args: [...args] });
      if (command === "git" && args[0] === "rev-parse") return { stdout: "base-main-sha\n", stderr: "", code: 0 };
      throw new Error("unexpected mutation");
    },
  });

  const session = await publisher.begin(fx.target);
  const result = await publisher.finalize("Timeline", session.id);
  assert.equal(result.state, "unchanged");
  assert.match(result.message, /no saved design changes/u);
  assert.equal(calls.some((call) => call.command === "gh"), false);
  assert.equal(calls.some((call) => call.args[0] === "push"), false);
});

test("#2800 identical published design reuses the remote branch and existing issue", async (t) => {
  const fx = await fixture();
  t.after(() => rm(fx.root, { recursive: true, force: true }));
  const calls = [];
  const after = "repeated-design";
  const afterHash = hash(after);
  const remoteSha = "remote-design-sha";
  const issueBody = `<!-- plotpickle-openpencil-design:timeline:${afterHash} -->`;

  const publisher = createOpenPencilDesignReviewPublisher({
    repositoryRoot: fx.root,
    stateRoot: fx.stateRoot,
    env: {},
    randomId: () => "session-dedupe",
    runProcess: async (command, args) => {
      calls.push({ command, args: [...args] });
      if (command === "git" && args[0] === "rev-parse") return { stdout: "base-main-sha\n", stderr: "", code: 0 };
      if (command === "gh" && args[0] === "auth") return { stdout: "ok\n", stderr: "", code: 0 };
      if (command === "git" && args[0] === "ls-remote") return { stdout: `${remoteSha}\trefs/heads/design/openpencil/timeline-${afterHash.slice(0, 12)}\n`, stderr: "", code: 0 };
      if (command === "gh" && args[0] === "issue" && args[1] === "list") {
        return { stdout: JSON.stringify([{ number: 2999, url: "https://github.com/BryanHarrisScripts/PlotPickle/issues/2999", title: "Existing", body: issueBody }]), stderr: "", code: 0 };
      }
      throw new Error(`unexpected command: ${command} ${args.join(" ")}`);
    },
  });

  const session = await publisher.begin(fx.target);
  await writeFile(fx.designFile, after, "utf8");
  const result = await publisher.finalize("Timeline", session.id);
  assert.equal(result.state, "published");
  assert.equal(result.issueNumber, 2999);
  assert.equal(result.commitSha, remoteSha);
  assert.equal(calls.some((call) => call.args[0] === "worktree"), false);
  assert.equal(calls.some((call) => call.command === "gh" && call.args[1] === "create"), false);
});

test("#2800 GitHub failure preserves the Human design and leaves a retryable local session", async (t) => {
  const fx = await fixture();
  t.after(() => rm(fx.root, { recursive: true, force: true }));
  const publisher = createOpenPencilDesignReviewPublisher({
    repositoryRoot: fx.root,
    stateRoot: fx.stateRoot,
    env: {},
    randomId: () => "session-failed",
    runProcess: async (command, args) => {
      if (command === "git" && args[0] === "rev-parse") return { stdout: "base-main-sha\n", stderr: "", code: 0 };
      if (command === "gh" && args[0] === "auth") throw new Error("not logged into any github hosts");
      throw new Error("unexpected command");
    },
  });

  const session = await publisher.begin(fx.target);
  await writeFile(fx.designFile, "after-failure", "utf8");
  const result = await publisher.finalize("Timeline", session.id);
  assert.equal(result.state, "failed");
  assert.match(result.message, /saved locally/u);
  assert.equal(await readFile(fx.designFile, "utf8"), "after-failure");

  const state = JSON.parse(await readFile(path.join(fx.stateRoot, "session-failed.json"), "utf8"));
  assert.equal(state.state, "failed");
  assert.equal(state.beforeHash, hash("before-design"));
});


test("#2800 Command auto-finalizes on browser focus only after OpenPencil document closure", async () => {
  const [conversation, gateway, runtime, parser] = await Promise.all([
    readFile(new URL("../app/skin-v1/global-dsdd-conversation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../build/openpencil/openpencil-gui-gateway.ts", import.meta.url), "utf8"),
    readFile(new URL("../build/openpencil/openpencil-gui-runtime.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/settings/openpencil-command.ts", import.meta.url), "utf8"),
  ]);

  assert.match(conversation, /openPencilDesignSessionRef/u);
  assert.match(conversation, /window\.addEventListener\("focus", finalize\)/u);
  assert.match(conversation, /action: "finalize"/u);
  assert.match(gateway, /action === "finalize"/u);
  assert.match(runtime, /documents", "list"/u);
  assert.match(runtime, /state: "editing"/u);
  assert.match(runtime, /publish only after the design document closes/u);
  assert.match(parser, /action: "publish"; surfaceName: string/u);
  assert.match(parser, /retry\\s\+publish/u);
});

test("#2800 architecture keeps protected main and implementation PR outside automatic design authority", async () => {
  const [adapter, architecture, readme] = await Promise.all([
    readFile(new URL("../config/openpencil-adapter.json", import.meta.url), "utf8"),
    readFile(new URL("../docs/architecture/OPENPENCIL-DESIGN-BRIDGE.md", import.meta.url), "utf8"),
    readFile(new URL("../designs/openpencil/README.md", import.meta.url), "utf8"),
  ]);
  const config = JSON.parse(adapter);

  assert.equal(config.command.autoDesignReview.issue, 2800);
  assert.equal(config.command.autoDesignReview.protectedMainPush, false);
  assert.equal(config.command.autoDesignReview.implementationPullRequest, false);
  assert.match(architecture, /primary checkout is never checked out, staged, committed or pushed/u);
  assert.match(architecture, /content-addressed branch is reused/u);
  assert.match(readme, /protected `main` is not touched/u);
});
