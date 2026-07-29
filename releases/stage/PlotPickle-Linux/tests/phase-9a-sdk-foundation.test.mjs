import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Phase 9A exposes versioned SDK packages", async () => {
  const [types, client, corePackage, typesPackage] = await Promise.all([
    read("sdk/types/src/index.ts"),
    read("sdk/core/src/client.ts"),
    read("sdk/core/package.json"),
    read("sdk/types/package.json"),
  ]);
  assert.match(types, /PLOTPICKLE_SDK_API_VERSION = "1\.0\.0"/);
  assert.match(types, /PlotPickleServices/);
  assert.match(client, /connectPlotPickle/);
  assert.match(client, /INCOMPATIBLE_API/);
  assert.equal(JSON.parse(corePackage).name, "@plotpickle/sdk");
  assert.equal(JSON.parse(typesPackage).name, "@plotpickle/types");
});

test("Phase 9A publishes a machine-readable host contract and stability guide", async () => {
  const schema = JSON.parse(await read("sdk/schemas/sdk-host.schema.json"));
  const docs = await read("docs/PHASE-9A-SDK-FOUNDATION.md");
  assert.equal(schema.properties.apiVersion.const, "1.0.0");
  assert.deepEqual(schema.required, ["apiVersion", "services"]);
  assert.match(docs, /explicit API version/);
  assert.match(docs, /breaking changes require a new API version/);
});
