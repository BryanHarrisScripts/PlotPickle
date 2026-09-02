#!/usr/bin/env node
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildInventory } from "./inventory.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, "../..");
const publicRoot = path.join(repoRoot, "public");

function measure(target) {
  if (!existsSync(target)) return { sourceBytes: null, fileCount: null };
  const info = lstatSync(target);
  if (info.isSymbolicLink()) return { sourceBytes: 0, fileCount: 0 };
  if (info.isFile()) return { sourceBytes: statSync(target).size, fileCount: 1 };
  if (!info.isDirectory()) return { sourceBytes: 0, fileCount: 0 };

  let sourceBytes = 0;
  let fileCount = 0;
  for (const name of readdirSync(target).sort()) {
    const child = measure(path.join(target, name));
    if (Number.isFinite(child.sourceBytes)) sourceBytes += child.sourceBytes;
    if (Number.isFinite(child.fileCount)) fileCount += child.fileCount;
  }
  return { sourceBytes, fileCount };
}

function classification(relativePath, kind) {
  const retainedApplicationAssets = new Set([
    "public/assets",
    "public/brand",
    "public/design",
  ]);

  if (relativePath === "public/afterglow") {
    return {
      category: "active-afterglow-reference-container",
      weightClass: "reference-example-payload",
      disposition: "retain-current-product",
      evidence: [
        "Afterglow is the canonical reference/learning story and remains part of the supported product journey under #1412.",
        "The container includes currently referenced legacy visual media, so this slice does not authorize removing the subtree wholesale.",
      ],
    };
  }

  if (relativePath === "public/afterglow/legacy-visuals") {
    return {
      category: "active-afterglow-reference-media",
      weightClass: "reference-example-payload",
      disposition: "retain-active-reference",
      evidence: [
        "app/afterglow-legacy-visuals.tsx renders the legacy visual manifest in the product.",
        "app/visual-storyboard.tsx and app/specialist-labs.tsx consume the Afterglow legacy visual surface.",
        "data/afterglow-visual-manifest.json and public/afterglow/legacy-visuals/manifest.json point to the packaged legacy image paths.",
      ],
    };
  }

  if (relativePath === "public/visual-references") {
    return {
      category: "active-visual-reference-container",
      weightClass: "reference-example-payload",
      disposition: "retain-current-product",
      evidence: [
        "app/visual-reference-library.tsx fetches /visual-references/manifest.json as the bundled offline Visual Reference Library.",
        "The current product renders reference thumbnails and selected card images from this container, so the subtree cannot be removed wholesale.",
      ],
    };
  }

  if (relativePath === "public/visual-references/manifest.json") {
    return {
      category: "active-visual-reference-manifest",
      weightClass: "reference-example-payload",
      disposition: "retain-active-reference",
      evidence: [
        "app/visual-reference-library.tsx fetches this manifest and uses it to populate the bundled offline Visual Reference Library.",
      ],
    };
  }

  if (relativePath === "public/visual-references/thumbnail") {
    return {
      category: "active-visual-reference-thumbnails",
      weightClass: "reference-example-payload",
      disposition: "retain-active-reference",
      evidence: [
        "app/visual-reference-library.tsx renders reference.image.thumbnail for the searchable reference-card grid.",
      ],
    };
  }

  if (relativePath === "public/visual-references/card") {
    return {
      category: "active-visual-reference-cards",
      weightClass: "reference-example-payload",
      disposition: "retain-active-reference",
      evidence: [
        "app/visual-reference-library.tsx renders reference.image.card for the selected-reference detail view.",
      ],
    };
  }

  if (relativePath === "public/visual-references/full") {
    return {
      category: "visual-reference-full-resolution-media",
      weightClass: "reference-example-payload",
      disposition: "requires-reachability-proof",
      evidence: [
        "The Visual Reference manifest records full-resolution URLs, but app/visual-reference-library.tsx currently renders thumbnail and card variants in its live UI.",
        "This is a candidate for consumer-level reachability and optional-pack proof, not removal authorization.",
      ],
    };
  }

  if (relativePath === "public/visual-references/report.json") {
    return {
      category: "visual-reference-provenance-report",
      weightClass: "reference-example-payload",
      disposition: "requires-reachability-proof",
      evidence: [
        "The source/test suite uses this inventory report; Slice D does not yet prove a shipped product consumer.",
      ],
    };
  }

  if (relativePath === "public/docs") {
    return {
      category: "public-reference-documentation",
      weightClass: "reference-example-payload",
      disposition: "requires-reachability-proof",
      evidence: [
        "Public documentation remains packaged; this slice measures it without assuming it is safe to remove.",
      ],
    };
  }

  if (retainedApplicationAssets.has(relativePath)) {
    return {
      category: "current-application-assets",
      weightClass: "core-runtime",
      disposition: "retain-current-product",
      evidence: [
        "This named public asset subtree is part of the current served application surface and remains bundled until consumer-level proof says otherwise.",
      ],
    };
  }

  if (relativePath === "public/favicon.svg" || relativePath === "public/manifest.webmanifest") {
    return {
      category: "application-shell-asset",
      weightClass: "core-runtime",
      disposition: "retain-current-product",
      evidence: [
        "This loose public file is an application-shell/browser asset and remains in the base package.",
      ],
    };
  }

  return {
    category: kind === "directory" ? "unclassified-public-subtree" : "unclassified-public-file",
    weightClass: null,
    disposition: "requires-reachability-proof",
    evidence: [
      "The Slice D subinventory measures this public payload but does not yet have enough consumer evidence to classify or remove it.",
    ],
  };
}

