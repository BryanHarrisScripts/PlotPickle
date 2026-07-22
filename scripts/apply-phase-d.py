from __future__ import annotations

import json
from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    source = file.read_text(encoding="utf-8")
    if new in source:
        return
    if source.count(old) != 1:
        raise RuntimeError(f"Expected one match in {path}: {old[:80]!r}; found {source.count(old)}")
    file.write_text(source.replace(old, new, 1), encoding="utf-8")


review_types = '''export type ReviewAnchorKind = "project" | "story-field" | "block" | "scene" | "screenplay-element" | "character";
export type ReviewThreadStatus = "open" | "in-review" | "resolved" | "deferred";
export type ReviewPriority = "low" | "normal" | "high" | "critical";

export type ReviewAnchor = {
  kind: ReviewAnchorKind;
  targetId: string;
  label: string;
};

export type ReviewComment = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
};

export type ReviewThread = {
  id: string;
  title: string;
  anchor: ReviewAnchor;
  status: ReviewThreadStatus;
  priority: ReviewPriority;
  comments: ReviewComment[];
  createdAt: string;
  updatedAt: string;
  resolvedAt: string;
};

export type LoglineCandidate = {
  id: string;
  text: string;
  source: string;
  selected: boolean;
  createdAt: string;
};

export type PitchPackage = {
  title: string;
  subtitle: string;
  tagline: string;
  logline: string;
  synopsis: string;
  creatorStatement: string;
  audience: string;
  comparableTitles: string;
  visualStatement: string;
  contactLine: string;
  selectedCharacterIds: string[];
  selectedLocationIds: string[];
  includeSections: string[];
  updatedAt: string;
};

export type ReviewWorkspace = {
  threads: ReviewThread[];
  loglineCandidates: LoglineCandidate[];
  pitchPackage: PitchPackage;
};

'''
replace_once("lib/project.ts", "export type RevisionSnapshot = {", review_types + "export type RevisionSnapshot = {")
replace_once("lib/project.ts", "  revisions: RevisionSnapshot[];\n};", "  revisions: RevisionSnapshot[];\n  review: ReviewWorkspace;\n};")

blank_review = '''export function createBlankReviewWorkspace(projectTitle = "Untitled Story"): ReviewWorkspace {
  return {
    threads: [],
    loglineCandidates: [],
    pitchPackage: {
      title: projectTitle,
      subtitle: "",
      tagline: "",
      logline: "",
      synopsis: "",
      creatorStatement: "",
      audience: "",
      comparableTitles: "",
      visualStatement: "",
      contactLine: "",
      selectedCharacterIds: [],
      selectedLocationIds: [],
      includeSections: ["cover", "logline", "synopsis", "characters", "world", "visuals", "creator", "rights"],
      updatedAt: new Date().toISOString(),
    },
  };
}

'''
replace_once("lib/project.ts", "export function createBlankDevelopment(): ProjectDevelopment {", blank_review + "export function createBlankDevelopment(): ProjectDevelopment {")
replace_once("lib/project.ts", "    revisions: [],\n  };", "    revisions: [],\n    review: createBlankReviewWorkspace(\"Untitled Story\"),\n  };")
replace_once("lib/project.ts", "    Array.isArray(candidate.revisions) &&\n", "    Array.isArray(candidate.revisions) &&\n    Boolean(candidate.review) &&\n")

