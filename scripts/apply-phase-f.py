from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def write(path, content):
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(path, old, new):
    content = read(path)
    if old not in content:
        raise RuntimeError(f"Expected text not found in {path}: {old[:100]!r}")
    write(path, content.replace(old, new, 1))


# Canonical project collaboration metadata. Credentials deliberately remain outside this model.
replace_once(
    "lib/project.ts",
    "export type RevisionSnapshot = {",
    '''export type ProjectCollaborationProvider = "none" | "github";

export type ProjectCollaboration = {
  provider: ProjectCollaborationProvider;
  repositoryUrl: string;
  sourceRepositoryUrl: string;
  owner: string;
  repo: string;
  branch: string;
  projectPath: string;
  syncEnabled: boolean;
  lastPulledCommit: string;
  lastPushedCommit: string;
  connectedAt: string;
  updatedAt: string;
};

export type RevisionSnapshot = {''',
)
replace_once(
    "lib/project.ts",
    "  production: ProductionWorkspace;\n};",
    "  production: ProductionWorkspace;\n  collaboration: ProjectCollaboration;\n};",
)
replace_once(
    "lib/project.ts",
    "export function createBlankDevelopment(): ProjectDevelopment {",
    '''export function createBlankCollaboration(): ProjectCollaboration {
  return {
    provider: "none",
    repositoryUrl: "",
    sourceRepositoryUrl: "",
    owner: "",
    repo: "",
    branch: "main",
    projectPath: "",
    syncEnabled: false,
    lastPulledCommit: "",
    lastPushedCommit: "",
    connectedAt: "",
    updatedAt: new Date().toISOString(),
  };
}

export function createBlankDevelopment(): ProjectDevelopment {''',
)
replace_once(
    "lib/project.ts",
    "    production: createBlankProductionWorkspace(),\n  };",
    "    production: createBlankProductionWorkspace(),\n    collaboration: createBlankCollaboration(),\n  };",
)
replace_once(
    "lib/project.ts",
    "    Boolean(candidate.production) &&\n    candidate.blocks.every",
    "    Boolean(candidate.production) &&\n    Boolean(candidate.collaboration) &&\n    candidate.blocks.every",
)
replace_once(
    "lib/project.ts",
    "    production?: ProductionWorkspace;\n  };",
    "    production?: ProductionWorkspace;\n    collaboration?: ProjectCollaboration;\n  };",
)
replace_once(
    "lib/project.ts",
    "export function normalizePlotPickleProject(value: unknown): PlotPickleProject | null {",
    '''function normalizeCollaboration(value: unknown): ProjectCollaboration {
  const defaults = createBlankCollaboration();
  if (!value || typeof value !== "object") return defaults;
  const candidate = value as Partial<ProjectCollaboration>;
  return {
    provider: candidate.provider === "github" ? "github" : "none",
    repositoryUrl: typeof candidate.repositoryUrl === "string" ? candidate.repositoryUrl : "",
    sourceRepositoryUrl: typeof candidate.sourceRepositoryUrl === "string" ? candidate.sourceRepositoryUrl : "",
    owner: typeof candidate.owner === "string" ? candidate.owner : "",
    repo: typeof candidate.repo === "string" ? candidate.repo : "",
    branch: typeof candidate.branch === "string" && candidate.branch ? candidate.branch : "main",
    projectPath: typeof candidate.projectPath === "string" ? candidate.projectPath : "",
    syncEnabled: Boolean(candidate.syncEnabled),
    lastPulledCommit: typeof candidate.lastPulledCommit === "string" ? candidate.lastPulledCommit : "",
    lastPushedCommit: typeof candidate.lastPushedCommit === "string" ? candidate.lastPushedCommit : "",
    connectedAt: typeof candidate.connectedAt === "string" ? candidate.connectedAt : "",
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : defaults.updatedAt,
  };
}

export function normalizePlotPickleProject(value: unknown): PlotPickleProject | null {''',
)
replace_once(
    "lib/project.ts",
    "    production: normalizeProductionWorkspace(candidate.production),\n  };",
    "    production: normalizeProductionWorkspace(candidate.production),\n    collaboration: normalizeCollaboration(candidate.collaboration),\n  };",
)

