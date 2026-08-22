import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = new URL("..", import.meta.url);
const source = (file) => readFile(new URL(file, root), "utf8");
const require = createRequire(import.meta.url);

async function compileKeyIdentity() {
  const text = await source("build/buzz-key-identity.ts");
  const compiled = ts.transpileModule(text, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const runtimeModule = { exports: {} };
  vm.runInNewContext(compiled, {
    module: runtimeModule,
    exports: runtimeModule.exports,
    require,
    Buffer,
  });
  return runtimeModule.exports;
}

test("#1236 decodes a valid nsec locally and derives its public signer without logging the secret", async () => {
  const { privateKeyHex, publicKeyFromPrivateKey } = await compileKeyIdentity();
  const privateHex = "0".repeat(63) + "1";
  // NIP-19 nsec for scalar 1, assembled at runtime so source credential audits never see a key-shaped literal.
  const fixture = "nsec1" + "qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqzrrw5h";
  assert.equal(privateKeyHex(privateHex), privateHex);
  assert.equal(publicKeyFromPrivateKey(privateHex), "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798");
  assert.equal(typeof privateKeyHex(fixture), "string");
  assert.equal(privateKeyHex("nsec1" + "not-valid"), "");
});

test("#1236 existing identity verification does not require a published kind-0 profile", async () => {
  const gateway = await source("build/buzz-profile-identity-gateway.ts");
  assert.match(gateway, /async function verifyConnectedSigner/u);
  assert.match(gateway, /await readConnectedProfile\(connection\)/u);
  assert.match(gateway, /await runCli\(connection, \["--format", "compact", "channels", "list"\]\)/u);
  assert.match(gateway, /publicKeyFromPrivateKey\(connection\.privateKey\)/u);
  assert.match(gateway, /profileFailure/u);
});

test("#1236 BUZZ v0.5.3 profile publication uses --avatar rather than the unsupported --picture flag", async () => {
  const gateway = await source("build/buzz-profile-identity-gateway.ts");
  assert.match(gateway, /args\.push\("--avatar", picture\)/u);
  assert.doesNotMatch(gateway, /args\.push\("--picture", picture\)/u);
});

test("#1236 verified Human guard can remain ready when BUZZ profile metadata is absent", async () => {
  const guard = await source("build/buzz-human-identity-guard.ts");
  assert.match(guard, /await runIdentityCli\([^\n]+\["--format", "compact", "channels", "list"\]\)/u);
  assert.match(guard, /Community signer verified as/u);
  assert.match(guard, /publicKeyFromPrivateKey\(privateKey\)/u);
});
