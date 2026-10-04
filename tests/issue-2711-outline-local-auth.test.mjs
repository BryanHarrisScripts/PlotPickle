import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";
import { createVerificationSyntheticProfile, authenticateVerificationSyntheticProfile } from "../scripts/full-verification-auth.mjs";

test("local Outline discovery shares the login vault and still denies unauthenticated and cross-origin access", async () => {
  const temporary = await mkdtemp(path.resolve("node_modules/.outline-local-auth-"));
  const priorHome = process.env.PLOTPICKLE_HOME;
  const priorState = process.env.PLOTPICKLE_AUTH_STATE_PATH;
  process.env.PLOTPICKLE_HOME = temporary;
  process.env.PLOTPICKLE_AUTH_STATE_PATH = path.join(temporary, "auth/state.json");
  let server, runtime;
  try {
    const output = path.join(temporary, "fixture.mjs");
    await build({ stdin: { contents: 'export { localProfileAuthGateway } from "./build/local-profile-auth-gateway.ts"; export { resetProfileExperienceRuntime } from "./core/auth/profile-experience/profile-experience-runtime.ts";', resolveDir: process.cwd(), loader: "ts" }, bundle: true, platform: "node", format: "esm", packages: "external", outfile: output, logLevel: "silent" });
    runtime = await import(pathToFileURL(output).href);
    let middleware;
    runtime.localProfileAuthGateway().configureServer({ middlewares: { use(handler) { middleware = handler; } } });
    server = createServer((request, response) => middleware(request, response, () => { response.statusCode = 404; response.end(); }));
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const profile = await createVerificationSyntheticProfile({ baseUrl, home: temporary });
    const session = await authenticateVerificationSyntheticProfile({ baseUrl, ...profile });
    const headers = { Cookie: session.environment.PLOTPICKLE_VERIFICATION_AUTH_COOKIE, Origin: baseUrl };
    const discovered = await fetch(`${baseUrl}/api/outline/tasks`, { headers });
    assert.equal(discovered.status, 200);
    assert.deepEqual(await discovered.json(), { tasks: [] });
    assert.equal((await fetch(`${baseUrl}/api/outline/tasks`)).status, 403);
    assert.equal((await fetch(`${baseUrl}/api/outline/tasks`, { headers: { ...headers, Origin: "http://foreign.example" } })).status, 403);
    assert.equal((await fetch(`${baseUrl}/api/outline/tasks`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ action: "start" }) })).status, 400);
  } finally {
    if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
    await runtime?.resetProfileExperienceRuntime();
    if (priorHome === undefined) delete process.env.PLOTPICKLE_HOME; else process.env.PLOTPICKLE_HOME = priorHome;
    if (priorState === undefined) delete process.env.PLOTPICKLE_AUTH_STATE_PATH; else process.env.PLOTPICKLE_AUTH_STATE_PATH = priorState;
    await rm(temporary, { recursive: true, force: true });
  }
});