# Include repository identity in future revision snapshots.
replace_once(
    "lib/project-phase-one.ts",
    '  production: PlotPickleProject["production"];\n};',
    '  production: PlotPickleProject["production"];\n  collaboration: PlotPickleProject["collaboration"];\n};',
)
replace_once(
    "lib/project-phase-one.ts",
    "    production: project.production,\n  });",
    "    production: project.production,\n    collaboration: project.collaboration,\n  });",
)

# Private local storage and GitHub API gateway.
replace_once(
    "vite.config.ts",
    'import { localAiGateway } from "./build/local-ai-gateway";',
    'import { localAiGateway } from "./build/local-ai-gateway";\nimport { localProjectGateway } from "./build/local-project-gateway";',
)
replace_once(
    "vite.config.ts",
    "      localAiGateway(),\n      vinext(),",
    "      localProjectGateway(),\n      localAiGateway(),\n      vinext(),",
)

# Settings collaboration surface.
replace_once(
    "app/settings-panel.tsx",
    'import CoreModelStudio from "./core-model-studio";',
    'import CoreModelStudio from "./core-model-studio";\nimport GitHubCollaboration from "./github-collaboration";',
)
replace_once(
    "app/settings-panel.tsx",
    'type SettingsSection = "reports" | "terminology" | "core" | "ai" | "music" | "plugins";',
    'type SettingsSection = "reports" | "terminology" | "core" | "collaboration" | "ai" | "music" | "plugins";',
)
replace_once(
    "app/settings-panel.tsx",
    '          <button type="button" className={section === "core" ? styles.active : ""} onClick={() => setSection("core")}><b>Core Model</b><span>Threads, arcs, rights, provenance, revisions</span></button>\n          <button type="button" className={section === "ai" ? styles.active : ""}',
    '          <button type="button" className={section === "core" ? styles.active : ""} onClick={() => setSection("core")}><b>Core Model</b><span>Threads, arcs, rights, provenance, revisions</span></button>\n          <button type="button" className={section === "collaboration" ? styles.active : ""} onClick={() => setSection("collaboration")}><b>GitHub &amp; Backups</b><span>.ppf library, recovery, history, collaboration</span></button>\n          <button type="button" className={section === "ai" ? styles.active : ""}',
)
replace_once(
    "app/settings-panel.tsx",
    '          {section === "core" ? <CoreModelStudio project={project} onChange={onProjectChange} compact /> : null}\n          {section === "ai" ? (',
    '          {section === "core" ? <CoreModelStudio project={project} onChange={onProjectChange} compact /> : null}\n          {section === "collaboration" ? <GitHubCollaboration project={project} onChange={onProjectChange} /> : null}\n          {section === "ai" ? (',
)

# Project-specific repository link in the dashboard.
replace_once(
    "app/project-overview.tsx",
    '            <a href="https://github.com/BryanHarrisScripts/PlotPickle" target="_blank" rel="noreferrer">View source repository</a>',
    '            {project.collaboration.sourceRepositoryUrl ? <a href={project.collaboration.sourceRepositoryUrl} target="_blank" rel="noreferrer">Open this story’s GitHub repository</a> : <a href="https://github.com/BryanHarrisScripts/PlotPickle" target="_blank" rel="noreferrer">View PlotPickle source repository</a>}',
)

# The current Afterglow project points to its canonical source repository without enabling sync.
replace_once(
    "data/afterglow-complete.ts",
    "    screenplay,\n    blocks: [],",
    '''    collaboration: {
      ...base.collaboration,
      provider: "none",
      repositoryUrl: "https://github.com/BryanHarrisScripts/Afterglow-Echoes-of-Sentience",
      sourceRepositoryUrl: "https://github.com/BryanHarrisScripts/Afterglow-Echoes-of-Sentience",
      owner: "BryanHarrisScripts",
      repo: "Afterglow-Echoes-of-Sentience",
      branch: "main",
      projectPath: "stories/afterglow-reflections-of-sentience.ppf",
      syncEnabled: false,
      updatedAt: importedAt,
    },
    screenplay,
    blocks: [],''',
)

