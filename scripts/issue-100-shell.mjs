import { readFileSync, writeFileSync } from "node:fs";

function replace(path, before, after) {
  const source = readFileSync(path, "utf8");
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one match, found ${count}`);
  writeFileSync(path, source.replace(before, after));
}

replace("lib/product-direction.ts", `export type ProductNavigationId = (typeof PRODUCT_NAVIGATION)[number]["id"];

`, `export type ProductNavigationId = (typeof PRODUCT_NAVIGATION)[number]["id"];

export const PRODUCT_COMPONENTS = [
  { id: "learn", label: "Learn", title: "Learn the craft", summary: "Use the 81-module learning system and contextual guidance without leaving the active project.", icon: "/brand/components/learn.svg" },
  { id: "plan", label: "Plan", title: "Plan the whole story", summary: "Shape the story through four acts, twelve sequences, twenty-four blocks and ninety-six mini-blocks.", icon: "/brand/components/plan.svg" },
  { id: "write", label: "Write", title: "Write the screenplay", summary: "Move from treatment to a complete screenplay with connected scenes, dialogue and revisions.", icon: "/brand/components/write.svg" },
  { id: "storyboard", label: "Storyboard", title: "See the film", summary: "Carry approved characters, locations and visual continuity through every storyboard position.", icon: "/brand/components/storyboard.svg" },
  { id: "refine", label: "Refine", title: "Refine with purpose", summary: "Use specialist engines, reports and review evidence to improve the story without losing authorship.", icon: "/brand/components/refine.svg" },
] as const;

`);
replace("app/layout.tsx", `import "./engine-ux-cleanup.css";
`, `import "./engine-ux-cleanup.css";
import "./premium-ui.css";
`);
replace("app/page.tsx", `import { PRODUCT_NAVIGATION, type ProductNavigationId } from "@/lib/product-direction";`, `import { PRODUCT_COMPONENTS, PRODUCT_NAVIGATION, type ProductNavigationId } from "@/lib/product-direction";`);
replace("app/page.tsx", `const mainTabs = PRODUCT_NAVIGATION;

`, `const mainTabs = PRODUCT_NAVIGATION;

type HealthTone = "green" | "yellow" | "red";
type DashboardStatus = { id: string; label: string; tone: HealthTone; status: string; detail: string };
const healthMeta: Record<HealthTone, { icon: string; meaning: string }> = {
  green: { icon: "✓", meaning: "Ready or healthy" },
  yellow: { icon: "!", meaning: "Needs attention or review" },
  red: { icon: "×", meaning: "Missing, blocked or critical" },
};

`);
replace("app/page.tsx", `<div className="product-tabs"><span>Instructions</span><span className="active">Story Planner</span><span>Screenplay</span><span>Visual Board</span><span>Engines</span></div>`, `<div className="product-tabs"><span>Learn</span><span className="active">Plan</span><span>Write</span><span>Storyboard</span><span>Refine</span></div>`);
replace("app/page.tsx", `<p className="marketing-kicker">One playhouse. Five connected workspaces.</p>
            <h2>Everything develops the same story.</h2>
            <p>Move from learning to planning, full-script reading, visualization, and focused specialist engines without copying information between separate tools.</p>`, `<p className="marketing-kicker">One playhouse. Five connected components.</p>
            <h2>A complete path from learning to a finished film plan.</h2>
            <p>Learn, plan, write, storyboard and refine inside one calm, local-first application with one canonical project.</p>`);
replace("app/page.tsx", `          <div className="feature-grid">
            <article>
              <span className="feature-code">01</span>
              <p className="feature-label">Learn</p>
              <h3>Instructions</h3>
              <p>Follow Bryan Harris&apos;s complete 24 Blocks method with focused questions, clear deliverables, and story-building guidance.</p>
            </article>
            <article>
              <span className="feature-code">02</span>
              <p className="feature-label">Develop</p>
              <h3>Story Planner</h3>
              <p>Build the world, cast, ghost, catalyst, foundations, The Pickle audience engine, dialogue, and all twenty-four causal story movements.</p>
            </article>
            <article>
              <span className="feature-code">03</span>
              <p className="feature-label">Read</p>
              <h3>Script Viewer</h3>
              <p>Follow the complete screenplay with colour-coded formatting, scene navigation, structural position, and guided questions answered from the project.</p>
            </article>
            <article>
              <span className="feature-code">04</span>
              <p className="feature-label">Visualize</p>
              <h3>Visual Board</h3>
              <p>Carry every block into storyboard directions, frame prompts, shot notes, locations, characters, and visual continuity.</p>
            </article>
            <article>
              <span className="feature-code">05</span>
              <p className="feature-label">Refine</p>
              <h3>Engines</h3>
              <p>Choose a guided specialist pass for structure, meaning, voice, screenplay action, draft diagnosis, or deliberate practice.</p>
            </article>
          </div>`, `          <div className="component-grid">
            {PRODUCT_COMPONENTS.map((component, index) => (
              <article className="component-card" key={component.id}>
                <div className="component-visual"><img src={component.icon} alt="" aria-hidden="true" /></div>
                <div className="component-copy">
                  <span className="feature-code">{String(index + 1).padStart(2, "0")}</span>
                  <p className="feature-label">{component.label}</p>
                  <h3>{component.title}</h3>
                  <p>{component.summary}</p>
                </div>
              </article>
            ))}
          </div>`);
replace("app/page.tsx", `const [showLanding, setShowLanding] = useState(false);`, `const [showLanding, setShowLanding] = useState(true);`);
replace("app/page.tsx", `  const completion = useMemo(() => completionFor(project), [project]);
  const selectedCharacter = project.characters.find((character) => character.id === selectedCharacterId) ?? project.characters[0];`, `  const completion = useMemo(() => completionFor(project), [project]);
  const openAlerts = storySections.filter((section) => sectionHasAlert(project, section.id)).length;
  const visualBlocks = project.blocks.filter((block) => block.visuals.length > 0).length;
  const screenplayItems = project.screenplay.draftElements.length + (project.screenplay.sourceText.trim() ? 1 : 0);
  const dashboardStatuses: DashboardStatus[] = [
    { id: "story", label: "Story plan", tone: completion >= 70 ? "green" : completion > 0 ? "yellow" : "red", status: completion >= 70 ? "Ready for the next pass" : completion > 0 ? "In progress" : "Not started", detail: completion + "% of the active story plan is populated." },
    { id: "screenplay", label: "Screenplay", tone: screenplayItems ? "green" : "red", status: screenplayItems ? "Draft available" : "Draft missing", detail: screenplayItems ? "A screenplay source or editable draft is connected." : "Write or import screenplay pages to activate reports and production tools." },
    { id: "visuals", label: "Visual continuity", tone: visualBlocks === project.blocks.length ? "green" : visualBlocks > 0 ? "yellow" : "red", status: visualBlocks === project.blocks.length ? "Covered" : visualBlocks > 0 ? "Partial coverage" : "No visual coverage", detail: visualBlocks + " of " + project.blocks.length + " Blocks currently include visual evidence." },
    { id: "review", label: "Open review items", tone: openAlerts === 0 ? "green" : openAlerts <= 3 ? "yellow" : "red", status: openAlerts === 0 ? "Clear" : openAlerts <= 3 ? "Review needed" : "Blocked by open work", detail: openAlerts === 0 ? "No tracked story section currently carries an alert." : openAlerts + " story sections contain an open question or continuity item." },
  ];
  const selectedCharacter = project.characters.find((character) => character.id === selectedCharacterId) ?? project.characters[0];`);
replace("app/page.tsx", `{activeTab === "dashboard" ? (
          <>
            <section className="dashboard-actions" aria-label="Project actions">
              <button type="button" className="text-button" onClick={createNewProject}>New project</button>
              <button type="button" className="text-button" onClick={() => fileInputRef.current?.click()}>Import</button>
              <button type="button" className="text-button" onClick={exportProject}>Export</button>
              <button type="button" className="primary-button compact" onClick={loadAfterglow}>Load Afterglow</button>
            </section>
            <ProjectOverview
              project={project}
              onOpenSection={(section) => { setActiveTab("planner"); setActiveSection(section as StorySection); }}
              onOpenEngines={() => setActiveTab("engines")}
              onOpenBlock={(number) => openBlock(number, "planner")}
            />
          </>
        ) : null}`, `{activeTab === "dashboard" ? (
          <div className="dashboard-shell">
            <aside className="workspace-subnav dashboard-nav" aria-label="Dashboard sections">
              <p className="eyebrow">Dashboard</p><strong>Project control</strong>
              <a href="#dashboard-status">Health status</a><a href="#dashboard-actions">Project actions</a><a href="#dashboard-overview">Story overview</a>
              <div className="status-legend" aria-label="Dashboard status meaning">
                {(Object.keys(healthMeta) as HealthTone[]).map((tone) => <span className={"status-key status-" + tone} key={tone}><i aria-hidden="true">{healthMeta[tone].icon}</i>{healthMeta[tone].meaning}</span>)}
              </div>
            </aside>
            <div className="dashboard-main">
              <section className="dashboard-status" id="dashboard-status" aria-labelledby="dashboard-status-title">
                <div className="section-heading compact-heading"><div><p className="eyebrow">Live project health</p><h2 id="dashboard-status-title">Know what is ready, what needs attention and what is blocked.</h2><p>Status uses text, symbols and colour together so the dashboard remains readable and accessible.</p></div></div>
                <div className="dashboard-status-grid">{dashboardStatuses.map((item) => <article className={"status-card status-" + item.tone} key={item.id}><span className="status-card-label">{item.label}</span><strong><i aria-hidden="true">{healthMeta[item.tone].icon}</i>{item.status}</strong><p>{item.detail}</p></article>)}</div>
              </section>
              <section className="dashboard-actions" id="dashboard-actions" aria-label="Project actions">
                <button type="button" className="text-button" onClick={createNewProject}>New project</button><button type="button" className="text-button" onClick={() => fileInputRef.current?.click()}>Import</button><button type="button" className="text-button" onClick={exportProject}>Export</button><button type="button" className="primary-button compact" onClick={loadAfterglow}>Load Afterglow</button>
              </section>
              <section id="dashboard-overview" className="dashboard-overview"><ProjectOverview project={project} onOpenSection={(section) => { setActiveTab("planner"); setActiveSection(section as StorySection); }} onOpenEngines={() => setActiveTab("engines")} onOpenBlock={(number) => openBlock(number, "planner")} /></section>
            </div>
          </div>
        ) : null}`);
console.log("Issue #100 shell migration applied.");
