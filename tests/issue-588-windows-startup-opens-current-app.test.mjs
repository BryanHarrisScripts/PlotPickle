import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const launcher = await readFile(new URL("../Start-PlotPickle.bat", import.meta.url), "utf8");

test("Windows startup builds and opens the current vinext application", () => {
  assert.match(launcher, /set "VINEXT_CMD=node_modules\\\.bin\\vinext\.cmd"/);
  assert.match(launcher, /call npm run build/);
  assert.match(launcher, /call "%VINEXT_CMD%" start --host 127\.0\.0\.1 --port %PLOTPICKLE_PORT%/);
  assert.ok(launcher.indexOf("call npm run build") < launcher.indexOf("call :open_when_ready"));
  assert.doesNotMatch(launcher, /call "%VITE_CMD%" --host/);
});