# Release version and scripts.
package_path = ROOT / "package.json"
package = json.loads(package_path.read_text(encoding="utf-8"))
package["version"] = "1.0.0-rc.1"
package["scripts"]["test"] += " tests/phase-f-collaboration-release.test.mjs"
package["scripts"]["test:recovery"] = "node scripts/project-recovery-smoke.mjs"
package["scripts"]["package:windows"] = "node scripts/package-platform.mjs windows"
package["scripts"]["package:macos"] = "node scripts/package-platform.mjs macos"
package["scripts"]["package:linux"] = "node scripts/package-platform.mjs linux"
package_path.write_text(json.dumps(package, indent=2) + "\n", encoding="utf-8")

lock_path = ROOT / "package-lock.json"
lock = json.loads(lock_path.read_text(encoding="utf-8"))
if "version" in lock:
    lock["version"] = "1.0.0-rc.1"
if "packages" in lock and "" in lock["packages"]:
    lock["packages"][""]["version"] = "1.0.0-rc.1"
lock_path.write_text(json.dumps(lock, indent=2) + "\n", encoding="utf-8")

# Canonical schemas retain 1.7 while gaining non-secret collaboration metadata.
collaboration_definition = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "provider", "repositoryUrl", "sourceRepositoryUrl", "owner", "repo", "branch", "projectPath",
        "syncEnabled", "lastPulledCommit", "lastPushedCommit", "connectedAt", "updatedAt"
    ],
    "properties": {
        "provider": {"type": "string", "enum": ["none", "github"]},
        "repositoryUrl": {"type": "string"},
        "sourceRepositoryUrl": {"type": "string"},
        "owner": {"type": "string"},
        "repo": {"type": "string"},
        "branch": {"type": "string"},
        "projectPath": {"type": "string"},
        "syncEnabled": {"type": "boolean"},
        "lastPulledCommit": {"type": "string"},
        "lastPushedCommit": {"type": "string"},
        "connectedAt": {"type": "string"},
        "updatedAt": {"type": "string"}
    }
}
for schema_name in ["schema/plotpickle-project.schema.json", "schema/plotpickle-project-v1.7.schema.json"]:
    schema_path = ROOT / schema_name
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    if "collaboration" not in schema["required"]:
        schema["required"].append("collaboration")
    schema["properties"]["collaboration"] = {"$ref": "#/$defs/projectCollaboration"}
    schema["$defs"]["projectCollaboration"] = collaboration_definition
    schema_path.write_text(json.dumps(schema, indent=2) + "\n", encoding="utf-8")

# Preserve older phase contracts while accepting the 1.0 release candidate.
phase_e = read("tests/phase-e-page-to-production.test.mjs")
phase_e = phase_e.replace(
    '  assert.equal(packageJson.version, "0.17.0");',
    '  assert.ok(packageJson.version === "0.17.0" || packageJson.version.startsWith("1.0.0-rc."));',
)
write("tests/phase-e-page-to-production.test.mjs", phase_e)

# README release heading and candidate version.
readme = read("README.md")
phase_f = '''## PlotPickle 1.0 candidate — Collaboration and Release Engineering

Settings → GitHub & Backups now provides a disk-backed `.ppf` project library, atomic rolling backups, corruption-aware recovery, optional GitHub pull/review/push workflows, and repository history. Afterglow: Reflections of Sentience links directly to its current GitHub source repository. Windows, macOS and Linux release candidates are clean-machine tested and published with SHA-256 checksums, while local-only writing continues to require no PlotPickle or cloud account.

'''
if phase_f not in readme:
    readme = readme.replace("# PlotPickle Playhouse\n\n", "# PlotPickle Playhouse\n\n" + phase_f, 1)
readme = readme.replace("Current application version: `0.17.0`", "Current application version: `1.0.0-rc.1`")
write("README.md", readme)

print("Phase F canonical integration applied.")
