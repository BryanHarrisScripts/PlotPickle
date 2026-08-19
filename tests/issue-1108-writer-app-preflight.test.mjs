import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ensureWriterAppRuntime,
  isDefaultWriterLocalUrl,
  looksLikePlotPickleHtml,
  probeWriterApp,
  stopOwnedWriterApp,
} from "../scripts/writer-app-runtime.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function fakeResponse({ ok = true, status = 200, body = "PlotPickle" } = {}) {
  return { ok, status, text: async () => body };
}

function fakeChild() {
  const child = new EventEmitter();
  child.pid = 12345;
  child.exitCode = null;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdout.setEncoding = () => {};
  child.stderr.setEncoding = () => {};
  child.killCalls = 0;
  child.kill = () => {
    child.killCalls += 1;
    child.exitCode = 0;
    child.emit("exit", 0, null);
    return true;
  };
  return child;
}

test("#1108 recognizes only the canonical localhost Writer auto-start target", () => {
  assert.equal(isDefaultWriterLocalUrl("http://127.0.0.1:4173"), true);
  assert.equal(isDefaultWriterLocalUrl("http://localhost:4173"), true);
  assert.equal(isDefaultWriterLocalUrl("http://127.0.0.1:4180"), false);
  assert.equal(isDefaultWriterLocalUrl("https://127.0.0.1:4173"), false);
  assert.equal(isDefaultWriterLocalUrl("https://example.com"), false);
  assert.equal(looksLikePlotPickleHtml("<title>PlotPickle</title>"), true);
  assert.equal(looksLikePlotPickleHtml("another app"), false);
});

test("#1108 probe distinguishes PlotPickle, foreign HTTP, and an unavailable port", async () => {
  const ready = await probeWriterApp("http://127.0.0.1:4173", {
    fetchImpl: async () => fakeResponse({ body: "<html>PlotPickle</html>" }),
    tcpProbe: async () => false,
  });
  assert.equal(ready.state, "ready");

  const foreign = await probeWriterApp("http://127.0.0.1:4173", {
    fetchImpl: async () => fakeResponse({ body: "Not the app" }),
    tcpProbe: async () => true,
  });
  assert.equal(foreign.state, "occupied");

  const unavailable = await probeWriterApp("http://127.0.0.1:4173", {
    fetchImpl: async () => { throw new Error("connect ECONNREFUSED"); },
    tcpProbe: async () => false,
  });
  assert.equal(unavailable.state, "unavailable");
});

test("#1108 reuses an existing healthy PlotPickle server without taking ownership", async () => {
  let spawnCalls = 0;
  const runtime = await ensureWriterAppRuntime({
    baseUrl: "http://127.0.0.1:4173",
    repoRoot: "/repo",
    deps: {
      probe: async () => ({ state: "ready", detail: "ok" }),
      spawn: () => { spawnCalls += 1; return fakeChild(); },
    },
  });
  assert.equal(runtime.owned, false);
  assert.equal(runtime.source, "existing");
  assert.equal(spawnCalls, 0);
  await runtime.stop();
  assert.equal(spawnCalls, 0);
});

test("#1108 starts the canonical missing local app and stops only the owned child", async () => {
  const probes = [
    { state: "unavailable", detail: "refused" },
    { state: "ready", detail: "PlotPickle ready" },
  ];
  const child = fakeChild();
  let spawned = null;
  const runtime = await ensureWriterAppRuntime({
    baseUrl: "http://127.0.0.1:4173",
    repoRoot: "/repo",
    pollMs: 0,
    deps: {
      probe: async () => probes.shift() || { state: "ready", detail: "ready" },
      access: async () => {},
      sleep: async () => {},
      spawn: (command, args, options) => {
        spawned = { command, args, options };
        return child;
      },
    },
  });
  assert.equal(runtime.owned, true);
  assert.equal(runtime.source, "writer-owned-vite");
  assert.ok(spawned.args.some((value) => String(value).endsWith("vite.js")));
  assert.deepEqual(spawned.args.slice(-5), ["--host", "127.0.0.1", "--port", "4173", "--strictPort"]);
  assert.equal(spawned.options.windowsHide, true);

  await stopOwnedWriterApp(runtime, { sleepImpl: async () => {} });
  await stopOwnedWriterApp(runtime, { sleepImpl: async () => {} });
  assert.equal(child.killCalls, 1, "cleanup is idempotent and only stops the owned child once");
});

test("#1108 never auto-starts a missing custom or remote acceptance URL", async () => {
  let spawnCalls = 0;
  await assert.rejects(
    ensureWriterAppRuntime({
      baseUrl: "http://192.0.2.10:4173",
      repoRoot: "/repo",
      deps: {
        probe: async () => ({ state: "unavailable", detail: "refused" }),
        spawn: () => { spawnCalls += 1; return fakeChild(); },
      },
    }),
    /Automatic startup is limited to http:\/\/127\.0\.0\.1:4173/,
  );
  assert.equal(spawnCalls, 0);
});

test("#1108 refuses a foreign process on 4173 instead of replacing or killing it", async () => {
  let spawnCalls = 0;
  await assert.rejects(
    ensureWriterAppRuntime({
      baseUrl: "http://127.0.0.1:4173",
      repoRoot: "/repo",
      deps: {
        probe: async () => ({ state: "occupied", detail: "not PlotPickle" }),
        spawn: () => { spawnCalls += 1; return fakeChild(); },
      },
    }),
    /refused .*not PlotPickle/i,
  );
  assert.equal(spawnCalls, 0);
});

test("#1108 public entrypoint completes app preflight before spawning any Avery phase", async () => {
  const source = await read("scripts/run-writer-in-residence.mjs");
  const preflight = source.indexOf("runtime = await ensureWriterAppRuntime");
  const journey = source.indexOf("process.exitCode = await runJourney()");
  assert.ok(preflight >= 0 && journey > preflight);
  assert.match(source, /run-writer-in-residence-e2e\.mjs/);
  assert.match(source, /writer-in-residence-runtime-recovery\.mjs/);
  assert.match(source, /--import/);
  assert.match(source, /stopOwnedWriterApp/);
  assert.doesNotMatch(source, /Start-PlotPickle\.bat/);
});
