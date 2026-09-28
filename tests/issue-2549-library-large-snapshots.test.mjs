import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createInMemoryAuthStateStore, createPlotPickleAuthService } from "../core/auth/plotpickle-auth-core.mjs";
import { createProfilePrivateStorageService } from "../core/storage/profile-private/profile-private-storage-core.mjs";

test("#2549 large active/archived snapshots survive profile storage reload and failed replacement", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-large-library-"));
  const auth = await createPlotPickleAuthService({ nodeId: "node-large-library", accessMode: "desktop-loopback", stateStore: createInMemoryAuthStateStore() });
  const created = await auth.createFirstProfile({ displayName: "Library Test", password: "Long local profile passphrase 2026", avatarRef: null });
  const storage = createProfilePrivateStorageService({ root, authService: auth });
  const context = created.authContext;
  try {
    const large = { id: "large-story", title: "Large Story", text: "A".repeat(6 * 1024 * 1024) };
    const archived = { id: "archived-story", title: "Archived Story", text: "B".repeat(6 * 1024 * 1024) };
    await storage.syncLibrary(context, { activeProjectId: large.id, projects: [
      { project: large, summary: { sourceKind: "user" } },
      { project: archived, summary: { sourceKind: "user", archivedAt: "2026-09-28T17:00:00.000Z" } },
    ] });
    assert.equal((await storage.loadActiveProject(context)).id, large.id);
    assert.equal((await storage.loadProject(context, archived.id)).text.length, archived.text.length);
    assert.equal((await storage.listProjects(context)).find((item) => item.projectId === archived.id).archivedAt, "2026-09-28T17:00:00.000Z");
    await assert.rejects(storage.syncLibrary(context, { activeProjectId: large.id, projects: [
      { project: { ...large, text: "X".repeat(17 * 1024 * 1024) } },
    ] }), (error) => error?.code === "PROFILE_OBJECT_TOO_LARGE");
    assert.equal((await storage.loadProject(context, large.id)).text, large.text, "a failed save preserves the last verified story");
    await storage.deleteArchivedProject(context, archived.id);
    assert.equal(await storage.loadProject(context, archived.id), null);
    assert.equal((await storage.loadActiveProject(context)).id, large.id);
    assert.equal((await storage.listProjects(context)).length, 1);
  } finally {
    storage.close(); auth.close();
    await rm(root, { recursive: true, force: true });
  }
});
