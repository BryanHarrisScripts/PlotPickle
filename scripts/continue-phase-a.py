from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
path = root / "scripts/apply-phase-a.py"
source = path.read_text(encoding="utf-8")

old_helper = '''    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"Expected exactly one match in {path}, found {count}: {old[:120]!r}")
    write(path, source.replace(old, new, 1))'''
new_helper = '''    count = source.count(old)
    if count == 0 and new in source:
        return
    if count != 1:
        raise RuntimeError(f"Expected exactly one match in {path}, found {count}: {old[:120]!r}")
    write(path, source.replace(old, new, 1))'''
source = source.replace(old_helper, new_helper)

old_schema = '''replace_once("lib/project.ts", '    schemaVersion: "1.6.0",', '    schemaVersion: "1.7.0",')'''
new_schema = '''replace_once("lib/project.ts", '  return {\\n    schemaVersion: "1.6.0",\\n    id: makeId("project"),', '  return {\\n    schemaVersion: "1.7.0",\\n    id: makeId("project"),')'''
source = source.replace(old_schema, new_schema)

old_cleanup = '''for transient in [ROOT / "scripts/apply-phase-a.py", ROOT / ".github/workflows/apply-phase-a.yml"]:
    if transient.exists():
        transient.unlink()'''
new_cleanup = '''for transient in [ROOT / "scripts/apply-phase-a.py", ROOT / "scripts/continue-phase-a.py", ROOT / ".github/workflows/apply-phase-a.yml", ROOT / "docs/phase-a-migration.log", ROOT / "docs/phase-a-migration.exit"]:
    if transient.exists():
        transient.unlink()
for transient in (ROOT / "docs").glob("PHASE-A-TRIGGER*.md"):
    transient.unlink()'''
source = source.replace(old_cleanup, new_cleanup)
path.write_text(source, encoding="utf-8")

result = subprocess.run([sys.executable, str(path)], cwd=root)
raise SystemExit(result.returncode)
