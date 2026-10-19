import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const script=readFileSync(new URL("../scripts/engineering-team/windows/install-factory-worker.ps1",import.meta.url),"utf8");
test("scheduled task opt-in is explicit, scoped to interactive user and limited privilege",()=>{
 assert.match(script,/ENABLE_BOUNDED_FACTORY/);
 assert.match(script,/Register-ScheduledTask/);
 assert.match(script,/New-ScheduledTaskPrincipal/);
 assert.match(script,/-LogonType Interactive -RunLevel Limited/);
 assert.match(script,/New-ScheduledTaskTrigger -AtLogOn/);
 assert.match(script,/factory-worker\.mjs/);
 assert.doesNotMatch(script,/-RunLevel Highest/);
 assert.doesNotMatch(script,/SYSTEM|LocalSystem|cmd\.exe|Invoke-Expression/);
});
test("operator uninstall stops scheduled task and disables worker",()=>{
 assert.match(script,/Stop-ScheduledTask/);
 assert.match(script,/Unregister-ScheduledTask/);
 assert.match(script,/--disable/);
});