function entry(relativePath) {
  const absolute = path.join(repoRoot, ...relativePath.split("/"));
  const info = lstatSync(absolute);
  const kind = info.isDirectory() ? "directory" : info.isFile() ? "file" : "other";
  return {
    path: relativePath,
    kind,
    ...classification(relativePath, kind),
    ...measure(absolute),
  };
}

function childEntries(relativeDirectory) {
  const absolute = path.join(repoRoot, ...relativeDirectory.split("/"));
  if (!existsSync(absolute) || !lstatSync(absolute).isDirectory()) return [];
  return readdirSync(absolute)
    .sort()
    .map((name) => entry(`${relativeDirectory}/${name}`));
}

function total(items, key) {
  return items.reduce((sum, item) => sum + (Number.isFinite(item[key]) ? item[key] : 0), 0);
}

function compactCandidate(item) {
  const { path: itemPath, kind, category, sourceBytes, fileCount, evidence } = item;
  return { path: itemPath, kind, category, sourceBytes, fileCount, evidence };
}

export function buildPublicMediaInventory() {
  const parentInventory = buildInventory();
  const publicPayload = parentInventory.releasePayloads.find((item) => item.path === "public");
  if (!publicPayload) throw new Error("Runtime-weight inventory does not classify public/.");
  if (!existsSync(publicRoot)) throw new Error("public/ is missing.");

  const topLevelItems = childEntries("public");
  const afterglowItems = childEntries("public/afterglow");
  const visualReferenceItems = childEntries("public/visual-references");
  const reachabilityProofQueue = [
    ...topLevelItems.filter((item) => !["public/afterglow", "public/visual-references"].includes(item.path)),
    ...afterglowItems,
    ...visualReferenceItems,
  ]
    .filter((item) => item.disposition === "requires-reachability-proof")
    .sort((left, right) => (right.sourceBytes ?? 0) - (left.sourceBytes ?? 0) || left.path.localeCompare(right.path))
    .map(compactCandidate);

  return {
    schemaVersion: 1,
    issue: 1639,
    parentIssue: 1412,
    sourceCommit: parentInventory.sourceCommit,
    priorInventoryIssue: parentInventory.issue,
    releaseAuthority: {
      publicPackaged: parentInventory.releaseAuthority.runtimeDirectories.includes("public"),
      publicSourceOnlyExclusions: (parentInventory.releaseAuthority.sourceOnlyReleaseExclusions ?? []).filter((item) => item === "public" || item.startsWith("public/")),
    },
    publicPayload: {
      sourceBytes: publicPayload.sourceBytes,
      weightClass: publicPayload.weightClass,
      disposition: publicPayload.disposition ?? null,
    },
    topLevelItems,
    afterglowItems,
    visualReferenceItems,
    reachabilityProofQueue,
    reconciliation: {
      topLevelSourceBytes: total(topLevelItems, "sourceBytes"),
      topLevelFileCount: total(topLevelItems, "fileCount"),
      afterglowSourceBytes: total(afterglowItems, "sourceBytes"),
      afterglowFileCount: total(afterglowItems, "fileCount"),
      visualReferenceSourceBytes: total(visualReferenceItems, "sourceBytes"),
      visualReferenceFileCount: total(visualReferenceItems, "fileCount"),
    },
  };
}

