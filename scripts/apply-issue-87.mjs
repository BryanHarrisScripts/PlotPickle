import { readFile, writeFile, rm } from "node:fs/promises";

async function replace(path, from, to) {
  const source = await readFile(path, "utf8");
  if (!source.includes(from)) throw new Error(`Missing expected text in ${path}: ${from.slice(0, 80)}`);
  await writeFile(path, source.replace(from, to));
}

await replace("app/page.tsx",
  'import ReadmeTabs from "./readme-tabs";',
  'import ReadmeTabs from "./readme-tabs";\nimport SimpleStart from "./simple-start";\nimport { ScreenplayReports, TerminologyIndex } from "./settings-project-tools";');

await replace("app/page.tsx",
  'type MainTab = "instructions" | "learn" | "planner" | "script" | "visuals" | "engines" | "settings";',
  'type MainTab = "instructions" | "learn" | "planner" | "script" | "visuals" | "engines" | "reports" | "settings";');

await replace("app/page.tsx",
  'type StorySection = "overview" | "storySetup"',
  'type StorySection = "simpleStart" | "overview" | "storySetup"');

await replace("app/page.tsx",
  '  { id: "engines", label: "Engines", description: "Refine the story" },\n  { id: "settings", label: "Settings", description: "Connect services" },',
  '  { id: "engines", label: "Engines", description: "Refine the story" },\n  { id: "reports", label: "Reports", description: "Measure the script" },\n  { id: "settings", label: "Settings", description: "Setup & preferences" },');

await replace("app/page.tsx",
  'const storySections: { id: StorySection; code: string; label: string; group: StorySectionGroup }[] = [\n  { id: "overview",',
  'const storySections: { id: StorySection; code: string; label: string; group: StorySectionGroup }[] = [\n  { id: "simpleStart", code: "SS", label: "Simple Start", group: "Project" },\n  { id: "overview",');

await replace("app/page.tsx",
  'const sectionGuides: Record<StorySection, { title: string; description: string; questions: string[]; deliverable: string; connection: string }> = {\n  overview:',
  'const sectionGuides: Record<StorySection, { title: string; description: string; questions: string[]; deliverable: string; connection: string }> = {\n  simpleStart: {\n    title: "Choose a clear way into the story.",\n    description: "Simple Start is an optional beginner pathway inside Story Planner, not a required splash screen.",\n    questions: ["Are you continuing, importing, learning, or beginning fresh?", "What is the smallest useful next step?", "Would the Afterglow example help?"],\n    deliverable: "A deliberate entry point without blocking the main workspace.",\n    connection: "Simple Start opens the same local project used by every PlotPickle workspace.",\n  },\n  overview:');

await replace("app/page.tsx",
  'const [activeTab, setActiveTab] = useState<MainTab>("instructions");',
  'const [activeTab, setActiveTab] = useState<MainTab>("planner");');

await replace("app/page.tsx",
  'const [showLanding, setShowLanding] = useState(true);',
  'const [showLanding, setShowLanding] = useState(false);');

await replace("app/page.tsx",
  '<button type="button" className="brand-lockup home-trigger" onClick={() => setShowLanding(true)} aria-label="Return to the PlotPickle product page">',
  '<button type="button" className="brand-lockup home-trigger" onClick={() => { setActiveTab("planner"); setActiveSection("overview"); }} aria-label="Open the PlotPickle project dashboard">');

await replace("app/page.tsx",
  '            <section className="planner-content">\n              {activeSection === "overview" ? (',
  '            <section className="planner-content">\n              {activeSection === "simpleStart" ? (\n                <SimpleStart\n                  project={project}\n                  onContinue={() => setActiveSection("overview")}\n                  onNew={createNewProject}\n                  onLearn={() => setActiveTab("learn")}\n                  onImport={() => fileInputRef.current?.click()}\n                  onAfterglow={loadAfterglow}\n                />\n              ) : null}\n              {activeSection === "overview" ? (');

await replace("app/page.tsx",
  '            <details className={writerStyles.scriptStudy} open={Boolean(project.screenplay.sourceText)}>',
  '            <details className={writerStyles.scriptStudy}>\n              <summary>Screenplay terminology</summary>\n              <TerminologyIndex />\n            </details>\n            <details className={writerStyles.scriptStudy} open={Boolean(project.screenplay.sourceText)}>');

