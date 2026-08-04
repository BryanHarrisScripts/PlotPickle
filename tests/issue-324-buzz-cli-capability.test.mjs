import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #324 probes the supported Buzz CLI help surface", async () => {
  const gateway = await source("build/buzz-gateway.ts");
  assert.match(gateway, /command\(executable, \["--help"\]/);
  assert.doesNotMatch(gateway, /command\(executable, \["--version"\]/);
  assert.match(gateway, /Buzz CLI/i);
  assert.match(gateway, /required Buzz CLI commands/);
  assert.match(gateway, /\\bchannels\\b/i);
  assert.match(gateway, /\\busers\\b/i);
});

test("issue #324 keeps identity verification separate from capability detection", async () => {
  const gateway = await source("build/buzz-gateway.ts");
  assert.match(gateway, /runBuzz\(connection, \["users", "get"\]\)/);
  assert.match(gateway, /runBuzz\(connection, \["channels", "list"\]\)/);
  assert.match(gateway, /Buzz Desktop CLI could not be started/);
  assert.match(gateway, /Buzz rejected this identity or it is not a member/);
});