normalizer = '''function normalizeReviewWorkspace(value: unknown, projectTitle: string): ReviewWorkspace {
  const defaults = createBlankReviewWorkspace(projectTitle);
  if (!value || typeof value !== "object") return defaults;
  const candidate = value as Partial<ReviewWorkspace>;
  const statuses: ReviewThreadStatus[] = ["open", "in-review", "resolved", "deferred"];
  const priorities: ReviewPriority[] = ["low", "normal", "high", "critical"];
  const anchorKinds: ReviewAnchorKind[] = ["project", "story-field", "block", "scene", "screenplay-element", "character"];
  const now = new Date().toISOString();
  const threads = Array.isArray(candidate.threads) ? candidate.threads.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const thread = item as Partial<ReviewThread>;
    const anchor = thread.anchor && typeof thread.anchor === "object" ? thread.anchor as Partial<ReviewAnchor> : {};
    return [{
      id: typeof thread.id === "string" && thread.id ? thread.id : `review-thread-${index + 1}`,
      title: typeof thread.title === "string" ? thread.title : `Review thread ${index + 1}`,
      anchor: {
        kind: anchorKinds.includes(anchor.kind as ReviewAnchorKind) ? anchor.kind as ReviewAnchorKind : "project",
        targetId: typeof anchor.targetId === "string" ? anchor.targetId : "",
        label: typeof anchor.label === "string" ? anchor.label : "Whole project",
      },
      status: statuses.includes(thread.status as ReviewThreadStatus) ? thread.status as ReviewThreadStatus : "open",
      priority: priorities.includes(thread.priority as ReviewPriority) ? thread.priority as ReviewPriority : "normal",
      comments: Array.isArray(thread.comments) ? thread.comments.flatMap((commentItem, commentIndex) => {
        if (!commentItem || typeof commentItem !== "object") return [];
        const comment = commentItem as Partial<ReviewComment>;
        return [{
          id: typeof comment.id === "string" && comment.id ? comment.id : `review-comment-${index + 1}-${commentIndex + 1}`,
          author: typeof comment.author === "string" ? comment.author : "Local reviewer",
          body: typeof comment.body === "string" ? comment.body : "",
          createdAt: typeof comment.createdAt === "string" ? comment.createdAt : now,
        }];
      }) : [],
      createdAt: typeof thread.createdAt === "string" ? thread.createdAt : now,
      updatedAt: typeof thread.updatedAt === "string" ? thread.updatedAt : now,
      resolvedAt: typeof thread.resolvedAt === "string" ? thread.resolvedAt : "",
    }];
  }) : [];
  const loglineCandidates = Array.isArray(candidate.loglineCandidates) ? candidate.loglineCandidates.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const entry = item as Partial<LoglineCandidate>;
    return [{
      id: typeof entry.id === "string" && entry.id ? entry.id : `logline-${index + 1}`,
      text: typeof entry.text === "string" ? entry.text : "",
      source: typeof entry.source === "string" ? entry.source : "Guided workshop",
      selected: Boolean(entry.selected),
      createdAt: typeof entry.createdAt === "string" ? entry.createdAt : now,
    }];
  }) : [];
  const pitch = candidate.pitchPackage && typeof candidate.pitchPackage === "object" ? candidate.pitchPackage as Partial<PitchPackage> : {};
  return {
    threads,
    loglineCandidates,
    pitchPackage: {
      ...defaults.pitchPackage,
      ...pitch,
      selectedCharacterIds: stringArray(pitch.selectedCharacterIds),
      selectedLocationIds: stringArray(pitch.selectedLocationIds),
      includeSections: stringArray(pitch.includeSections).length ? stringArray(pitch.includeSections) : defaults.pitchPackage.includeSections,
      updatedAt: typeof pitch.updatedAt === "string" ? pitch.updatedAt : now,
    },
  };
}

'''
replace_once("lib/project.ts", "export function normalizePlotPickleProject(value: unknown): PlotPickleProject | null {", normalizer + "export function normalizePlotPickleProject(value: unknown): PlotPickleProject | null {")
replace_once("lib/project.ts", "    revisions?: RevisionSnapshot[];\n", "    revisions?: RevisionSnapshot[];\n    review?: ReviewWorkspace;\n")
replace_once("lib/project.ts", "    revisions: normalizeRevisions(candidate.revisions),\n", "    revisions: normalizeRevisions(candidate.revisions),\n    review: normalizeReviewWorkspace(candidate.review, candidate.metadata.title),\n")

# Include review and pitch records in future revision snapshots.
replace_once("lib/project-phase-one.ts", "  type PlotPickleProject,\n", "  type PlotPickleProject,\n  type ReviewWorkspace,\n")
replace_once("lib/project-phase-one.ts", "  storyThreads: StoryThread[];\n};", "  storyThreads: StoryThread[];\n  review: ReviewWorkspace;\n};")
replace_once("lib/project-phase-one.ts", "    storyThreads: project.storyThreads,\n", "    storyThreads: project.storyThreads,\n    review: project.review,\n")

# Add the new studio to the specialist hub.
engine_card = '''  {
    code: "PR",
    title: "Pitch & Review Studio",
    href: "/pitch-review",
    stage: "Review and share",
    question: "How does the draft become a clear, reviewable and shareable package?",
    summary:
      "Guide the logline, anchor local comments to stable story IDs, resolve review threads, compare revision snapshots and assemble a complete pitch package with shareable exports.",
    useWhen:
      "Use it after a draft or development pass, during local review, before sharing revisions, or when the project needs a professional logline, synopsis, character presentation and visual pitch.",
    connects: ["Anchored comments", "Review states", "Revision snapshots", "Approved logline", "Pitch package", "Pitch exports"],
    result: "A resolved review trail and a complete PDF, HTML or presentation-ready pitch package generated from the active story.",
  },
'''
replace_once("app/engine-hub.tsx", "  {\n    code: \"LB\",", engine_card + "  {\n    code: \"LB\",")
replace_once("app/engine-hub.module.css", "grid-template-columns: repeat(7, minmax(0, 1fr));", "grid-template-columns: repeat(8, minmax(0, 1fr));")

# Release and test contracts.
package = Path("package.json")
package_data = json.loads(package.read_text(encoding="utf-8"))
package_data["version"] = "0.16.0"
phase_d_test = "tests/phase-d-pitch-review.test.mjs"
if phase_d_test not in package_data["scripts"]["test"]:
    package_data["scripts"]["test"] += f" {phase_d_test}"
package.write_text(json.dumps(package_data, indent=2) + "\n", encoding="utf-8")

replace_once("tests/project-navigation-licensing.test.mjs", 'assert.equal(packageJson.version, "0.15.0");', 'assert.equal(packageJson.version, "0.16.0");')
phase_c = Path("tests/phase-c-specialist-labs.test.mjs")
phase_c_source = phase_c.read_text(encoding="utf-8")
phase_c_source = phase_c_source.replace('assert.equal(packageJson.version, "0.15.0");', 'assert.ok(Number(packageJson.version.split(".")[1]) >= 15);')
phase_c.write_text(phase_c_source, encoding="utf-8")

