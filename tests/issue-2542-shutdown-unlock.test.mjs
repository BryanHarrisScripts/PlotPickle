import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

for (const path of ["app/skin-v1/node-shutdown-panel.tsx", "app/plotpickle-workspace-shell.tsx"]) {
  test(`#2542 ${path} keeps locked-profile recovery inside shutdown`, async () => {
    const source = await read(path);
    assert.match(source, /const locked = \/Human profile is locked\/i\.test\(detail\)/u);
    assert.match(source, /setProfileBlocked\(locked\)/u);
    assert.match(source, /profileBlocked \? <form onSubmit=/u);
    assert.match(source, /action: "login", locator: selectedProfileId, password: passphrase/u);
    assert.match(source, /if \(!verified\.authenticated \|\| !verified\.csrfToken\) throw/u);
    assert.match(source, /setProfileBlocked\(false\);\s*setUnlockReady\(true\)/u);
    assert.match(source, /Profile unlocked successfully\. Shutdown is ready/u);
    assert.match(source, /shutdownDisabled[^;]*profileBlocked|disabled=\{[^}]*profileBlocked\}/u);
    assert.ok(source.indexOf('persistActiveProfileProject(currentProfile.csrfToken)') < source.indexOf('logoutHumanProfile(currentProfile.csrfToken)'), "save must still precede logout");
  });
}
