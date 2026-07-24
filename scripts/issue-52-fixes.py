from pathlib import Path

path = Path("app/working-together/page.tsx")
text = path.read_text()
old = '<a href="/#settings">Open Settings → GitHub & Backups</a>'
new = '<Link href="/#settings">Open Settings → GitHub & Backups</Link>'
if old not in text:
    raise SystemExit("Expected Working Together settings link was not found")
path.write_text(text.replace(old, new, 1))
