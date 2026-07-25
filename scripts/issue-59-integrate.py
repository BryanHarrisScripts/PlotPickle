from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    if old not in text:
        raise SystemExit(f"Expected marker not found in {path}: {old[:140]!r}")
    target.write_text(text.replace(old, new, 1))


replace(
    "app/page.tsx",
    '<div className="marketing-footer-actions"><button type="button" onClick={onEnter}>Open local workspace →</button><Link href="/legal">Copyright & licensing</Link><a href="https://github.com/BryanHarrisScripts/PlotPickle" target="_blank" rel="noreferrer">Source</a></div>',
    '<div className="marketing-footer-actions"><button type="button" onClick={onEnter}>Open local workspace →</button><Link href="/about">Why PlotPickle</Link><Link href="/legal">Copyright & licensing</Link><a href="https://github.com/BryanHarrisScripts/PlotPickle" target="_blank" rel="noreferrer">Source</a></div>',
)

replace(
    "app/project-overview.tsx",
    '''      </section>

      <section className={styles.identityGrid} aria-label="Project identity">''',
    '''      </section>

      <section className={styles.panel} aria-label="Why PlotPickle">
        <header><div><p className={styles.eyebrow}>Why PlotPickle</p><h2>One story, one canonical project.</h2></div></header>
        <p>PlotPickle grew from Afterglow, the 24 Blocks learning archive and several OpenStory experiments. The current local application keeps foundations, structure, treatment, screenplay, visuals, review, production, rights and provenance connected while the writer works on one manageable unit at a time.</p>
        <div className={styles.rightsLinks}><Link href="/about">About, origins and product principles</Link><Link href="/read-learn?module=why-plotpickle-works-in-layers">Why PlotPickle Works in Layers</Link></div>
      </section>

      <section className={styles.identityGrid} aria-label="Project identity">''',
)

replace(
    "app/learning-studio.tsx",
    'import { earlyVisualDevelopmentLesson, earlyVisualDevelopmentSearchText } from "./learning-early-visual-development";\nimport { twentyFourBlocksLessons, twentyFourBlocksSearchText, type TwentyFourBlocksLesson } from "./learning-24-blocks";',
    'import { earlyVisualDevelopmentLesson, earlyVisualDevelopmentSearchText } from "./learning-early-visual-development";\nimport { whyPlotPickleWorksInLayers, whyPlotPickleSearchText } from "./learning-why-plotpickle";\nimport { twentyFourBlocksLessons, twentyFourBlocksSearchText, type TwentyFourBlocksLesson } from "./learning-24-blocks";',
)
replace(
    "app/learning-studio.tsx",
    '''  earlyVisualDevelopmentLesson,
  ...twentyFourBlocksLessons,''',
    '''  earlyVisualDevelopmentLesson,
  whyPlotPickleWorksInLayers,
  ...twentyFourBlocksLessons,''',
)
replace(
    "app/learning-studio.tsx",
    '''  if (module.id === earlyVisualDevelopmentLesson.id) return `${base} ${earlyVisualDevelopmentSearchText()}`;
  const coreGuide = coreGuideFor(module.id);''',
    '''  if (module.id === earlyVisualDevelopmentLesson.id) return `${base} ${earlyVisualDevelopmentSearchText()}`;
  if (module.id === whyPlotPickleWorksInLayers.id) return `${base} ${whyPlotPickleSearchText()}`;
  const coreGuide = coreGuideFor(module.id);''',
)

replace(
    "README.md",
    '''The complete README is also available as three selectable tabs inside **Instructions → Project Overview**. No documentation was removed; the tabs reorganize the full guide by task.
''',
    '''The complete README is also available as three selectable tabs inside **Instructions → Project Overview**. No documentation was removed; the tabs reorganize the full guide by task.

[About PlotPickle](app/about/page.tsx) · [How OpenStory evolved into PlotPickle](docs/history/from-openstory-to-plotpickle.md) · [Legacy README disposition map](docs/history/legacy-readme-map.md)

PlotPickle grew from the Afterglow screenplay, the 24 Blocks learning archive and several OpenStory experiments. The current product is one downloadable local application with one canonical project, optional AI, owner-controlled collaboration and explicit rights/provenance records. Historical GPT, web3, token, DAO, revenue and autonomous-agent ideas are preserved as history rather than current roadmap commitments.
''',
)

package = Path("package.json")
text = package.read_text()
old = "tests/issue-58-afterglow-legacy-visuals.test.mjs tests/phase-one-core-schema.test.mjs"
new = "tests/issue-58-afterglow-legacy-visuals.test.mjs tests/issue-59-about-origins-principles.test.mjs tests/phase-one-core-schema.test.mjs"
if old not in text:
    raise SystemExit("Expected package.json test marker was not found")
package.write_text(text.replace(old, new, 1))
