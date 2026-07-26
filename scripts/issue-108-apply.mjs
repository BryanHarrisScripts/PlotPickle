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
  `function commandForNpx() {\n  return process.platform === "win32" ? "npx.cmd" : "npx";\n}\n`,
  `function commandForNpx() {\n  return process.platform === "win32" ? "npx.cmd" : "npx";\n}\n\nexport function waitForWritableOpen(stream) {\n  if (stream.fd !== null) return Promise.resolve();\n  return new Promise((resolvePromise, reject) => {\n    const cleanup = () => {\n      stream.off("open", onOpen);\n      stream.off("error", onError);\n    };\n    const onOpen = () => { cleanup(); resolvePromise(); };\n    const onError = (error) => { cleanup(); reject(error); };\n    stream.once("open", onOpen);\n    stream.once("error", onError);\n  });\n}\n\nexport function closeWritable(stream) {\n  if (stream.closed) return Promise.resolve();\n  return new Promise((resolvePromise, reject) => {\n    const cleanup = () => {\n      stream.off("close", onClose);\n      stream.off("error", onError);\n    };\n    const onClose = () => { cleanup(); resolvePromise(); };\n    const onError = (error) => { cleanup(); reject(error); };\n    stream.once("close", onClose);\n    stream.once("error", onError);\n    stream.end();\n  });\n}\n`,
  auditPath,
);
audit = replaceOnce(
  audit,
  `  const log = createWriteStream(logPath, { flags: "w" });\n  let exitCode = 0;\n  try {\n    await run(commandForNpx(), args, { stdio: ["ignore", log, log] });\n  } catch (error) {\n    exitCode = 1;\n    log.write(\`\\n\${error.stack ?? error.message}\\n\`);\n  } finally {\n    log.end();\n  }\n`,
  `  const log = createWriteStream(logPath, { flags: "w" });\n  let exitCode = 0;\n  try {\n    await waitForWritableOpen(log);\n    await run(commandForNpx(), args, { stdio: ["ignore", log, log] });\n  } catch (error) {\n    exitCode = 1;\n    if (!log.destroyed) log.write(\`\\n\${error.stack ?? error.message}\\n\`);\n  } finally {\n    await closeWritable(log);\n  }\n`,
  auditPath,
);
writeFileSync(auditPath, audit);

const testPath = "tests/issue-86-lighthouse-audit.test.mjs";
let tests = readFileSync(testPath, "utf8");
tests += `\n\ntest("issue #108 waits for Lighthouse log streams before child-process stdio", async () => {\n  const audit = await source("scripts/lighthouse-audit.mjs");\n  assert.match(audit, /export function waitForWritableOpen/);\n  assert.match(audit, /stream\\.once\\("open"/);\n  assert.match(audit, /await waitForWritableOpen\\(log\\)/);\n  assert.match(audit, /export function closeWritable/);\n  assert.match(audit, /stream\\.once\\("close"/);\n  assert.match(audit, /await closeWritable\\(log\\)/);\n  assert.doesNotMatch(audit, /finally \\{\\s*log\\.end\\(\\);/);\n});\n`;
writeFileSync(testPath, tests);

console.log("Issue #108 log-stream readiness fix applied.");
