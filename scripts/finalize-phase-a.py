from pathlib import Path
import json
import subprocess

root = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (root / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (root / path).write_text(content, encoding="utf-8")


def replace(path: str, old: str, new: str) -> None:
    source = read(path)
    if old not in source:
        if new in source:
            return
        raise RuntimeError(f"Missing expected source in {path}: {old}")
    write(path, source.replace(old, new))


def localize_refs(value):
    if isinstance(value, dict):
        return {key: localize_refs(item) for key, item in value.items()}
    if isinstance(value, list):
        return [localize_refs(item) for item in value]
    if isinstance(value, str) and value.startswith("./plotpickle-project.schema.json#"):
        return value.replace("./plotpickle-project.schema.json#", "#", 1)
    return value


base_raw = subprocess.check_output(
    ["git", "show", "origin/main:schema/plotpickle-project.schema.json"],
    cwd=root,
    text=True,
)
base = json.loads(base_raw)
phase = json.loads(read("schema/plotpickle-project-v1.7.schema.json"))

canonical = localize_refs(phase)
canonical["$id"] = "https://plotpickle.app/schema/plotpickle-project.schema.json"
canonical["title"] = "PlotPickle Project"
canonical["description"] = "Canonical PlotPickle 1.7 project schema with flexible scenes, Story Threads, Character Arc Matrices, rights and provenance, expanded screenplay elements, revision snapshots, and the complete 24/96 project model."
canonical["$defs"] = {
    **base.get("$defs", {}),
    **canonical.get("$defs", {}),
}

schema_text = json.dumps(canonical, indent=2, ensure_ascii=False) + "\n"
write("schema/plotpickle-project.schema.json", schema_text)
write("schema/plotpickle-project-v1.7.schema.json", schema_text)

replace(
    "lib/project-phase-one.ts",
    'export type PhaseOneProject = Omit<PlotPickleProject, "schemaVersion" | "screenplay" | "characters" | "blocks"> & {',
    'export type PhaseOneProject = Omit<PlotPickleProject, "schemaVersion" | "screenplay" | "characters" | "blocks" | "storyThreads" | "rights" | "revisions"> & {',
)

replace(
    "tests/phase-one-core-schema.test.mjs",
    '"schema 1.7 can become the default export",',
    '"Schema 1.7 is the canonical application and export model",',
)
replace(
    "tests/project-navigation-licensing.test.mjs",
    'assert.equal(packageJson.version, "0.12.0");',
    'assert.equal(packageJson.version, "0.13.0");',
)
replace(
    "tests/project-navigation-licensing.test.mjs",
    '    "dialogue",\n    "structureMap",',
    '    "dialogue",\n    "coreModel",\n    "structureMap",',
)
replace(
    "tests/rendered-html.test.mjs",
    'test("schema 1.6 preserves 12/24/96 while accepting flexible scenes", async () => {',
    'test("schema 1.7 preserves 12/24/96 while accepting flexible scenes", async () => {',
)
replace(
    "tests/rendered-html.test.mjs",
    'assert.equal(schema.properties.schemaVersion.const, "1.6.0");',
    'assert.equal(schema.properties.schemaVersion.const, "1.7.0");',
)
replace(
    "tests/rendered-html.test.mjs",
    "  assert.ok(projectSource.includes('schemaVersion: \"1.6.0\"'));",
    "  assert.ok(projectSource.includes('schemaVersion: \"1.7.0\"'));",
)
replace(
    "tests/visual-storyboard.test.mjs",
    'test("schema 1.6 migrates earlier projects into four storyboard slots per block", async () => {',
    'test("schema 1.7 migrates earlier projects into four storyboard slots per block", async () => {',
)

# Confirm the consolidated schema is self-contained.
required_defs = [
    "metadata", "story", "world", "development", "structure", "visual",
    "screenplay", "screenplayDraftElement", "character", "block", "scene",
    "miniBlock", "storyThread", "rights", "revisionSnapshot",
]
missing = [name for name in required_defs if name not in canonical["$defs"]]
if missing:
    raise RuntimeError(f"Canonical schema is missing definitions: {missing}")

for path in ["schema/plotpickle-project.schema.json", "schema/plotpickle-project-v1.7.schema.json"]:
    parsed = json.loads(read(path))
    if parsed["properties"]["schemaVersion"]["const"] != "1.7.0":
        raise RuntimeError(f"{path} is not schema 1.7")
