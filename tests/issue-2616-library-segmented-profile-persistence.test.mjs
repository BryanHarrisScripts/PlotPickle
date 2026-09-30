import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createProfilePrivateStorageService } from "../core/storage/profile-private/profile-private-storage-core.mjs";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("#2616 segmented Library persistence survives an inventory larger than the former 8 MiB gateway envelope", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-2616-library-"));
  const context = { sessionId: "session-2616" };
  const authService = {
    createProfileVaultCapability() {
      return {
        profileId: "profile_2616",
        async wrapSecret({ secret }) {
          return { payload: Buffer.from(secret).toString("base64") };
        },
        async unwrapSecret({ envelope }) {
          return Uint8Array.from(Buffer.from(envelope.payload, "base64"));
        },
      };
    },
    registerVaultCleanupHook() {
      return () => undefined;
    },
    resolveSession() {
      return { profileId: "profile_2616" };
    },
  };
  const storage = createProfilePrivateStorageService({ root, authService });

  const first = { id: "story-first", title: "First", text: "A".repeat(5 * 1024 * 1024) };
  const afterglow = { id: "afterglow-working-copy", title: "Afterglow: Reflections of Sentience", text: "B".repeat(5 * 1024 * 1024) };
  const historicalEnvelope = JSON.stringify({
    action: "sync-library",
    projects: [{ project: first }, { project: afterglow }],
    activeProjectId: afterglow.id,
  });
  assert.ok(Buffer.byteLength(historicalEnvelope, "utf8") > 8 * 1024 * 1024);

  try {
    await storage.saveProject(context, {
      project: first,
      summary: { sourceKind: "user", archivedAt: "2026-09-30T18:00:00.000Z" },
      activate: false,
    });
    await storage.saveProject(context, {
      project: afterglow,
      summary: { sourceKind: "example", sourceId: "afterglow-v9-defaults" },
      activate: false,
    });

    const result = await storage.syncLibraryIndex(context, {
      activeProjectId: afterglow.id,
      summaries: [
        { projectId: first.id, title: first.title, sourceKind: "user", archivedAt: "2026-09-30T18:00:00.000Z" },
        { projectId: afterglow.id, title: afterglow.title, sourceKind: "example", sourceId: "afterglow-v9-defaults" },
      ],
    });

    assert.equal(result.activeProjectId, afterglow.id);
    assert.equal(result.projectCount, 2);
    assert.equal((await storage.loadActiveProject(context)).id, afterglow.id);
    assert.equal((await storage.loadProject(context, first.id)).text.length, first.text.length);
    const summaries = await storage.listProjects(context);
    assert.equal(summaries.find((item) => item.projectId === first.id)?.archivedAt, "2026-09-30T18:00:00.000Z");
    assert.equal(summaries.find((item) => item.projectId === afterglow.id)?.sourceId, "afterglow-v9-defaults");
  } finally {
    storage.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("#2616 browser persistence writes projects separately before the small Library index", async () => {
  const browser = await read("core/storage/profile-private-browser.ts");
  assert.match(browser, /queueWriteOperation/u);
  assert.match(browser, /for \(const entry of projects\)[\s\S]*privateMutation\("save-project"/u);
  assert.match(browser, /activate: false/u);
  assert.match(browser, /privateMutation\("sync-library-index"/u);
  assert.match(browser, /summaries: projects\.map\(\(entry\) => entry\.summary\)/u);
  assert.doesNotMatch(browser, /queueWrite\("sync-library", \{ projects/u);
});

test("#2616 private API preserves non-activation writes and exposes registry-only sync", async () => {
  const route = await read("app/api/auth/profile-private/route.ts");
  assert.match(route, /activate: input\.activate === false \? false : true/u);
  assert.match(route, /input\.action === "sync-library-index"/u);
  assert.match(route, /privateStorage\.syncLibraryIndex/u);
  assert.match(route, /summaries,/u);
});

test("#2616 local gateway admits one valid encrypted project and reports size failures truthfully", async () => {
  const gateway = await read("build/local-profile-auth-gateway.ts");
  assert.match(gateway, /\[PROFILE_PRIVATE_API, 20 \* 1024 \* 1024\]/u);
  assert.match(gateway, /413, error\.message, "REQUEST_TOO_LARGE"/u);
  assert.match(gateway, /PlotPickle local profile request body is too large\./u);
});
