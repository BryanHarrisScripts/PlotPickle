import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  const occurrences = source.split(before).length - 1;
  if (occurrences !== 1) throw new Error(`${path}: expected one patch anchor, found ${occurrences}`);
  await writeFile(path, source.replace(before, after));
}

await replaceOnce(
  "scripts/windows-interaction-smoke.mjs",
  `async function runRepositoryCollabScenario(client, events, baseUrl, baseOrigin) {\n  const eventStart = events.length;\n  await navigate(client, \`\${baseUrl}/?workspace=settings\`, baseOrigin);\n  const clicked = await evaluate(client, String.raw\`(() => {\n    const target = [...document.querySelectorAll("button,[role='button'],[role='tab']")].find((element) => String(element.innerText || element.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim() === "Repository & Collab");\n    if (!target) return false;\n    target.click();\n    return true;\n  })()\`);\n`,
  `async function runRepositoryCollabScenario(client, events, baseUrl, baseOrigin) {\n  const eventStart = events.length;\n  await navigate(client, \`\${baseUrl}/?workspace=settings\`, baseOrigin);\n  const advanced = await evaluate(client, String.raw\`(() => {\n    const normalize = (value) => String(value || "").replace(/\\s+/g, " ").trim();\n    const target = [...document.querySelectorAll("button,[role='button'],[role='tab']")].find((element) => normalize(element.innerText || element.getAttribute("aria-label")) === "Other settings");\n    if (!target) return false;\n    target.click();\n    return true;\n  })()\`);\n  if (!advanced) return { passed: false, failures: ["Other settings control was not found in Settings."] };\n  await waitForReady(client, baseOrigin);\n  const clicked = await evaluate(client, String.raw\`(() => {\n    const target = [...document.querySelectorAll("button,[role='button'],[role='tab']")].find((element) => String(element.innerText || element.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim() === "Repository & Collab");\n    if (!target) return false;\n    target.click();\n    return true;\n  })()\`);\n`,
);

await replaceOnce(
  "scripts/windows-release-smoke.mjs",
  `async function waitForHydratedButton(client, text, timeoutMs = 20_000) {\n  await waitFor(client, hydratedButtonExpression(text), timeoutMs, \`Hydrated \${text} button\`);\n}\n\nfunction shellReadyExpression(workspace) {\n`,
  `async function waitForHydratedButton(client, text, timeoutMs = 20_000) {\n  await waitFor(client, hydratedButtonExpression(text), timeoutMs, \`Hydrated \${text} button\`);\n}\n\nasync function openAdvancedSettings(client) {\n  await waitForHydratedButton(client, "Other settings");\n  const clicked = await evaluate(client, \`(() => { \${browserNormalizeFunction()} const button = [...document.querySelectorAll("button")].find((item) => normalize(item.innerText) === "Other settings"); if (!button) return false; button.click(); return true; })()\`);\n  if (!clicked) throw new Error("Other settings was not found in Settings.");\n  await waitFor(client, \`document.body.innerText.includes("Configure PlotPickle by system.")\`, 20_000, "Advanced Settings panel");\n}\n\nfunction shellReadyExpression(workspace) {\n`,
);

await replaceOnce(
  "scripts/windows-release-smoke.mjs",
  `      await waitForShell(client, "settings");\n      await waitFor(client, \`document.body.innerText.includes("Configure PlotPickle by system.")\`, 20_000, "Settings panel");\n      await waitFor(client, String.raw\`(() => {\n`,
  `      await waitForShell(client, "settings");\n      await openAdvancedSettings(client);\n      await waitFor(client, String.raw\`(() => {\n`,
);

await replaceOnce(
  "scripts/windows-release-smoke.mjs",
  `      await waitForShell(client, "settings");\n      await waitFor(client, \`document.body.innerText.includes("Configure PlotPickle by system.")\`, 20_000, "Settings panel");\n      await evaluate(client, String.raw\`(() => {\n`,
  `      await waitForShell(client, "settings");\n      await openAdvancedSettings(client);\n      await evaluate(client, String.raw\`(() => {\n`,
);

await replaceOnce(
  "scripts/windows-issue-208-smoke.mjs",
  `      await navigate(client, \`\${baseUrl}/?workspace=learn\`);\n      await waitForShell(client, "Learn");\n      await waitFor(client, \`Boolean(document.querySelector(".learn-section-tabs"))\`, 15_000, "Learn tabs");\n`,
  `      await navigate(client, \`\${baseUrl}/?workspace=learn\`);\n      await waitFor(client, \`Boolean(document.querySelector(".application-shell-header"))\`, 25_000, "Learn application shell header");\n      const selectedLearn = await evaluate(client, \`(() => { \${normalizeFunction} const tab = [...document.querySelectorAll('[role="tab"]')].find((item) => normalize(item.innerText) === "Learn"); if (!tab) return false; if (tab.getAttribute("aria-selected") !== "true") tab.click(); return true; })()\`);\n      if (!selectedLearn) throw new Error("Learn workspace tab was not found in the application shell.");\n      await waitForShell(client, "Learn", 40_000);\n      await waitFor(client, \`Boolean(document.querySelector(".learn-section-tabs"))\`, 20_000, "Learn tabs");\n`,
);
