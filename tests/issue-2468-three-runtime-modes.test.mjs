import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2468 propagates normal, webmcp and conversational-uat across both launchers", async () => {
  const [powershell, batch, bootstrap] = await Promise.all([
    read("PlotPickle.ps1"),
    read("Start-PlotPickle.bat"),
    read("GIT-PlotPickle.ps1"),
  ]);

  assert.match(powershell, /Mode = "normal"/u);
  assert.match(powershell, /Mode = "webmcp"/u);
  assert.match(powershell, /Mode = "conversational-uat"/u);
  assert.match(powershell, /& \$launcher --normal/u);
  assert.match(powershell, /& \$launcher --webmcp-testing/u);
  assert.match(powershell, /& \$launcher --conversational-uat/u);

  assert.match(batch, /--normal" set "PLOTPICKLE_STARTUP_TESTING_MODE=normal"/u);
  assert.match(batch, /--human-testing" set "PLOTPICKLE_STARTUP_TESTING_MODE=normal"/u);
  assert.match(batch, /--webmcp-testing" set "PLOTPICKLE_STARTUP_TESTING_MODE=webmcp"/u);
  assert.match(batch, /--conversational-uat" set "PLOTPICKLE_STARTUP_TESTING_MODE=conversational-uat"/u);
  assert.match(batch, /PLOTPICKLE_PERFORMANCE_BENCHMARK%"=="1" set "PLOTPICKLE_STARTUP_TESTING_MODE=normal"/u);
  assert.doesNotMatch(batch, /PLOTPICKLE_STARTUP_TESTING_MODE=human/u);

  assert.match(bootstrap, /\[switch\]\$ConversationalUAT/u);
  assert.match(bootstrap, /\$launchArgs\.ConversationalUAT = \$true/u);
});

test("#2468 keeps the five-second normal default and preserves selected mode across source restart", async () => {
  const [powershell, batch] = await Promise.all([
    read("PlotPickle.ps1"),
    read("Start-PlotPickle.bat"),
  ]);

  assert.match(powershell, /AddSeconds\(5\)/u);
  assert.match(powershell, /\$selection = "1"/u);
  assert.match(powershell, /Starting \[1\] Open PlotPickle normally/u);
  assert.match(batch, /call "%~f0" --source-current/u);
  assert.match(batch, /PLOTPICKLE_STARTUP_MARKER=!PLOTPICKLE_STARTUP_MARKER!-!PLOTPICKLE_STARTUP_TESTING_MODE!/u);
  assert.match(batch, /running a different startup mode/u);
});

test("#2468 server-side DSDD authority is conversational-uat only", async () => {
  const gateway = await read("build/dsdd/dsdd-session-gateway.ts");

  assert.match(gateway, /process\.env\.PLOTPICKLE_STARTUP_TESTING_MODE === "conversational-uat"/u);
  assert.match(gateway, /if \(!dsddRuntimeEnabled\(\)\)[\s\S]*status: 403/u);
  assert.match(gateway, /DSDD engineering sessions require PlotPickle Conversational UAT startup mode/u);
  assert.match(gateway, /acceptsDsddLoopbackRequest/u);
});

test("#2468 DSDD UI requires server-confirmed runtime authority and cannot flash in normal/WebMCP", async () => {
  const panel = await read("app/skin-v1/global-dsdd-conversation.tsx");

  assert.match(panel, /const \[runtimeEligible, setRuntimeEligible\] = useState\(false\)/u);
  assert.match(panel, /setRuntimeEligible\(true\)/u);
  assert.match(panel, /setRuntimeEligible\(false\)/u);
  assert.match(panel, /if \(!eligible \|\| !runtimeEligible\) return null/u);
  assert.match(panel, /if \(!eligible \|\| !runtimeEligible\) setOpen\(false\)/u);
});

test("#2468 local dictation is prepared for Human modes but not isolated WebMCP", async () => {
  const batch = await read("Start-PlotPickle.bat");

  assert.match(batch, /PLOTPICKLE_STARTUP_TESTING_MODE!"=="normal" set "PLOTPICKLE_PREPARE_LOCAL_DICTATION=1"/u);
  assert.match(batch, /PLOTPICKLE_STARTUP_TESTING_MODE!"=="conversational-uat" set "PLOTPICKLE_PREPARE_LOCAL_DICTATION=1"/u);
  assert.doesNotMatch(batch, /PLOTPICKLE_STARTUP_TESTING_MODE!"=="webmcp" set "PLOTPICKLE_PREPARE_LOCAL_DICTATION=1"/u);
});
