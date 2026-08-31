import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(root, file), "utf8");

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(target));
    else if (/\.(?:ts|tsx|js|jsx|mjs)$/i.test(entry.name)) files.push(target);
  }
  return files;
}

test("#1569 scheduler is discoverable through Settings and has its own bounded route", async () => {
  const [sitemap, page, panel] = await Promise.all([
    read("app/settings-sitemap.tsx"),
    read("app/settings/autonomous-guest/page.tsx"),
    read("app/autonomous-guest-scheduler-settings.tsx"),
  ]);
  assert.match(sitemap, /label="Autonomous Guest"/);
  assert.match(sitemap, /meta="Agents"/);
  assert.match(sitemap, /href="\/settings\/autonomous-guest"/);
  assert.match(sitemap, /Open Task Scheduler/);
  assert.match(page, /Settings → Autonomous Guest → Task Scheduler/);
  assert.match(page, /<AutonomousGuestSchedulerSettings \/>/);
  assert.match(panel, /aria-label="Autonomous Guest Task Scheduler"/);
});

test("#1569 Settings shows required bounded status, history and controls", async () => {
  const source = await read("app/autonomous-guest-scheduler-settings.tsx");
  for (const label of ["Pending", "Running", "Blocked", "Recent history", "Run now", "Schedule", "Pause", "Resume", "Cancel task", "Disable scheduling"]) {
    assert.match(source, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(source, /snapshot\.nextRunAt/);
  assert.match(source, /snapshot\.history/);
  assert.match(source, /snapshot\.activeTasks/);
  assert.match(source, /window\.confirm/);
});

test("#1569 scheduler controls do not appear on creative product surfaces", async () => {
  const appRoot = path.join(root, "app");
  const allowed = new Set([
    path.join(appRoot, "autonomous-guest-scheduler-settings.tsx"),
    path.join(appRoot, "settings-sitemap.tsx"),
    path.join(appRoot, "settings", "autonomous-guest", "page.tsx"),
    path.join(appRoot, "api", "autonomous-guest", "scheduler", "route.ts"),
  ]);
  for (const file of await sourceFiles(appRoot)) {
    if (allowed.has(file)) continue;
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /Autonomous Guest Task Scheduler|Open Task Scheduler|\/api\/autonomous-guest\/scheduler/, `scheduler UI leaked into ${path.relative(root, file)}`);
  }
});

test("#1569 Settings API derives current Guest authority and never inherits Human or BUZZ authority", async () => {
  const source = await read("app/api/autonomous-guest/scheduler/route.ts");
  assert.match(source, /getProfileExperienceRuntime/);
  assert.match(source, /getAutonomousGuestAuthority\(new URL\(request\.url\)\.origin, runtimeState\.accessMode\)/);
  assert.match(source, /unavailableAutonomousGuestSchedulerSettings/);
  assert.doesNotMatch(source, /authenticated-human|humanProfileId|readCredentialJson|writeCredentialJson|apiKey|password|privateKey|BUZZ/i);
});

test("#1569 Settings service reuses ledger, durable policy and Mastra controls without executing story routes", async () => {
  const source = await read("build/autonomous-guest/settings/scheduler-settings.ts");
  assert.match(source, /readAutonomousGuestTaskLedger/);
  assert.match(source, /readAutonomousGuestRunPolicy/);
  assert.match(source, /writeAutonomousGuestRunPolicy/);
  assert.match(source, /scheduleAutonomousGuestTaskCron/);
  assert.match(source, /runAutonomousGuestTaskScheduleNow/);
  assert.match(source, /pauseAutonomousGuestTaskSchedule/);
  assert.match(source, /resumeAutonomousGuestTaskSchedule/);
  assert.match(source, /cancelAutonomousGuestTaskSchedule/);
  assert.match(source, /HISTORY_LIMIT = 12/);
  assert.match(source, /ACTIVE_TASK_LIMIT = 24/);
  assert.doesNotMatch(source, /executeRoute|playwright|applyStory|writeProject|saveFoundationProject|ppf|canonStore|database|sqlite/i);
  assert.doesNotMatch(source, /chainOfThought|reasoningTrace|modelOutput|apiKey|password|privateKey|BUZZ/i);
});

test("#1569 disabling scheduling preserves ledger and history rather than deleting evidence", async () => {
  const source = await read("build/autonomous-guest/settings/scheduler-settings.ts");
  assert.match(source, /writeAutonomousGuestRunPolicy\(authority, \{ \.\.\.policy, enabled: input\.enabled \}\)/);
  assert.doesNotMatch(source, /deleteAutonomousGuestTaskLedger|dangerouslyClearAll|rm\(|unlink\(/);
});
