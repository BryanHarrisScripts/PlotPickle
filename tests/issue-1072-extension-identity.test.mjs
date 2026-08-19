import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("extension identity separates human display naming from stable process and transport identity", async () => {
  const source = await read("build/extension-identity.ts");
  assert.match(source, /owner: string/);
  assert.match(source, /moduleId: string/);
  assert.match(source, /displayName: string/);
  assert.match(source, /serviceName: `plotpickle-module-\$\{owner\}-\$\{moduleId\}`/);
  assert.match(source, /transportNamespace: `plotpickle\.modules\.\$\{owner\}\.\$\{moduleId\}`/);
  assert.doesNotMatch(source.match(/serviceName:.*\n/)?.[0] || "", /displayName/);
  assert.doesNotMatch(source.match(/transportNamespace:.*\n/)?.[0] || "", /displayName/);
});

test("callback, task and root path conventions remain deterministic and display-name independent", async () => {
  const source = await read("build/extension-identity.ts");
  assert.match(source, /rootPath = `\/extensions\/\$\{owner\}\/\$\{moduleId\}`/);
  assert.match(source, /callbackRootPath: `\$\{rootPath\}\/callbacks`/);
  assert.match(source, /taskRootPath: `\$\{rootPath\}\/tasks`/);
  assert.match(source, /extensionCallbackIdentity/);
  assert.match(source, /\.callback\.\$\{operationId\(callbackId/);
  assert.match(source, /extensionTaskIdentity/);
  assert.match(source, /\.task\.\$\{operationId\(taskId/);
});

test("external target descriptor stays generic and supports optional auth, label and reconnect policy", async () => {
  const source = await read("build/extension-identity.ts");
  assert.match(source, /endpoint: string/);
  assert.match(source, /authRef\?: string/);
  assert.match(source, /displayLabel\?: string/);
  assert.match(source, /reconnectPolicy\?: ExtensionReconnectPolicy/);
  assert.match(source, /RECONNECT_POLICIES = \["manual", "on-demand", "always"\] as const/);
  assert.doesNotMatch(source, /comfy/i);
});

test("selected targets persist by stable owner and module id without coupling to Studio display names", async () => {
  const source = await read("build/extension-identity.ts");
  assert.match(source, /const TARGET_SELECTION_FILE = "extension-targets\.json"/);
  assert.match(source, /return `\$\{identity\.owner\}\/\$\{identity\.moduleId\}`/);
  assert.match(source, /readCredentialJson<unknown>\(TARGET_SELECTION_FILE\)/);
  assert.match(source, /writeCredentialJson\(TARGET_SELECTION_FILE, store\)/);
  assert.match(source, /readSelectedExtensionTarget/);
  assert.match(source, /writeSelectedExtensionTarget/);
  assert.doesNotMatch(source.match(/function identityKey[\s\S]*?\n}/)?.[0] || "", /displayName|studioId/);
});

test("persisted target validation is explicit rather than catch-and-default", async () => {
  const source = await read("build/extension-identity.ts");
  const validator = source.match(/function validTarget\([\s\S]*?\n}/)?.[0] || "";
  assert.match(validator, /target\.endpoint/);
  assert.match(validator, /validOptionalText/);
  assert.match(validator, /RECONNECT_POLICIES\.includes/);
  assert.doesNotMatch(validator, /catch/);
});

test("Phase A documents compatibility with the existing Studio identity and defers runtime ownership", async () => {
  const doc = await read("docs/architecture/PLUGGABLE-READINESS-IDENTITY.md");
  assert.match(doc, /#927/);
  assert.match(doc, /human display identity/i);
  assert.match(doc, /process\/service identity/i);
  assert.match(doc, /transport\/tool namespace/i);
  assert.match(doc, /remote target identity/i);
  assert.match(doc, /Phase B/i);
  assert.match(doc, /runtime ownership/i);
  assert.doesNotMatch(doc, /Comfy Gateway owns|ComfyUI-specific contract/i);
});