# Extend both canonical schema files with backward-compatible optional review records.
review_defs = {
    "reviewWorkspace": {
        "type": "object",
        "additionalProperties": False,
        "required": ["threads", "loglineCandidates", "pitchPackage"],
        "properties": {
            "threads": {"type": "array", "items": {"$ref": "#/$defs/reviewThread"}},
            "loglineCandidates": {"type": "array", "items": {"$ref": "#/$defs/loglineCandidate"}},
            "pitchPackage": {"$ref": "#/$defs/pitchPackage"},
        },
    },
    "reviewThread": {
        "type": "object",
        "additionalProperties": False,
        "required": ["id", "title", "anchor", "status", "priority", "comments", "createdAt", "updatedAt", "resolvedAt"],
        "properties": {
            "id": {"type": "string"}, "title": {"type": "string"},
            "anchor": {"$ref": "#/$defs/reviewAnchor"},
            "status": {"enum": ["open", "in-review", "resolved", "deferred"]},
            "priority": {"enum": ["low", "normal", "high", "critical"]},
            "comments": {"type": "array", "items": {"$ref": "#/$defs/reviewComment"}},
            "createdAt": {"type": "string"}, "updatedAt": {"type": "string"}, "resolvedAt": {"type": "string"},
        },
    },
    "reviewAnchor": {
        "type": "object", "additionalProperties": False,
        "required": ["kind", "targetId", "label"],
        "properties": {
            "kind": {"enum": ["project", "story-field", "block", "scene", "screenplay-element", "character"]},
            "targetId": {"type": "string"}, "label": {"type": "string"},
        },
    },
    "reviewComment": {
        "type": "object", "additionalProperties": False,
        "required": ["id", "author", "body", "createdAt"],
        "properties": {"id": {"type": "string"}, "author": {"type": "string"}, "body": {"type": "string"}, "createdAt": {"type": "string"}},
    },
    "loglineCandidate": {
        "type": "object", "additionalProperties": False,
        "required": ["id", "text", "source", "selected", "createdAt"],
        "properties": {"id": {"type": "string"}, "text": {"type": "string"}, "source": {"type": "string"}, "selected": {"type": "boolean"}, "createdAt": {"type": "string"}},
    },
    "pitchPackage": {
        "type": "object", "additionalProperties": False,
        "required": ["title", "subtitle", "tagline", "logline", "synopsis", "creatorStatement", "audience", "comparableTitles", "visualStatement", "contactLine", "selectedCharacterIds", "selectedLocationIds", "includeSections", "updatedAt"],
        "properties": {
            "title": {"type": "string"}, "subtitle": {"type": "string"}, "tagline": {"type": "string"}, "logline": {"type": "string"},
            "synopsis": {"type": "string"}, "creatorStatement": {"type": "string"}, "audience": {"type": "string"}, "comparableTitles": {"type": "string"},
            "visualStatement": {"type": "string"}, "contactLine": {"type": "string"},
            "selectedCharacterIds": {"type": "array", "items": {"type": "string"}},
            "selectedLocationIds": {"type": "array", "items": {"type": "string"}},
            "includeSections": {"type": "array", "items": {"type": "string"}},
            "updatedAt": {"type": "string"},
        },
    },
}
for schema_path in ["schema/plotpickle-project.schema.json", "schema/plotpickle-project-v1.7.schema.json"]:
    schema_file = Path(schema_path)
    schema = json.loads(schema_file.read_text(encoding="utf-8"))
    schema["description"] = "Canonical PlotPickle 1.7 project schema with flexible scenes, Story Threads, Character Arc Matrices, rights and provenance, revision snapshots, local review threads, pitch-package records, and the complete 24/96 project model."
    schema["properties"]["review"] = {"$ref": "#/$defs/reviewWorkspace"}
    schema["$defs"].update(review_defs)
    schema_file.write_text(json.dumps(schema, indent=2) + "\n", encoding="utf-8")

# Document the release without replacing the existing README.
readme = Path("README.md")
readme_source = readme.read_text(encoding="utf-8")
readme_source = readme_source.replace("Current application version: `0.15.0`", "Current application version: `0.16.0`")
phase_d_intro = '''## PlotPickle 0.16 — Pitch and Review Workflows

Open `/pitch-review` to move from guided logline development through local anchored comments, review-thread resolution, revision snapshot comparison and a complete pitch package. The same active project produces a browser PDF layout, self-contained HTML package and presentation-ready Markdown deck. Review anchors use stable project IDs and all decisions remain local to the canonical PlotPickle project.

'''
marker = "## PlotPickle 0.15 — Specialist Labs\n"
if phase_d_intro not in readme_source:
    if marker not in readme_source:
        raise RuntimeError("README release marker not found")
    readme_source = readme_source.replace(marker, phase_d_intro + marker, 1)
readme.write_text(readme_source, encoding="utf-8")
