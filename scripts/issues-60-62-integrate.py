from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    if old not in text:
        raise SystemExit(f"Expected marker not found in {path}: {old[:160]!r}")
    target.write_text(text.replace(old, new, 1))

replace(
    "data/afterglow.ts",
    '      title: "Afterglow: Echoes of Sentience",',
    '      title: "Afterglow: Reflections of Sentience",',
)
replace(
    "data/afterglow.ts",
    '      notes: "Imported from the Afterglow repository. Summer and Isobel are treated as one character pending a source-of-truth screenplay pass."',
    '      notes: "Current display title: Afterglow: Reflections of Sentience. Legacy source title: Afterglow: Echoes of Sentience. Summer and Isobel remain a visible source decision pending screenplay reconciliation."',
)
replace(
    "data/afterglow.ts",
    '''    characters: afterglowCharacters.map((character) => ({ ...character, arcMatrix: createBlankArcMatrix(character) })),
    blocks: project.blocks.map(populateAfterglowBlock),
    screenplay: createAfterglowScreenplay(importedAt)''',
    '''    characters: afterglowCharacters.map((character) => ({ ...character, arcMatrix: createBlankArcMatrix(character) })),
    blocks: project.blocks.map(populateAfterglowBlock),
    rights: {
      projectOwner: "Bryan Elgin Harris",
      copyrightNotice: "Copyright © Bryan Elgin Harris. Licensed as stated below.",
      rightsStatement: "Afterglow: Reflections of Sentience is a continuing adaptation of Afterglow: Echoes of Sentience. The original and distributed adaptations are available under CC BY-SA 4.0, subject to recorded third-party asset rights and exclusions.",
      defaultCreativeLicence: "CC BY-SA 4.0",
      sourceWorkTitle: "Afterglow: Echoes of Sentience",
      sourceWorkAuthor: "Bryan Elgin Harris",
      adaptationStatus: "adaptation",
      collaborators: [],
      attributions: [{
        id: "afterglow-original-work",
        title: "Afterglow: Echoes of Sentience",
        creator: "Bryan Elgin Harris",
        sourceType: "adaptation",
        sourceUrl: "https://github.com/BryanHarrisScripts/Afterglow-Echoes-of-Sentience",
        licence: "CC BY-SA 4.0",
        permissionReference: "https://creativecommons.org/licenses/by-sa/4.0/",
        notes: "Current display title is Afterglow: Reflections of Sentience. Modifications and source versions are recorded in revision and provenance history. Attribution does not imply endorsement of downstream adaptations.",
        attachedTo: ["project", "screenplay", "pitch", "visuals", "exports"],
        createdAt: importedAt,
      }],
      aiProvenance: [{
        id: "historical-chatgpt4-v9-v10",
        provider: "OpenAI",
        model: "ChatGPT-4",
        operation: "rewrite",
        promptSummary: "Historical 2023 editing and rewrite assistance recorded by the v9 and partial v10 source materials.",
        outputSummary: "Historical assistance only; not a blanket claim about every current passage.",
        humanContribution: "Bryan Elgin Harris wrote, directed, selected and revised the screenplay materials.",
        humanDecision: "Preserve as process provenance, separate from creator attribution. Later retained AI operations require their own records.",
        retained: true,
        attachedTo: ["screenplay-source-v9", "screenplay-source-v10", "project-history"],
        createdAt: importedAt,
      }],
    },
    screenplay: createAfterglowScreenplay(importedAt)''',
)

replace(
    "app/project-overview.tsx",
    '''      <AfterglowLegacyVisuals project={project} mode="overview" />

      <div className={styles.dashboardGrid}>''',
    '''      <AfterglowLegacyVisuals project={project} mode="overview" />

      {project.id === "afterglow-echoes-of-sentience" ? <section className={styles.panel} aria-label="Afterglow Source Reconciliation"><header><div><p className={styles.eyebrow}>Afterglow Source Reconciliation</p><h2>Complete baseline, partial rewrite, current decisions.</h2></div><Link href="/afterglow-reconciliation">Open Version Bridge</Link></header><p>The complete v9 screenplay remains readable, v10 is preserved as an unfinished Blocks 1–8 alternate, and the current Reflections rewrite advances only through reviewed decisions. CC BY-SA attribution, modification history and poster rights remain visible.</p><div className={styles.rightsLinks}><Link href="/afterglow-reconciliation">Review source claims and versions</Link><Link href="/legal">Review attribution and licensing</Link></div></section> : null}

      <div className={styles.dashboardGrid}>''',
)

package = Path("package.json")
text = package.read_text()
old = "tests/issue-59-about-origins-principles.test.mjs tests/phase-one-core-schema.test.mjs"
new = "tests/issue-59-about-origins-principles.test.mjs tests/issues-60-62-afterglow-reconciliation.test.mjs tests/phase-one-core-schema.test.mjs"
if old not in text:
    raise SystemExit("Expected package.json test marker was not found")
package.write_text(text.replace(old, new, 1))
