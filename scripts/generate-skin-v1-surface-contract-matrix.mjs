#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SURFACE_CONTRACT_MATRIX_PATH = "docs/architecture/skin-v1-surface-contract-matrix.md";

async function json(relativePath) {
  return JSON.parse(await readFile(path.join(repoRoot, relativePath), "utf8"));
}

function shellColumns(layout) {
  if (layout === "one-column") return "1";
  if (layout === "two-column" || layout === "editor-inspector") return "2";
  if (layout === "three-column") return "3";
  return "profile";
}

function menuProfile(declaration) {
  const roles = new Set((declaration?.regions || []).map((region) => region.role));
  if (roles.has("destination-navigation") || roles.has("submenu")) return "destination";
  if (roles.has("directory")) return "directory";
  return "none/local";
}

function localNavigation(declaration) {
  const roles = new Set((declaration?.regions || []).map((region) => region.role));
  return roles.has("tabs") || roles.has("submenu") ? "declared" : "profile/none";
}

export async function buildSurfaceContractMatrix() {
  const [registry, grammar, anatomy, composition, spec, declarations] = await Promise.all([
    json("config/skin-v1-surface-registry.json"),
    json("config/skin-v1-surface-grammar.json"),
    json("config/skin-v1-surface-anatomy-contract.json"),
    json("config/skin-v1-surface-composition-reference.json"),
    json("config/skin-v1-spec-sheet-contract.json"),
    json("config/skin-v1-surface-declarations/standard-surfaces.json"),
  ]);
  const standards = registry.surfaces.filter((surface) => surface.capturePolicy === "standard");
  const rows = standards.map((surface) => {
    const declaration = declarations.surfaces[surface.id];
    if (!declaration) throw new Error(\`Missing standard surface declaration for \${surface.id}.\`);
    const profile = declaration.formatProfile || surface.formatProfile;
    for (const field of ["layout", "shell", "frame", "selectedState", "typography"]) {
      if (!profile?.[field]) throw new Error(\`Surface \${surface.id} is missing formatProfile.\${field}.\`);
    }
    return {
      id: surface.id,
      label: surface.label,
      parent: surface.parent || "—",
      shell: profile.shell,
      frame: profile.frame,
      layout: profile.layout,
      columns: shellColumns(profile.layout),
      menu: menuProfile(declaration),
      keyboard: menuProfile(declaration) === "none/local" ? "when-declared" : "menu-profile",
      typography: profile.typography,
      footer: declaration.footer?.required ? "required" : "optional",
      localNav: localNavigation(declaration),
    };
  });
  return {
    issue: 2270,
    authority: {
      tokens: anatomy.authority.tokenLayer,
      composition: anatomy.authority.componentCompositionLayer,
      anatomy: "config/skin-v1-surface-anatomy-contract.json",
      declarations: anatomy.authority.declarationDirectory,
      registry: anatomy.authority.surfaceRegistry,
      grammar: anatomy.authority.surfaceGrammar,
      specSheet: "config/skin-v1-spec-sheet-contract.json",
    },
    policies: {
      fourColumnShellAllowed: Boolean(composition.layoutPatterns?.fourColumnShell?.allowed),
      renderedGeometryVerdictOwner: anatomy.renderedMeasurementSemantics?.authorityBoundary?.verdictOwner,
      specHasRenderedGeometry: Boolean(spec.requiredOutputs?.renderedGeometryContract?.required),
      standardSurfaceCount: rows.length,
      layoutArchetypeCount: Object.keys(grammar.layoutArchetypes || {}).length,
    },
    rows,
  };
}

export function renderSurfaceContractMatrix(matrix) {
  const lines = [
    "# Skin V1 Surface Contract Matrix",
    "",
    "Issue: #2270",
    "",
    "Generated projection of the existing Skin V1 four-layer specification stack. This file is not an independent design authority.",
    "",
    \`Standard WebMCP surfaces: \${matrix.policies.standardSurfaceCount}\`,
    "",
    "| Surface | Parent | Shell | Frame | Layout | Cols | Menu | Keys | Typography | Footer | Local Nav |",
    "| --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- |",
    ...matrix.rows.map((row) => \`| \${row.id} | \${row.parent} | \${row.shell} | \${row.frame} | \${row.layout} | \${row.columns} | \${row.menu} | \${row.keyboard} | \${row.typography} | \${row.footer} | \${row.localNav} |\`),
    "",
    "## Authority boundary",
    "",
    ...Object.entries(matrix.authority).map(([key, value]) => \`- \${key}: \${value}\`),
    "",
    "## Measurement policy",
    "",
    "- Browser execution: existing #2246 Browser Verification Broker.",
    "- Rendered collector/verdict: existing Visual Director path.",
    "- Four-column shell: prohibited until a future Human-approved grammar change; subordinate four-across content remains allowed.",
    "- Geometry evidence: .artifacts/browser-diagnostics/skin-v1-visual-director/geometry/.",
    "- Screenshots remain supporting evidence; expected state remains the existing token/composition/anatomy/declaration stack.",
    "",
  ];
  return \`\${lines.join("\\n")}\\n\`;
}

export async function generateSurfaceContractMatrix(outputPath = SURFACE_CONTRACT_MATRIX_PATH) {
  const matrix = await buildSurfaceContractMatrix();
  const markdown = renderSurfaceContractMatrix(matrix);
  const target = path.resolve(repoRoot, outputPath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, markdown, "utf8");
  return { matrix, outputPath };
}

const direct = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (direct) {
  generateSurfaceContractMatrix().then(({ matrix, outputPath }) => {
    process.stdout.write(\`Generated \${outputPath} for \${matrix.rows.length} standard surfaces.\\n\`);
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
