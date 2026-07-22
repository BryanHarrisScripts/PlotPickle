from pathlib import Path

root = Path(__file__).resolve().parents[1]
path = root / "lib/project.ts"
source = path.read_text(encoding="utf-8")


def remove_later_section(text: str, start_marker: str, end_marker: str) -> str:
    while text.count(start_marker) > 1:
        first = text.find(start_marker)
        duplicate = text.find(start_marker, first + len(start_marker))
        end = text.find(end_marker, duplicate)
        if duplicate < 0 or end < 0:
            raise RuntimeError(f"Could not remove duplicate section: {start_marker}")
        text = text[:duplicate] + text[end:]
    return text


source = remove_later_section(
    source,
    'export type ArcCheckpointKind =',
    'export type Character =',
)
source = source.replace(
    '  arcMatrix: CharacterArcMatrix;\n  arcMatrix: CharacterArcMatrix;\n',
    '  arcMatrix: CharacterArcMatrix;\n',
)
source = remove_later_section(
    source,
    'export type StoryThreadKind =',
    'export type ProjectDevelopment =',
)
source = remove_later_section(
    source,
    'export function createBlankArcMatrix',
    'export function createBlankDevelopment',
)

checks = {
    'ArcCheckpointKind': source.count('export type ArcCheckpointKind ='),
    'StoryThreadKind': source.count('export type StoryThreadKind ='),
    'createBlankArcMatrix': source.count('export function createBlankArcMatrix'),
    'createBlankRightsAndProvenance': source.count('export function createBlankRightsAndProvenance'),
    'arcMatrix property': source.count('  arcMatrix: CharacterArcMatrix;'),
}
for label, count in checks.items():
    if count != 1:
        raise RuntimeError(f"Expected one {label}, found {count}")

path.write_text(source, encoding="utf-8")
