from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (root / path).read_text(encoding="utf-8")


def write(path: str, value: str) -> None:
    (root / path).write_text(value, encoding="utf-8")


def insert_once(path: str, marker: str, addition: str, before: bool = False) -> None:
    source = read(path)
    if addition.strip() in source:
        return
    count = source.count(marker)
    if count != 1:
        raise RuntimeError(f"Expected one marker in {path}, found {count}: {marker[:100]!r}")
    replacement = addition + marker if before else marker + addition
    write(path, source.replace(marker, replacement, 1))


# Writer integration
insert_once(
    "app/script-workspace.tsx",
    'import TreatmentEditor from "./treatment-editor";\n',
    'import { CraftDiagnosticSummary } from "./craft-diagnostics";\n',
)
insert_once(
    "app/script-workspace.tsx",
    '          <div className={styles.aiCard}>\n',
    '          <CraftDiagnosticSummary project={project} focus={{ blockNumber, sceneId: currentSceneEntry?.sceneId }} />\n',
    before=True,
)

# Structure integration
insert_once(
    "app/structure/page.tsx",
    'import styles from "./structure.module.css";\n',
    'import { CraftDiagnosticSummary } from "../craft-diagnostics";\n',
)
insert_once(
    "app/structure/page.tsx",
    '        <section className={styles.sceneDiagnostics} aria-labelledby="scene-health-title">\n',
    '        <CraftDiagnosticSummary project={project} focus={{ blockNumber: block.number, sceneId: scene.id }} />\n\n',
    before=True,
)

# DraftLens integration
insert_once(
    "app/draftlens/page.tsx",
    'import styles from "./draftlens.module.css";\n',
    'import { CraftDiagnosticSummary } from "../craft-diagnostics";\n',
)
insert_once(
    "app/draftlens/page.tsx",
    '        <section className={styles.firstReadPanel}>\n',
    '        <CraftDiagnosticSummary project={project} focus={{ blockNumber: selectedBlock.number, sceneId: selectedBlock.scenes[0]?.id, characterId: selectedCharacter?.id }} />\n\n',
    before=True,
)

# Version and regression suite
package_path = root / "package.json"
package = json.loads(package_path.read_text(encoding="utf-8"))
package["version"] = "0.14.0"
test_script = package["scripts"]["test"]
phase_b = "tests/phase-b-diagnostic-craft.test.mjs"
if phase_b not in test_script:
    package["scripts"]["test"] = f"{test_script} {phase_b}"
package_path.write_text(json.dumps(package, indent=2) + "\n", encoding="utf-8")

# README release note
readme = read("README.md")
release_note = """
## PlotPickle 0.14 — Diagnostic Craft Layer

PlotPickle now diagnoses story function rather than only storing story description. Open `/diagnostics` for Act I Launch, Opening Move, Scene Pulse, Story Thread overlays, the Setup/Payoff/Reflection Ledger, Character Arc checkpoints, and chronology-versus-presentation views. The same focused findings appear inside Structure, Writer and DraftLens.

"""
if "## PlotPickle 0.14 — Diagnostic Craft Layer" not in readme:
    first_heading_end = readme.find("\n", readme.find("# "))
    readme = readme[: first_heading_end + 1] + "\n" + release_note + readme[first_heading_end + 1 :]
    write("README.md", readme)

# Remove one-time integration machinery from the final branch.
(root / "scripts/apply-phase-b.py").unlink()
(root / ".github/workflows/apply-phase-b.yml").unlink()
