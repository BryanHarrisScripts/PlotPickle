import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

async function feedbackContract() {
  let compiled = stripTypeScriptTypes(await source("lib/product-feedback.ts"), { mode: "transform" });
  compiled = compiled.replace('import { PLOTPICKLE_REPOSITORY_URL } from "./product-direction";', 'const PLOTPICKLE_REPOSITORY_URL = "https://github.com/BryanHarrisScripts/PlotPickle";');
  return import(`data:text/javascript;base64,${Buffer.from(compiled, "utf8").toString("base64")}`);
}

test("the primary menu uses the approved short labels in order", async () => {
  const contract = await source("lib/product-direction.ts");
  const primary = contract.slice(
    contract.indexOf("export const PRIMARY_WORKFLOW_NAVIGATION"),
    contract.indexOf("export const COLLABORATION_NAVIGATION"),
  );
  const labels = ["Dashboard", "Learn", "Plan", "Storyboard", "Write", "Graphic Novel", "Build", "Feedback", "Refine", "Reports"];
  let lastIndex = -1;
  for (const label of labels) {
    const index = primary.indexOf(`label: "${label}"`);
    assert.ok(index > lastIndex, `Missing or out-of-order menu label: ${label}`);
    lastIndex = index;
  }
  assert.equal([...primary.matchAll(/label: "/g)].length, labels.length);
  assert.doesNotMatch(primary, /Introduction|Settings/);
});

test("the application renders the shared shell and command-centre Dashboard behind the splash", async () => {
  const page = await source("app/page.tsx");
  assert.match(page, /ApplicationShellHeader/);
  assert.match(page, /DashboardCommandCentre/);
  assert.match(page, /type MainTab = ProductNavigationId/);
  assert.match(page, /useState<MainTab>\("dashboard"\)/);
  assert.match(page, /const \[showLanding, setShowLanding\] = useState\(true\)/);
  assert.equal((page.match(/ref={fileInputRef}/g) ?? []).length, 1);
  assert.doesNotMatch(page, /className="dashboard-actions"/);
  assert.doesNotMatch(page, /const dashboardStatuses/);
});

test("the shared header owns workflow groups, Collab, project actions and configuration", async () => {
  const shell = await source("app/application-shell-header.tsx");
  for (const zone of ["shell-zone-discovery", "shell-zone-production", "shell-zone-collaboration", "shell-zone-project-actions", "shell-zone-configuration"]) assert.ok(shell.includes(zone), `Missing shell zone: ${zone}`);
  assert.match(shell, /Discovery &amp; Pre-Production/);
  assert.match(shell, /Production &amp; Polishing/);
  assert.match(shell, /onOpenLanding/);
  assert.match(shell, /PROJECT_ACTIONS\.map/);
  assert.match(shell, /SUPPORT_NAVIGATION\.map/);
  assert.match(shell, /Open the PlotPickle marketing page/);
});

test("Suggest Report opens a separate sanitized GitHub draft", async () => {
  const [navigation, route, workspace, issueForm] = await Promise.all([
    source("lib/support-navigation.ts"),
    source("app/suggest-report/page.tsx"),
    source("app/suggest-report-workspace.tsx"),
    source(".github/ISSUE_TEMPLATE/usability-report.yml"),
  ]);
  assert.match(navigation, /label: "Suggest \/ Report"/);
  assert.match(navigation, /href: "\/suggest-report"/);
  assert.match(route, /<SuggestReportWorkspace \/>/);
  for (const phrase of [
    "This is separate from story Feedback",
    "Feature request",
    "Bug report",
    "Usability or design flaw",
    "Sanitized preview",
    "Open GitHub Issue",
    "GitHub opens a draft, not a completed issue",
    "never approves code",
  ]) assert.ok(workspace.includes(phrase), `Suggest / Report is missing: ${phrase}`);
  assert.match(workspace, /window\.open\(issue\.url, "_blank", "noopener,noreferrer"\)/);
  assert.doesNotMatch(workspace, /project\.metadata|project\.blocks|project\.screenplay/);
  assert.match(issueForm, /name: Usability or design report/);
});

test("Suggest Report issue drafts redact credentials and preserve human triage", async () => {
  const contract = await feedbackContract();
  const githubCredential = ["gh", "p_", "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456"].join("");
  const providerCredential = ["s", "k-", "examplecredential12345"].join("");
  const localPath = ["C:", "\\Users\\Example\\AppData\\Local\\PlotPickle\\secret.json"].join("");
  const unsafe = `token=${githubCredential} ${localPath} ${providerCredential}`;
  const safe = contract.redactProductFeedbackText(unsafe);
  assert.doesNotMatch(safe, new RegExp(githubCredential));
  assert.doesNotMatch(safe, new RegExp(providerCredential));
  assert.doesNotMatch(safe, /Users\\Example/);
  assert.match(safe, /redacted/gi);
  const issue = contract.buildProductFeedbackIssue({
    kind: "feature",
    title: "Add a clearer scene filter",
    description: "Writers need to narrow the scene list by character.",
    expected: "A character filter in Write.",
    actual: "The full list is always shown.",
    privacyConfirmed: true,
  });
  assert.match(issue.title, /^\[Feature\]:/);
  assert.deepEqual(issue.labels, ["enhancement", "triage"]);
  assert.match(issue.url, /^https:\/\/github\.com\/BryanHarrisScripts\/PlotPickle\/issues\/new\?/);
  assert.match(issue.body, /Bryan reviews each item and may accept, defer or close it/);
  assert.match(issue.body, /does not authorize automatic coding/);
  assert.match(issue.body, /- \[x\] The reporter confirmed/);
  assert.ok(issue.url.length < 8_000, `Issue URL is too large: ${issue.url.length}`);
});

test("the Dashboard command centre has responsive local styling", async () => {
  const css = await source("app/dashboard-command-centre.module.css");
  assert.match(css, /grid-template-columns:250px minmax\(0,1fr\)/);
  assert.match(css, /@media\(max-width:1100px\)/);
  assert.match(css, /@media\(max-width:700px\)/);
  assert.match(css, /tone-green/);
  assert.match(css, /tone-yellow/);
  assert.match(css, /tone-red/);
});
