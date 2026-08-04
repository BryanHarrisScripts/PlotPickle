from pathlib import Path


def patch(path: str, replacements: list[tuple[str, str]]) -> None:
    file_path = Path(path)
    source = file_path.read_text(encoding="utf-8")
    for old, new in replacements:
        if old not in source:
            raise SystemExit(f"Expected contract not found in {path}: {old}")
        source = source.replace(old, new, 1)
    file_path.write_text(source, encoding="utf-8")


patch("tests/issue-258-creative-compute-paths.test.mjs", [
    (
        '''    "Cloud images & video · OpenAI, MiniMax or another provider",
''',
        '''    "Cloud writing & images · OpenAI",
    "Cloud text, images & H3 video · MiniMax",
''',
    ),
    (
        '''    "No cloud provider selected",
''',
        '''    "No OpenAI provider selected",
    "No MiniMax provider selected",
''',
    ),
])

patch("tests/issue-260-minimax-byok.test.mjs", [
    (
        '''  for (const phrase of [
    "Cloud images & video · OpenAI, MiniMax or another provider",
    "Create MiniMax API key",
    "MiniMax H3 video guide",
    "never falls back to cloud automatically",
  ]) assert.ok(dashboard.includes(phrase), `Missing MiniMax dashboard copy: ${phrase}`);
''',
        '''  for (const phrase of [
    "Cloud text, images & H3 video · MiniMax",
    'settingsSection: "minimax"',
    "writer's own account",
    "never falls back to cloud automatically",
  ]) assert.ok(dashboard.includes(phrase), `Missing MiniMax dashboard copy: ${phrase}`);
''',
    ),
])

print("Legacy creative-compute tests aligned")
