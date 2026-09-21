import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export const SURFACE_CONTRACT_MATRIX_DOC = "docs/architecture/skin-v1-surface-contract-matrix.md";
export const SURFACE_CONTRACT_MATRIX_ARTIFACT = ".artifacts/browser-diagnostics/surface-contract-matrix.md";

const SOURCE_PATHS = Object.freeze({
  registry: "config/skin-v1-surface-registry.json",
  grammar: "config/skin-v1-surface-grammar.json",
  anatomy: "config/skin-v1-surface-anatomy-contract.json",
  composition: "config/skin-v1-surface-composition-reference.json",
  specSheet: "config/skin-v1-spec-sheet-contract.json",
  declarations: "config/skin-v1-surface-declarations/standard-surfaces.json",
  sceneWorkspace: "config/skin-v1-surface-declarations/scene-workspace.json",
});

const STATIC_COLUMN_COUNTS = Object.freeze({
  "one-column": 1,
  "two-column": 2,
  "three-column": 3,
  "editor-inspector": 2,
});

async function readJson(root, relative) {
  return JSON.parse(await readFile(path.resolve(root, relative), "utf8"));
}

function tokenBorderPx(token, composition) {
  if (!token) return null;
  if (token === composition.bordersAndFrames?.onePixel?.token) return Number(composition.bordersAndFrames.onePixel.px);
  if (token === composition.bordersAndFrames?.twoPixel?.token) return Number(composition.bordersAndFrames.twoPixel.px);
  return null;
}

function childSurfaces(surface, registry) {
  return registry.surfaces
    .filter((candidate) => candidate.parent === surface.id && candidate.capturePolicy === "standard" && candidate.orchestrated !== false)
    .sort((left, right) => {
      const leftOrder = left.navigationPath?.at(-1)?.order ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.navigationPath?.at(-1)?.order ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder || left.label.localeCompare(right.label);
    });
}

function menuContract(surface, declaration, registry) {
  const children = childSurfaces(surface, registry);
  const inherited = surface.parent && registry.surfaces.some((candidate) =>
    candidate.id === surface.parent && candidate.capturePolicy === "standard"
  );
  const regions = declaration?.regions || [];
  const declaredMenuRegion = regions.find((region) => ["directory", "destination-navigation", "submenu"].includes(region.role));
  const ownsVisibleMenu = Boolean(declaredMenuRegion);
  const family = declaredMenuRegion?.role || (inherited ? "inherited" : "none");
  let orientation = "not-applicable";
  if (family !== "none") {
    if (surface.family === "library" && surface.id === "library") orientation = "horizontal";
    else if (declaredMenuRegion?.placement === "left-rail") orientation = "vertical";
    else if (ownsVisibleMenu && children.length) orientation = "profile-defined";
    else orientation = "inherited";
  }
  return {
    family,
    orientation,
    visibilityScope: ownsVisibleMenu ? "owned-direct-children" : family === "inherited" ? "inherited-owner" : "none",
    keyboardCues: family === "none" ? "not-applicable" : "required-when-menu-profile-exposes-shortcuts",
    expectedVisibleLabels: ownsVisibleMenu
      ? children.map((candidate) => candidate.navigationPath?.at(-1)?.label || candidate.label)
      : [],
  };
}

function resolvedDeclaration(surface, declarations, sceneWorkspace) {
  if (surface.id === "scene-timeline") return {
    ...(declarations.surfaces?.[surface.id] || {}),
    individualOverride: sceneWorkspace,
  };
  return declarations.surfaces?.[surface.id] || null;
}

export async function loadSkinV1SurfaceContractSources({ root = DEFAULT_ROOT } = {}) {
  const [registry, grammar, anatomy, composition, specSheet, declarations, sceneWorkspace] = await Promise.all([
    readJson(root, SOURCE_PATHS.registry),
    readJson(root, SOURCE_PATHS.grammar),
    readJson(root, SOURCE_PATHS.anatomy),
    readJson(root, SOURCE_PATHS.composition),
    readJson(root, SOURCE_PATHS.specSheet),
    readJson(root, SOURCE_PATHS.declarations),
    readJson(root, SOURCE_PATHS.sceneWorkspace),
  ]);
  return { root, registry, grammar, anatomy, composition, specSheet, declarations, sceneWorkspace };
}

