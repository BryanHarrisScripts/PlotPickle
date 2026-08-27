from pathlib import Path
import subprocess

ROOT = Path.cwd()
OLD_TSX = "app/community-agent-roster.tsx"
NEW_TSX = "app/_components/community/community-agent-roster.tsx"
OLD_CSS = "app/community-agent-roster.module.css"
NEW_CSS = "app/_components/community/community-agent-roster.module.css"


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace(path: str, old: str, new: str) -> None:
    content = read(path)
    if old not in content:
        raise SystemExit(f"Expected text not found in {path}: {old}")
    write(path, content.replace(old, new))


def replace_tracked_refs(old: str, new: str) -> None:
    result = subprocess.run(
        ["git", "grep", "-l", "--fixed-strings", old, "--", "tests", "config", ".github/workflows"],
        text=True,
        capture_output=True,
    )
    if result.returncode not in (0, 1):
        raise SystemExit(result.stderr)
    for path in [line.strip() for line in result.stdout.splitlines() if line.strip()]:
        content = read(path)
        write(path, content.replace(old, new))


subprocess.run(["git", "mv", OLD_TSX, NEW_TSX], check=True)
subprocess.run(["git", "mv", OLD_CSS, NEW_CSS], check=True)

for old, new in [
    ('from "../components/agent-portrait"', 'from "../../../components/agent-portrait"'),
    ('from "../core/auth/profile-request-browser"', 'from "../../../core/auth/profile-request-browser"'),
    ('from "../core/project/project"', 'from "../../../core/project/project"'),
    ('from "../core/storage/foundation-project-browser"', 'from "../../../core/storage/foundation-project-browser"'),
    ('from "../lib/plugin-platform"', 'from "../../../lib/plugin-platform"'),
    ('from "../lib/buzz/community-agent-roster"', 'from "../../../lib/buzz/community-agent-roster"'),
    ('from "../plugins/plotpickle-playhouse"', 'from "../../../plugins/plotpickle-playhouse"'),
]:
    replace(NEW_TSX, old, new)

replace(
    "app/community-workspace.tsx",
    'from "./community-agent-roster"',
    'from "./_components/community/community-agent-roster"',
)

replace_tracked_refs(OLD_TSX, NEW_TSX)
replace_tracked_refs(OLD_CSS, NEW_CSS)

regression_path = "tests/issue-1464-app-domain-consolidation.test.mjs"
regression = read(regression_path)
addition = r'''

test("#1511 gives the Community Agent roster one canonical UI owner without changing Agent authority", async () => {
  await assert.rejects(access(new URL("app/community-agent-roster.tsx", root)));
  await assert.rejects(access(new URL("app/community-agent-roster.module.css", root)));
  await access(new URL("app/_components/community/community-agent-roster.tsx", root));
  await access(new URL("app/_components/community/community-agent-roster.module.css", root));

  const [workspace, roster, architectureText] = await Promise.all([
    read("app/community-workspace.tsx"),
    read("app/_components/community/community-agent-roster.tsx"),
    read("config/repository-architecture-target.json"),
  ]);

  assert.match(workspace, /\.\/_components\/community\/community-agent-roster/);
  assert.doesNotMatch(workspace, /from "\.\/community-agent-roster"/);
  assert.match(roster, /from "\.\.\/\.\.\/\.\.\/core\/auth\/profile-request-browser"/);
  assert.match(roster, /from "\.\.\/\.\.\/\.\.\/lib\/buzz\/community-agent-roster"/);
  assert.match(roster, /authenticatedProfileFetch/);
  assert.match(roster, /Project sharing is off by default/);
  assert.match(roster, /The connected Human signer is never an Agent signer/);
  assert.match(roster, /PPF unchanged/);

  const architecture = JSON.parse(architectureText);
  const communityBatch = architecture.moveBatches.find((item) => item.id === "phase3-app-community-components");
  assert.ok(communityBatch, "the ratified Community batch must remain governed");
  assert.notEqual(communityBatch.status, "completed", "Community phase must remain open while other root Community UI remains");

  const appEntries = await readdir(new URL("app/", root));
  const remainingCommunityRoots = appEntries.filter((name) => name.startsWith("community-"));
  assert.ok(remainingCommunityRoots.length > 0, "the roster leaf move must not pretend the wider Community batch is complete");
  assert.ok(!remainingCommunityRoots.includes("community-agent-roster.tsx"));
  assert.ok(!remainingCommunityRoots.includes("community-agent-roster.module.css"));
});
'''
if '#1511 gives the Community Agent roster' in regression:
    raise SystemExit("#1511 regression already exists")
write(regression_path, regression.rstrip() + addition)

for needle in (OLD_TSX, OLD_CSS):
    result = subprocess.run(["git", "grep", "-n", "--fixed-strings", needle, "--", "."], text=True, capture_output=True)
    if result.returncode not in (0, 1):
        raise SystemExit(result.stderr)
    unexpected = []
    for line in result.stdout.splitlines():
        path = line.split(":", 1)[0]
        if path == regression_path:
            continue
        if path.startswith("docs/architecture/") or path == ".github/scripts/issue-1511-community-agent-roster-move.py":
            continue
        unexpected.append(line)
    if unexpected:
        raise SystemExit(f"Unexpected stale path {needle}:\n" + "\n".join(unexpected))