export function validatePublicMediaInventory(inventory) {
  const failures = [];

  if (!inventory.releaseAuthority.publicPackaged) failures.push("public/ is no longer packaged by the base release.");
  if ((inventory.releaseAuthority.publicSourceOnlyExclusions ?? []).length > 0) failures.push("Slice D must not exclude any public/ payload from the base release.");
  if (!Number.isFinite(inventory.publicPayload.sourceBytes) || inventory.publicPayload.sourceBytes <= 0) failures.push("public/ source bytes were not measured.");
  if (inventory.reconciliation.topLevelSourceBytes !== inventory.publicPayload.sourceBytes) failures.push("Top-level public/ bytes do not reconcile to the runtime-weight public payload.");

  const seen = new Set();
  for (const item of inventory.topLevelItems) {
    if (seen.has(item.path)) failures.push(`${item.path}: duplicate public top-level inventory entry`);
    seen.add(item.path);
    if (!Number.isFinite(item.sourceBytes) || item.sourceBytes < 0) failures.push(`${item.path}: source bytes were not measured`);
    if (!Number.isFinite(item.fileCount) || item.fileCount < 0) failures.push(`${item.path}: file count was not measured`);
    if (!item.category) failures.push(`${item.path}: category is missing`);
    if (!item.disposition) failures.push(`${item.path}: disposition is missing`);
    if (!Array.isArray(item.evidence) || item.evidence.length === 0) failures.push(`${item.path}: evidence is missing`);
  }

  const afterglow = inventory.topLevelItems.find((item) => item.path === "public/afterglow");
  if (afterglow) {
    if (inventory.reconciliation.afterglowSourceBytes !== afterglow.sourceBytes) failures.push("Afterglow child bytes do not reconcile to public/afterglow.");
    const legacy = inventory.afterglowItems.find((item) => item.path === "public/afterglow/legacy-visuals");
    if (!legacy) failures.push("Active Afterglow legacy visual media is missing from the subinventory.");
    else {
      if (legacy.disposition !== "retain-active-reference") failures.push("Active Afterglow legacy visuals are not explicitly retained.");
      if (!legacy.evidence.some((item) => item.includes("app/afterglow-legacy-visuals.tsx"))) failures.push("Active Afterglow legacy visual consumer evidence is missing.");
    }
  }

  const visualReferences = inventory.topLevelItems.find((item) => item.path === "public/visual-references");
  if (!visualReferences) failures.push("Visual Reference Library container is missing from the public subinventory.");
  else {
    if (visualReferences.disposition !== "retain-current-product") failures.push("The active Visual Reference Library container is not explicitly retained.");
    if (inventory.reconciliation.visualReferenceSourceBytes !== visualReferences.sourceBytes) failures.push("Visual Reference Library child bytes do not reconcile to public/visual-references.");
    const requiredActivePaths = [
      "public/visual-references/manifest.json",
      "public/visual-references/thumbnail",
      "public/visual-references/card",
    ];
    for (const requiredPath of requiredActivePaths) {
      const item = inventory.visualReferenceItems.find((candidate) => candidate.path === requiredPath);
      if (!item || item.disposition !== "retain-active-reference") failures.push(`${requiredPath}: active Visual Reference Library payload is not explicitly retained`);
    }
    const full = inventory.visualReferenceItems.find((item) => item.path === "public/visual-references/full");
    if (!full || full.disposition !== "requires-reachability-proof") failures.push("Full-resolution Visual Reference media needs explicit reachability proof before a later split.");
  }

  return failures;
}

function argumentValue(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
}

async function main() {
  const inventory = buildPublicMediaInventory();
  const failures = validatePublicMediaInventory(inventory);
  if (failures.length) {
    for (const failure of failures) console.error(`[public-media inventory] ${failure}`);
    process.exitCode = 1;
    return;
  }

  const json = `${JSON.stringify(inventory, null, 2)}\n`;
  const output = argumentValue("--output");
  if (output) {
    const resolved = path.resolve(repoRoot, output);
    mkdirSync(path.dirname(resolved), { recursive: true });
    writeFileSync(resolved, json, "utf8");
    console.log(resolved);
  } else {
    process.stdout.write(json);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
