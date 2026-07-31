import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = (value) => path.join(root, value);

async function text(relative) {
  return readFile(file(relative), "utf8");
}

async function save(relative, value) {
  await writeFile(file(relative), value, "utf8");
}

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Issue #242 could not find ${label}.`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Issue #242 found more than one ${label}.`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

let gateway = await text("build/buzz-gateway.ts");
gateway = replaceOnce(
  gateway,
  'import path from "node:path";\n',
  'import path from "node:path";\nimport { resolveBuzzCliExecutable } from "./buzz-desktop-discovery";\n',
  "Buzz discovery import location",
);
gateway = replaceOnce(
  gateway,
  `function buzzExecutable(connection: BuzzConnection | null) {\n  return connection?.cliPath.trim() || (process.platform === "win32" ? "buzz.exe" : "buzz");\n}\n\n`,
  "",
  "legacy Buzz executable resolver",
);
gateway = replaceOnce(
  gateway,
  `async function cliStatus(connection: BuzzConnection | null) {\n  const executable = buzzExecutable(connection);\n  try {\n    const result = await command(executable, ["--version"], { timeoutMs: 8_000 });\n    return { available: true, executable, version: result.stdout || result.stderr || "Available", error: "" };\n  } catch (error) {\n    return { available: false, executable, version: "", error: safeError(error) };\n  }\n}\n\nasync function runBuzz(connection: BuzzConnection, args: string[], options: { write?: boolean; input?: string } = {}) {\n  if (options.write && !connection.privateKey) throw new Error("Add an existing Buzz private identity key before creating rooms or sending messages.");\n  const result = await command(buzzExecutable(connection), args, {`,
  `async function cliStatus(connection: BuzzConnection | null) {\n  const resolution = await resolveBuzzCliExecutable(connection?.cliPath ?? "");\n  const executable = resolution.executable;\n  try {\n    const result = await command(executable, ["--version"], { timeoutMs: 8_000 });\n    return {\n      available: true,\n      executable,\n      version: result.stdout || result.stderr || "Available",\n      error: "",\n      source: resolution.source,\n      discovered: resolution.discovered,\n      releaseTag: resolution.releaseTag,\n    };\n  } catch (error) {\n    return {\n      available: false,\n      executable,\n      version: "",\n      error: safeError(error),\n      source: resolution.source,\n      discovered: resolution.discovered,\n      releaseTag: resolution.releaseTag,\n    };\n  }\n}\n\nasync function runBuzz(connection: BuzzConnection, args: string[], options: { write?: boolean; input?: string } = {}) {\n  if (options.write && !connection.privateKey) throw new Error("Add an existing Buzz private identity key before creating rooms or sending messages.");\n  const resolution = await resolveBuzzCliExecutable(connection.cliPath);\n  const result = await command(resolution.executable, args, {`,
  "Buzz CLI status and execution block",
);
await save("build/buzz-gateway.ts", gateway);

let settings = await text("app/buzz-settings-panel.tsx");
settings = replaceOnce(
  settings,
  '  cli: { available: boolean; executable: string; version: string; error: string };',
  '  cli: { available: boolean; executable: string; version: string; error: string; source: "configured" | "environment" | "buzz-desktop" | "path"; discovered: boolean; releaseTag: string };',
  "Buzz status CLI type",
);
settings = replaceOnce(
  settings,
  '<article><span>Buzz CLI</span><strong>{cliAvailable ? status?.cli.version || "Available" : "Unavailable"}</strong><small>{status?.cli.executable || status?.cli.error || "Required for signed room and message operations"}</small></article>',
  '<article><span>Buzz CLI</span><strong>{cliAvailable ? status?.cli.version || "Available" : "Unavailable"}</strong><small>{status?.cli.executable ? `${status.cli.executable}${status.cli.source === "buzz-desktop" ? " · detected from Buzz Desktop" : ""}` : status?.cli.error || "Required for signed room and message operations"}</small></article>',
  "Buzz CLI status card",
);
settings = replaceOnce(
  settings,
  '<label><span>Buzz CLI path</span><input value={form.cliPath} onChange={(event) => patch({ cliPath: event.target.value })} placeholder="buzz or C:\\\\Tools\\\\buzz.exe" /></label>',
  '<label><span>Buzz CLI path (optional)</span><input value={form.cliPath} onChange={(event) => patch({ cliPath: event.target.value })} placeholder="Leave blank to use Buzz Desktop automatically" /><small>Buzz Desktop v0.5.3 includes the supported CLI sidecar.</small></label>',
  "Buzz CLI input",
);
settings = replaceOnce(
  settings,
  'Install or select the supported Buzz CLI. ',
  'Install Buzz Desktop v0.5.3 or select a supported Buzz CLI. ',
  "Buzz CLI readiness guidance",
);
await save("app/buzz-settings-panel.tsx", settings);

let suite = await text("tests/issue-210-managed-buzz-runtime.test.mjs");
suite = replaceOnce(
  suite,
  'import "./issue-216-buzz-integration-fix.test.mjs";\n',
  'import "./issue-216-buzz-integration-fix.test.mjs";\nimport "./issue-242-buzz-desktop-discovery.test.mjs";\n',
  "managed Buzz suite imports",
);
await save("tests/issue-210-managed-buzz-runtime.test.mjs", suite);

const diagnosticsPath = "config/developer-diagnostics.json";
const diagnostics = JSON.parse(await text(diagnosticsPath));
const add = (list, value) => { if (!list.includes(value)) list.push(value); };
const buzz = diagnostics.areas.find((area) => area.id === "buzz");
if (!buzz) throw new Error("Issue #242 could not find the Buzz diagnostics area.");
for (const value of [
  "tests/issue-242-*.test.mjs",
  "docs/issue-242-buzz-desktop-discovery.md",
]) add(buzz.patterns, value);
add(buzz.suites, "tests/issue-242-buzz-desktop-discovery.test.mjs");
for (const value of [
  "tests/issue-242-*.test.mjs",
  "docs/issue-242-buzz-desktop-discovery.md",
]) add(buzz.allowedPaths, value);
const runtime = diagnostics.contracts["buzz.runtime"];
if (!runtime) throw new Error("Issue #242 could not find the Buzz runtime contract.");
if (!runtime.owners.some((owner) => owner.path === "build/buzz-desktop-discovery.ts")) {
  runtime.owners.push({ path: "build/buzz-desktop-discovery.ts", optional: false });
}
add(runtime.tests, "tests/issue-242-buzz-desktop-discovery.test.mjs");
const settingsContract = diagnostics.contracts["settings.buzz"];
if (!settingsContract) throw new Error("Issue #242 could not find the Buzz Settings contract.");
add(settingsContract.tests, "tests/issue-242-buzz-desktop-discovery.test.mjs");
await save(diagnosticsPath, `${JSON.stringify(diagnostics, null, 2)}\n`);

await rm(file("scripts/issue-242-apply.mjs"));