export function resolveSkinV1SurfaceContracts(sources) {
  const { registry, grammar, anatomy, composition, declarations, sceneWorkspace } = sources;
  const standard = registry.surfaces.filter((surface) => surface.capturePolicy === "standard");
  return standard.map((surface) => {
    const declaration = resolvedDeclaration(surface, declarations, sceneWorkspace);
    if (!declaration) throw new Error(`Missing Skin V1 surface declaration for ${surface.id}.`);
    const formatProfile = declaration.formatProfile || surface.formatProfile;
    const shellProfile = grammar.shellProfiles?.[formatProfile.shell];
    const frameProfile = grammar.frameProfiles?.[formatProfile.frame];
    if (!shellProfile) throw new Error(`Unknown shell profile ${formatProfile.shell} for ${surface.id}.`);
    if (!frameProfile) throw new Error(`Unknown frame profile ${formatProfile.frame} for ${surface.id}.`);

    const overrideColumns = declaration.individualOverride?.contentLayout?.workspaceColumnCount;
    const expectedColumns = Number.isInteger(overrideColumns)
      ? overrideColumns
      : (STATIC_COLUMN_COUNTS[formatProfile.layout] ?? null);
    const outerToken = frameProfile.outerBorderToken;
    const insetToken = frameProfile.insetBorderToken || null;

    return {
      surfaceId: surface.id,
      webmcpId: surface.webmcpId,
      label: surface.label,
      family: surface.family,
      parent: surface.parent,
      navigationPath: surface.navigationPath || [],
      runtimeSelector: surface.runtimeSelector,
      formatProfile,
      declarationSource: declaration.declarationSource || (surface.id === "scene-timeline" ? "individual-override" : "registry-projection"),
      expected: {
        shell: {
          maxWidthPx: Number(composition.shell.maxWidthPx),
          minimumDesktopGutterPerSidePx: Number(composition.shell.minimumDesktopGutterPerSidePx),
          directoryBodyMaxPx: Number(composition.shell.directoryBodyMaxPx),
          bodyMeasure: shellProfile.bodyMeasure,
        },
        frame: {
          profile: formatProfile.frame,
          style: frameProfile.borderStyle,
          outerBorderToken: outerToken,
          outerBorderPx: tokenBorderPx(outerToken, composition),
          insetBorderToken: insetToken,
          insetBorderPx: tokenBorderPx(insetToken, composition),
          accidentalOverlapAllowed: false,
        },
        layout: {
          archetype: formatProfile.layout,
          workspaceColumnCount: expectedColumns,
          fourColumnShellAllowed: Boolean(composition.authority.shellLevelFourColumnAllowed),
        },
        menu: menuContract(surface, declaration, registry),
        typography: {
          profile: formatProfile.typography,
          canonicalFamily: grammar.typographyProfiles?.[formatProfile.typography]?.canonicalFamily || "",
          fontToken: "--pp-skin-font-ui",
          singleFontFamily: true,
          localFontFamilyAllowed: Boolean(grammar.typographyProfiles?.[formatProfile.typography]?.localFontFamilyAllowed),
          semanticRoles: composition.typography?.semanticRoles || {},
        },
        presentation: {
          frameRoles: composition.bordersAndFrames?.roleMap || {},
          colourRoles: composition.palette?.semanticRoles || {},
          pillProfile: composition.pillPatterns?.styling || {},
          highlightProfile: composition.interactionStates?.highlight || null,
          premiumProfile: composition.interactionStates?.premium || null,
        },
        footer: declaration.footer || { required: false, roles: [] },
        returnAction: declaration.returnAction || null,
        titleStack: declaration.titleStack || null,
        measurement: {
          pixelTolerance: 1,
          relativeToleranceRatio: Number(grammar.rules?.geometry?.relativeToleranceRatio ?? 0.02),
          gapGridPx: Number(composition.spacing.baseUnitPx),
          pageLevelHorizontalOverflowAllowed: false,
          structuralClippingAllowed: false,
          geometryMayDefineSemantics: false,
          controlDensityProfile: formatProfile.typography === "project-workspace"
            ? "semantic-workspace-controls"
            : "dashboard-compact-controls",
          spacingRhythmScope: formatProfile.typography === "project-workspace"
            ? "semantic-workspace"
            : "dashboard-four-pixel",
          enforcementMode: anatomy.renderedMeasurementPolicy?.enforcementMode || "advisory-census",
        },
      },
    };
  });
}

