import { readFile, writeFile } from "node:fs/promises";

async function patch(path, transform) {
  const before = await readFile(path, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`Expected patch did not change ${path}`);
  await writeFile(path, after, "utf8");
}

await patch("app/page.tsx", (source) => {
  let next = source.replace(
    'import LearningStudio from "./learning-studio";\n',
    'import LearningStudio from "./learning-studio";\nimport LearnThreeColumnShell from "./learn-three-column-shell";\n',
  );
  next = next.replace(
    '{learnSection === "library" ? (\n              <LearningStudio',
    '{learnSection === "library" ? (\n              <LearnThreeColumnShell project={project} blockNumber={selectedBlockNumber} miniBlockNumber={selectedMiniBlockNumber}>\n              <LearningStudio',
  );
  next = next.replace(
    '                onOpenBlock={(number) => openBlock(number, "planner")}\n              />\n            ) : null}',
    '                onOpenBlock={(number) => openBlock(number, "planner")}\n              />\n              </LearnThreeColumnShell>\n            ) : null}',
  );
  return next;
});

await patch("scripts/ui-continuity-agent.mjs", (source) => {
  let next = source.replace(
    'async function main() {',
    `async function cleanupPluginData(pluginData) {\n  let lastError = null;\n  for (let attempt = 0; attempt < 6; attempt += 1) {\n    try {\n      await rm(pluginData, { recursive: true, force: true, maxRetries: 2, retryDelay: 250 });\n      return { cleaned: true, warning: "" };\n    } catch (error) {\n      lastError = error;\n      await delay(300 * (attempt + 1));\n    }\n  }\n  const message = lastError instanceof Error ? lastError.message : String(lastError || "unknown cleanup error");\n  return { cleaned: false, warning: \\`Temporary Playwright workspace is still locked by Windows and will be reclaimed later: \\${message}\\` };\n}\n\nasync function main() {`,
  );
  next = next.replace(
    '  } finally {\n    await client.close();\n    await rm(pluginData, { recursive: true, force: true });\n  }\n\n  const report = continuityReport',
    '  } finally {\n    await client.close();\n  }\n\n  const cleanup = await cleanupPluginData(pluginData);\n  if (cleanup.warning) process.stdout.write(`UI Continuity Agent cleanup warning: ${cleanup.warning}\\n`);\n\n  const report = continuityReport',
  );
  return next;
});

console.log("Applied Learn three-column shell and resilient UI Continuity cleanup patches.");
