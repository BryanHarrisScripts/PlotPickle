import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (name) => readFile(new URL("../" + name, import.meta.url), "utf8");
const canonicalLibrary = "/skin-v1?workspace=library";

test("#3233 legacy entry links now target authenticated Matrix Library instead of LoadMATRIX", async () => {
  for (const path of [
    "app/page.tsx",
    "app/story/page.tsx",
    "app/_components/story/story-zero-workspace.tsx",
    "app/reports/library-ppf-reports-workspace.tsx",
  ]) {
    const source = await read(path);
    assert.ok(source.includes(canonicalLibrary), path + " must link to canonical Matrix Library");
    assert.ok(!source.includes('router.push("/library")'), path + " must not open old Library");
    assert.ok(!source.includes('window.location.assign("/library")'), path + " must not force old Library document");
  }
});

test("#3233 Library deep link activates only after successful local profile authentication", async () => {
  const client = await read("app/skin-v1/skin-v1-client.tsx");
  const gated = client.indexOf('if (view.state !== "authenticated")');
  assert.ok(gated >= 0, "retain profile gate before one-shot startup activation");
  const query = client.indexOf('new URLSearchParams(window.location.search).get("workspace")', gated);
  const selection = client.indexOf('requestedWorkspace === "library" ? "library" : readStartupPage()', gated);
  const activation = client.indexOf("dashboardMenuRefs.current[index]?.click()", gated);
  assert.ok(query > gated && selection > query && activation > selection,
    "whitelisted navigation must be applied after authenticated profile view, not in a public render");
  assert.ok(client.includes('if (startupPage === "dashboard") return;'), "preserve normal Dashboard start");
  assert.ok(client.includes('isDashboardStartupId(startupPage)'), "preserve persisted startup allowlist");
});

test("#3233 standalone Reports retains project read-only authority and embedded in-shell callback", async () => {
  const [reports, host] = await Promise.all([
    read("app/reports/library-ppf-reports-workspace.tsx"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
  ]);
  assert.ok(reports.includes('onOpenLibrary ?? (() => router.push("/skin-v1?workspace=library"))'),
    "standalone fallback must not override embedded in-shell navigation");
  assert.ok(host.includes('setLibraryOpen(true); onSurfaceNameChange("LIBRARY");'), "embedded Library reuses host");
  assert.ok(!reports.includes("saveActiveLibraryProject("), "read-only Reports must not save canon");
  assert.ok(!reports.includes("switchActiveLibraryProject("), "navigation must not select a different story");
});