export async function loadSkinV1SurfaceContracts(options = {}) {
  const sources = await loadSkinV1SurfaceContractSources(options);
  return {
    sources,
    contracts: resolveSkinV1SurfaceContracts(sources),
  };
}

function matrixValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  return String(value).replaceAll("|", "\\|");
}

export function renderSkinV1SurfaceContractMatrix(contracts) {
  const lines = [
    "# Skin V1 Surface Contract Matrix",
    "",
    "Generated projection of the existing Skin V1 four-layer specification stack. This file is evidence, not a fifth design authority.",
    "",
    "| Surface | Shell | Frame | Layout | Cols | Menu | Orientation | Keys | Typography | Footer | Return |",
    "| --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- |",
  ];
  for (const contract of contracts) {
    const expected = contract.expected;
    lines.push([
      contract.label,
      contract.formatProfile.shell,
      `${expected.frame.profile} (${matrixValue(expected.frame.outerBorderPx)}px${expected.frame.insetBorderPx ? ` + ${expected.frame.insetBorderPx}px inset` : ""})`,
      expected.layout.archetype,
      matrixValue(expected.layout.workspaceColumnCount),
      expected.menu.family,
      expected.menu.orientation,
      expected.menu.keyboardCues,
      `${expected.typography.profile} / ${expected.typography.canonicalFamily || "canonical"}`,
      expected.footer.required ? "required" : "optional",
      expected.returnAction?.alignment ? `${expected.returnAction.alignment} → ${expected.returnAction.parent || "origin"}` : "none",
    ].map(matrixValue).join(" | ").replace(/^/, "| ").replace(/$/, " |"));
  }
  const shared = contracts[0]?.expected;
  lines.push("");
  lines.push("## Shared presentation contract");
  lines.push("");
  lines.push("- Font family: JetBrains Mono for UI and product title; no screen-level family switching.");
  lines.push("- Typography roles: " + Object.keys(shared?.typography?.semanticRoles || {}).join(", ") + ".");
  lines.push("- Frame roles: " + Object.keys(shared?.presentation?.frameRoles || {}).join(", ") + ".");
  lines.push("- Colour roles: " + Object.keys(shared?.presentation?.colourRoles || {}).join(", ") + ".");
  lines.push("- Premium: semantic edge emphasis only; it cannot replace the outer shell or introduce another font family.");
  lines.push("");
  lines.push("## Shared measurement variables");
  lines.push("");
  lines.push("- Shell: max width, left/right gutters, document/viewport dimensions, horizontal overflow.");
  lines.push("- Frames: outer/inset border thickness, frame-to-content containment, clipping and accidental intersections.");
  lines.push("- Columns: semantic workspace column count, rendered grid tracks, ratios, gaps and undeclared four-column shell detection.");
  lines.push("- Menus: family, orientation, visible labels, order, active state, keyboard cues and Return relationship.");
  lines.push("- Typography: canonical family plus computed size, weight, line height, letter spacing and colour by semantic role.");
  lines.push("- Scroll structure: major panel coordinates, sticky/fixed controls and total scroll height.");
  lines.push("- Evidence: expected value, rendered value, delta, tolerance, severity and screenshot/JSON references.");
  lines.push("");
  lines.push("Four-column subordinate card/metric groups remain valid composition details. A four-column shell is not an approved Skin V1 archetype.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

export async function writeSkinV1SurfaceContractMatrix({
  root = DEFAULT_ROOT,
  target = SURFACE_CONTRACT_MATRIX_ARTIFACT,
} = {}) {
  const { contracts } = await loadSkinV1SurfaceContracts({ root });
  const output = renderSkinV1SurfaceContractMatrix(contracts);
  const resolved = path.resolve(root, target);
  await mkdir(path.dirname(resolved), { recursive: true });
  await writeFile(resolved, output, "utf8");
  return { path: resolved, surfaces: contracts.length, contracts };
}
