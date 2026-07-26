import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(source, before, after, path) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one match, found ${count}`);
  return source.replace(before, after);
}

const auditPath = "scripts/lighthouse-audit.mjs";
let audit = readFileSync(auditPath, "utf8");
audit = replaceOnce(
  audit,
  'import { spawn } from "node:child_process";\n',
  'import { spawnCommand } from "./spawn-command.mjs";\n',
  auditPath,
);
audit = replaceOnce(
  audit,
  '    const child = spawn(command, args, { cwd: ROOT, stdio: options.stdio ?? "inherit", shell: process.platform === "win32", ...options });',
  '    const child = spawnCommand(command, args, { cwd: ROOT, stdio: options.stdio ?? "inherit", ...options });',
  auditPath,
);
audit = replaceOnce(
  audit,
  '  return spawn(commandForNpx(), ["--yes", "vite", "preview", "--host", HOST, "--port", String(port)], {\n    cwd: ROOT,\n    stdio: ["ignore", "pipe", "pipe"],\n    shell: process.platform === "win32",\n  });',
  '  return spawnCommand(commandForNpx(), ["--yes", "vite", "preview", "--host", HOST, "--port", String(port)], {\n    cwd: ROOT,\n    stdio: ["ignore", "pipe", "pipe"],\n  });',
  auditPath,
);
writeFileSync(auditPath, audit);

const testPath = "tests/issue-104-windows-paths.test.mjs";
writeFileSync(testPath, `import assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\nimport test from "node:test";\n\nconst root = new URL("..", import.meta.url);\nconst source = (path) => readFile(new URL(path, root), "utf8");\n\ntest("issue #104 preserves Windows executable paths containing spaces", async () => {\n  const [helper, build, timeout, audit] = await Promise.all([\n    source("scripts/spawn-command.mjs"),\n    source("scripts/build-verified.mjs"),\n    source("scripts/run-command-with-timeout.mjs"),\n    source("scripts/lighthouse-audit.mjs"),\n  ]);\n\n  assert.match(helper, /process\\.env\\.ComSpec/);\n  assert.match(helper, /\\.\\(\\?:cmd\\|bat\\\\\\$\\)/);\n  assert.match(helper, /shell: false/);\n  assert.match(helper, /quoteForCommandPrompt/);\n  assert.match(helper, /C:\\\\Program Files\\\\nodejs\\\\node\\.exe/);\n\n  for (const file of [build, timeout, audit]) {\n    assert.match(file, /spawnCommand/);\n    assert.doesNotMatch(file, /shell:\\s*process\\.platform\\s*===\\s*["']win32["']/);\n    assert.doesNotMatch(file, /shell:\\s*true/);\n  }\n\n  assert.match(build, /process\\.execPath/);\n  assert.match(audit, /npm\\.cmd/);\n  assert.match(audit, /npx\\.cmd/);\n});\n`);

console.log("Issue #104 Windows command migration applied.");
