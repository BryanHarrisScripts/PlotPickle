import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";
import { createInMemoryAuthStateStore, createPlotPickleAuthService } from "../core/auth/plotpickle-auth-core.mjs";
import { createServerSessionBoundary } from "../core/auth/server-session/server-session-boundary-core.mjs";

const temp = await mkdtemp(path.resolve("node_modules/.command-gateway-"));
await build({ stdin: { contents: `export { registerDsddSessionGateway } from "./build/dsdd/dsdd-session-gateway.ts";
export { registerHunkReviewGateway } from "./build/dsdd/hunk-review-gateway.ts";
export { profileScopedBuzzRequestContext } from "./build/auth/profile-request-context.ts";`, resolveDir: process.cwd(), loader: "ts" },
  bundle: true, platform: "node", format: "esm", packages: "external", outfile: path.join(temp, "host.mjs"), logLevel: "silent",
  plugins: [{ name: "isolated-auth-runtime", setup(builder) { builder.onLoad({ filter: /profile-experience-runtime\.ts$/ }, () => ({ contents: "export async function getProfileExperienceRuntime() { return globalThis.__command2717Runtime; }", loader: "ts" })); } }],
});
const host = await import(pathToFileURL(path.join(temp, "host.mjs")).href);
test.after(() => rm(temp, { recursive: true, force: true }));

test("normal Command discovery uses the protected DSDD session; auth failures and UAT actions cannot launch tools", async t => {
  const previous = process.env.PLOTPICKLE_STARTUP_TESTING_MODE;
  process.env.PLOTPICKLE_STARTUP_TESTING_MODE = "normal";
  const auth = await createPlotPickleAuthService({ nodeId: "command-2717", accessMode: "desktop-loopback", stateStore: createInMemoryAuthStateStore() });
  const owner = await auth.createFirstProfile({ displayName: "Synthetic Command", password: "Synthetic command password 2717" });
  let base, launches = 0, reads = 0;
  const middleware = [];
  const server = createServer((request, response) => { let index = 0; const next = () => { const handler = middleware[index++]; if (handler) handler(request, response, next); else { response.statusCode = 404; response.end(); } }; next(); });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  const boundary = createServerSessionBoundary({ authService: auth, exposure: { accessMode: "desktop-loopback", externalOrigin: base, allowedOrigins: [base], allowedHosts: [new URL(base).host] } });
  globalThis.__command2717Runtime = { accessMode: "desktop-loopback", auth, boundaryFor: () => boundary,
    privateStorage: { async readPrivateJson(context, address) { reads++; assert.equal(context.profileId, owner.authContext.profileId); assert.equal(address.objectId, "dsdd-engineering-session-v1"); return { schemaVersion: 1, sessionId: "saved-session", conversation: [] }; } },
  };
  const vite = { middlewares: { use: handler => middleware.push(handler) } };
  host.profileScopedBuzzRequestContext().configureServer(vite);
  host.registerDsddSessionGateway(vite);
  host.registerHunkReviewGateway(vite, { capabilities: async () => ({ state: "ready" }), current: async () => null, start: async () => { launches++; return {}; } });
  const browser = auth.createBrowserSession(owner.authContext, { deviceLabel: "Command fixture", originLabel: new URL(base).host });
  const request = (pathname, body, options = {}) => fetch(base + pathname, { method: body ? "POST" : "GET", headers: { host: new URL(base).host, origin: options.origin || base,
    ...(options.cookie === false ? {} : { cookie: `ppsid=${browser.cookieValue}` }), ...(options.csrf === false ? {} : { "X-PlotPickle-CSRF": browser.csrfToken }), "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  t.after(async () => { delete globalThis.__command2717Runtime; if (previous === undefined) delete process.env.PLOTPICKLE_STARTUP_TESTING_MODE; else process.env.PLOTPICKLE_STARTUP_TESTING_MODE = previous; auth.close(); await new Promise(resolve => server.close(resolve)); });
  const response = await request("/api/dsdd/command");
  assert.equal(response.status, 200);
  const value = await response.json();
  assert.equal(value.session.sessionId, "saved-session"); assert.equal(value.uat, null); assert.equal(reads, 1); assert.equal(launches, 0);
  assert.equal((await request("/api/dsdd/session")).status, 403);
  for (const options of [{ cookie: false }, { csrf: false }, { origin: "http://foreign.example" }]) {
    assert.equal((await request("/api/dsdd/review", { action: "start", target: { kind: "working-tree" } }, options)).status, 401);
    assert.equal((await request("/api/dsdd/command", { action: "append-human", text: "Synthetic report" }, options)).status, 401);
  }
  for (const action of ["observe-journey", "validate-finding"]) assert.equal((await request("/api/dsdd/command", { action })).status, 403);
  assert.equal(launches, 0); assert.equal(reads, 1);
});