await replace("app/page.tsx",
  '        {activeTab === "engines" ? <EngineHub /> : null}\n\n        <div hidden={activeTab !== "settings"}>',
  '        {activeTab === "engines" ? <EngineHub /> : null}\n\n        {activeTab === "reports" ? <ScreenplayReports project={project} /> : null}\n\n        <div hidden={activeTab !== "settings"}>');

await replace("app/settings-panel.tsx",
  'import { ScreenplayReports, TerminologyIndex } from "./settings-project-tools";\n',
  '');
await replace("app/settings-panel.tsx",
  'type SettingsSection = "reports" | "terminology" | "collaboration" | "ai" | "music";',
  'type SettingsSection = "collaboration" | "ai" | "music";');
await replace("app/settings-panel.tsx",
  'const [section, setSection] = useState<SettingsSection>("reports");',
  'const [section, setSection] = useState<SettingsSection>("collaboration");');
await replace("app/settings-panel.tsx",
  '<p>Settings</p>\n          <h1>Project tools and connections</h1>\n          <span>Open role-specific reports, learn industry language, and manage the GitHub, AI and music connections that are actually available.</span>',
  '<p>Settings · Setup</p>\n          <h1>Connect PlotPickle services</h1>\n          <span>GitHub collaboration, AI providers and music links live together in Setup. Reports and Terminology now belong to the core writing and learning workspaces.</span>');
await replace("app/settings-panel.tsx",
  '          <button type="button" className={section === "reports" ? styles.active : ""} onClick={() => setSection("reports")}><b>Reports</b><span>Characters, dialogue, words, and scenes</span></button>\n          <button type="button" className={section === "terminology" ? styles.active : ""} onClick={() => setSection("terminology")}><b>Terminology Index</b><span>Screenplay terms in plain language</span></button>\n          <button type="button" className={section === "collaboration" ? styles.active : ""} onClick={() => setSection("collaboration")}><b>GitHub</b><span>Shared repository, proposals, .ppf backups and history</span></button>\n          <button type="button" className={section === "ai" ? styles.active : ""} onClick={() => setSection("ai")}><b>AI Setup</b><span>ChatGPT, other AI, or local LLM</span></button>\n          <button type="button" className={section === "music" ? styles.active : ""} onClick={() => setSection("music")}><b>Music</b><span>Suno, Udio, and artist links</span></button>',
  '          <button type="button" className={section === "collaboration" ? styles.active : ""} onClick={() => setSection("collaboration")}><b>GitHub setup</b><span>Shared repository, proposals, .ppf backups and history</span></button>\n          <button type="button" className={section === "ai" ? styles.active : ""} onClick={() => setSection("ai")}><b>AI setup</b><span>ChatGPT, other AI, local LLM or no AI</span></button>\n          <button type="button" className={section === "music" ? styles.active : ""} onClick={() => setSection("music")}><b>Music setup</b><span>Suno, Udio and artist links</span></button>');
await replace("app/settings-panel.tsx",
  '          {section === "reports" ? <ScreenplayReports project={project} /> : null}\n          {section === "terminology" ? <TerminologyIndex /> : null}\n',
  '');

await replace("app/welcome/page.tsx",
  '<div className={styles.brand}>PlotPickle</div>\n        <p className={styles.eyebrow}>Local screenplay studio</p>',
  '<div className={styles.brand}>PlotPickle</div>\n        <p className={styles.eyebrow}>Simple Start · optional guided entry</p>');
await replace("app/welcome/page.tsx",
  '<h1>Write your movie one clear piece at a time.</h1>',
  '<h1>Choose a simple way into your screenplay.</h1>');
await replace("app/welcome/page.tsx",
  '<div><Link href="/about">About PlotPickle</Link><Link href="/?workspace=1">Advanced workspace</Link></div>',
  '<div><Link href="/about">About PlotPickle</Link><Link href="/?workspace=1">Open main workspace</Link></div>');

await rm("scripts/apply-issue-87.mjs");
await rm(".github/workflows/issue-87-apply.yml");
