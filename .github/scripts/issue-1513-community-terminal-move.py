from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

OLD_TS = ROOT / "app/community-backdoor-terminal.tsx"
NEW_TS = ROOT / "app/_components/community/community-backdoor-terminal.tsx"
OLD_CSS = ROOT / "app/community-backdoor-terminal.module.css"
NEW_CSS = ROOT / "app/_components/community/community-backdoor-terminal.module.css"


def move_one(old: Path, new: Path) -> None:
    if old.exists() and new.exists():
        raise SystemExit(f"Refusing ambiguous move; both paths exist: {old} and {new}")
    if not old.exists() and not new.exists():
        raise SystemExit(f"Expected source or destination is missing: {old} / {new}")
    if old.exists():
        new.parent.mkdir(parents=True, exist_ok=True)
        old.replace(new)


def replace_exact(path: Path, old: str, new: str, expected_count: int | None = None) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if expected_count is not None and count != expected_count:
        raise SystemExit(f"{path}: expected {expected_count} occurrence(s) of {old!r}, found {count}")
    if expected_count is None and count == 0:
        if new in text:
            return
        raise SystemExit(f"{path}: expected text not found: {old!r}")
    path.write_text(text.replace(old, new), encoding="utf-8")


move_one(OLD_TS, NEW_TS)
move_one(OLD_CSS, NEW_CSS)

# The component body stays move-only; only imports that became two levels deeper change.
replace_exact(
    NEW_TS,
    'from "../lib/buzz/buzz-guildhall"',
    'from "../../../lib/buzz/buzz-guildhall"',
    1,
)
replace_exact(
    NEW_TS,
    'from "../lib/buzz/buzz-story-room"',
    'from "../../../lib/buzz/buzz-story-room"',
    1,
)

# Focused historical/path-sensitive tests follow the canonical owner.
replace_exact(
    ROOT / "tests/issue-1010-community-backdoor-terminal.test.mjs",
    '"app/community-backdoor-terminal.tsx"',
    '"app/_components/community/community-backdoor-terminal.tsx"',
)
replace_exact(
    ROOT / "tests/issue-1010-community-backdoor-terminal.test.mjs",
    '"app/community-backdoor-terminal.module.css"',
    '"app/_components/community/community-backdoor-terminal.module.css"',
)
replace_exact(
    ROOT / "tests/issue-1066-community-three-column-shell.test.mjs",
    '"app/community-backdoor-terminal.tsx"',
    '"app/_components/community/community-backdoor-terminal.tsx"',
)

# Permanent BUZZ CI must keep following the canonical source on PRs and main pushes.
replace_exact(
    ROOT / ".github/workflows/buzz-guildhall.yml",
    '"app/community-backdoor-terminal.tsx"',
    '"app/_components/community/community-backdoor-terminal.tsx"',
    2,
)

architecture_test = ROOT / "tests/issue-1464-app-domain-consolidation.test.mjs"
architecture_text = architecture_test.read_text(encoding="utf-8")
marker = '#1513 gives the Community backdoor terminal one canonical UI owner'
if marker not in architecture_text:
    architecture_text = architecture_text.rstrip() + r'''


test("#1513 gives the Community backdoor terminal one canonical UI owner without changing its safety boundary", async () => {
  await assert.rejects(access(new URL("app/community-backdoor-terminal.tsx", root)));
  await assert.rejects(access(new URL("app/community-backdoor-terminal.module.css", root)));
  await access(new URL("app/_components/community/community-backdoor-terminal.tsx", root));
  await access(new URL("app/_components/community/community-backdoor-terminal.module.css", root));

  const [terminal, architectureText] = await Promise.all([
    read("app/_components/community/community-backdoor-terminal.tsx"),
    read("config/repository-architecture-target.json"),
  ]);

  assert.match(terminal, /from "\.\.\/\.\.\/\.\.\/lib\/buzz\/buzz-guildhall"/);
  assert.match(terminal, /from "\.\.\/\.\.\/\.\.\/lib\/buzz\/buzz-story-room"/);
  assert.match(terminal, /THIS TERMINAL NEVER EXECUTES OS\/SHELL COMMANDS/);
  assert.doesNotMatch(terminal, /child_process|spawn\(|exec\(|powershell|cmd\.exe|bash\b|xterm/i);

  const architecture = JSON.parse(architectureText);
  const communityBatch = architecture.moveBatches.find((item) => item.id === "phase3-app-community-components");
  assert.ok(communityBatch, "the ratified Community batch must remain governed");
  assert.notEqual(communityBatch.status, "completed", "Community phase must remain open while other root Community UI remains");

  const appEntries = await readdir(new URL("app/", root));
  const remainingCommunityRoots = appEntries.filter((name) => name.startsWith("community-"));
  assert.ok(remainingCommunityRoots.length > 0, "the terminal leaf move must not pretend the wider Community batch is complete");
  assert.ok(!remainingCommunityRoots.includes("community-backdoor-terminal.tsx"));
  assert.ok(!remainingCommunityRoots.includes("community-backdoor-terminal.module.css"));
});
'''
    architecture_test.write_text(architecture_text, encoding="utf-8")

# Final local structural assertions before tests/build run.
if OLD_TS.exists() or OLD_CSS.exists():
    raise SystemExit("Old root terminal paths were not retired")
if not NEW_TS.exists() or not NEW_CSS.exists():
    raise SystemExit("Canonical terminal paths are missing")

terminal_text = NEW_TS.read_text(encoding="utf-8")
if 'from "../lib/buzz/' in terminal_text:
    raise SystemExit("A stale root-relative BUZZ import remains in the moved terminal")
if 'from "../../../lib/buzz/buzz-guildhall"' not in terminal_text or 'from "../../../lib/buzz/buzz-story-room"' not in terminal_text:
    raise SystemExit("Canonical BUZZ imports are missing from the moved terminal")

print("#1513 Community terminal move prepared successfully.")
