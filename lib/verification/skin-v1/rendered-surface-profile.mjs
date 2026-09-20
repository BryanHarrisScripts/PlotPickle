import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { sanitizeBrowserDiagnosticText } from "../browser-verification-broker.mjs";

export const RENDERED_GEOMETRY_ARTIFACT_ROOT = ".artifacts/browser-diagnostics/skin-v1-visual-director/geometry";

function sanitizeProfileLabels(profile) {
  const clone = structuredClone(profile);
  for (const menu of clone.geometry?.menus || []) {
    menu.identity = sanitizeBrowserDiagnosticText(menu.identity || "");
    for (const item of menu.items || []) {
      item.identity = sanitizeBrowserDiagnosticText(item.identity || "");
      item.label = sanitizeBrowserDiagnosticText(item.label || "");
      item.shortcut = sanitizeBrowserDiagnosticText(item.shortcut || "");
    }
  }
  for (const item of clone.geometry?.edgeViolations || []) {
    item.identity = sanitizeBrowserDiagnosticText(item.identity || "");
  }
  for (const item of clone.geometry?.overlaps || []) {
    item.first = sanitizeBrowserDiagnosticText(item.first || "");
    item.second = sanitizeBrowserDiagnosticText(item.second || "");
  }
  return clone;
}

export async function collectRenderedSurfaceProfile(page, {
  surfaceName,
  rootSelector,
  colorTokens = [],
  contractTokens = [],
} = {}) {
  return page.evaluate(({ surfaceName: name, rootSelector: selector, colorTokens: colors, contractTokens: tokens }) => {
    const root = document.querySelector(selector);
    if (!(root instanceof HTMLElement)) throw new Error(`Rendered profile could not resolve ${name} root.`);

    const round = (value) => Math.round(Number(value) * 100) / 100;
    const rect = (node) => {
      const box = node.getBoundingClientRect();
      return {
        x: round(box.x),
        y: round(box.y),
        left: round(box.left),
        top: round(box.top),
        right: round(box.right),
        bottom: round(box.bottom),
        width: round(box.width),
        height: round(box.height),
      };
    };
    const visible = (node) => {
      if (!(node instanceof HTMLElement)) return false;
      const style = getComputedStyle(node);
      const clipPath = String(style.clipPath || "").replace(/\s+/gu, "").toLocaleLowerCase();
      const clip = String(style.clip || "").replace(/\s+/gu, "").toLocaleLowerCase();
      const intentionallyClipped = clipPath === "inset(50%)"
        || clip === "rect(0px,0px,0px,0px)";
      return style.display !== "none"
        && style.visibility !== "hidden"
        && !intentionallyClipped
        && node.getClientRects().length > 0;
    };
    const role = (node) => {
      if (node.matches("img,video")) return "media";
      if (node.matches("h1,h2,h3,h4,h5,h6,[role='heading'],.pp-skin-v1-title,.pp-skin-v1-bar,.pp-skin-v1-bbs-banner")) return "heading";
      if (node.matches(".pp-skin-v1-panel,.pp-skin-v1-bbs,[data-skin-role='panel']")) return "panel";
      if (node.matches("button,a[href],input:not([type='hidden']),select,textarea,[role='button'],[role='tab'],[role='menuitem'],[role='option']")) return "control";
      if (node.matches("[role='status'],[role='alert'],[aria-live],.pp-skin-v1-status")) return "status";
      if (node.matches("p,label,small,li,dt,dd")) return "body";
      return node.getAttribute("data-skin-role") || "surface";
    };
    const typographyRole = (node) => {
      const explicit = node.getAttribute("data-skin-typography");
      if (explicit) return { role: explicit, source: "explicit" };
      if (node.matches(".pp-skin-v1-dashboard-brand h1")) return { role: "display", source: "context" };
      if (node.matches("[data-keycap]")) return { role: "keycap", source: "context" };
      if (node.matches("[role='status'],[role='alert'],[aria-live],.pp-skin-v1-status,footer")) return { role: "status", source: "context" };
      const menuOwner = node.closest("nav,[role='menu'],[role='tablist'],[data-skin-menu],[data-library-directory],[data-settings-menu]");
      const governedMenuNode = node.matches("[role='menuitem'],[role='tab'],.pp-skin-v1-menu-item,[data-dashboard-menu-item],[data-settings-secondary-item],[data-library-nav]")
        || (menuOwner && node.matches("button,a[href],[role='button'],[role='option']"));
      if (governedMenuNode) {
        const fontSize = Number.parseFloat(getComputedStyle(node).fontSize || "");
        if (fontSize === 0 && node.children.length > 0) return { role: null, source: "container" };
        return { role: "menu", source: "context" };
      }
      if (node.matches("[data-dashboard-shortcut],[data-settings-shortcut],[data-library-shortcut]")) return { role: "keycap", source: "context" };
      if (node.matches("h1")) return { role: "h1", source: "semantic-heading" };
      if (node.matches("h2")) return { role: "h2", source: "semantic-heading" };
      if (node.matches("h3")) return { role: "h3", source: "semantic-heading" };
      if (node.matches("h4")) return { role: "h4", source: "semantic-heading" };
      if (node.matches("h5")) return { role: "h5", source: "semantic-heading" };
      if (node.matches("h6")) return { role: "h6", source: "semantic-heading" };
      if (node.matches("textarea")) return { role: "body", source: "html-fallback" };
      if (node.matches("button,input:not([type='hidden']),select,[role='button'],[role='option']")) return { role: "control", source: "html-fallback" };
      if (node.matches("small")) return { role: "note", source: "html-fallback" };
      if (node.matches("label,dt,dd")) return { role: "detail", source: "html-fallback" };
      if (node.matches("p,li")) return { role: "body", source: "html-fallback" };
      return { role: null, source: "unclassified" };
    };
    const identity = (node, index = 0) => node.getAttribute("data-skin-id")
      || node.getAttribute("data-dashboard-menu-item")
      || node.getAttribute("data-settings-secondary-item")
      || node.getAttribute("data-library-nav")
      || node.getAttribute("data-story-mode-policy")
      || node.id
      || node.getAttribute("aria-label")
      || node.getAttribute("name")
      || `${node.tagName.toLowerCase()}#${index}`;
    const rootDepth = (node) => {
      if (node === root) return 0;
      let depth = 0;
      let current = node;
      while (current && current !== root) {
        depth += 1;
        current = current.parentElement;
      }
      return current === root ? depth : null;
    };
    const presentation = (node) => {
      const style = getComputedStyle(node);
      return {
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        textTransform: style.textTransform,
        color: style.color,
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        borderRadius: style.borderRadius,
        borderTopWidth: style.borderTopWidth,
        borderRightWidth: style.borderRightWidth,
        borderBottomWidth: style.borderBottomWidth,
        borderLeftWidth: style.borderLeftWidth,
        borderTopColor: style.borderTopColor,
        borderRightColor: style.borderRightColor,
        borderBottomColor: style.borderBottomColor,
        borderLeftColor: style.borderLeftColor,
        paddingTop: style.paddingTop,
        paddingRight: style.paddingRight,
        paddingBottom: style.paddingBottom,
        paddingLeft: style.paddingLeft,
        marginTop: style.marginTop,
        marginRight: style.marginRight,
        marginBottom: style.marginBottom,
        marginLeft: style.marginLeft,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        position: style.position,
        zIndex: style.zIndex,
        display: style.display,
        gridTemplateColumns: style.gridTemplateColumns,
        columnGap: style.columnGap,
        rowGap: style.rowGap,
        transitionProperty: style.transitionProperty,
        transitionDuration: style.transitionDuration,
        transitionDelay: style.transitionDelay,
        width: `${rect(node).width}px`,
        height: `${rect(node).height}px`,
        rect: rect(node),
      };
    };
    const compactLabel = (node) => String(
      node.getAttribute("aria-label")
      || node.getAttribute("data-label")
      || node.textContent
      || identity(node)
      || ""
    ).replace(/\s+/gu, " ").trim().slice(0, 80);

    const selectorSet = ".pp-skin-v1-panel,.pp-skin-v1-bbs,[data-skin-role],[data-skin-typography],button,a[href],input:not([type='hidden']),select,textarea,[role='button'],[role='tab'],[role='menuitem'],[role='option'],h1,h2,h3,h4,h5,h6,[role='heading'],.pp-skin-v1-title,.pp-skin-v1-bar,.pp-skin-v1-bbs-banner,[role='status'],[role='alert'],[aria-live],.pp-skin-v1-status,p,label,small,li,dt,dd,img,video";
    const nodes = [...new Set([root, ...root.querySelectorAll(selectorSet)])].filter(visible);
    const rootBox = rect(root);

    const verticalCoverageNodes = [...new Set([
      ...nodes,
      ...root.querySelectorAll("span,strong"),
    ])].filter(visible);
    const verticalIntervals = verticalCoverageNodes
      .filter((node) => node !== root)
      .map((node) => rect(node))
      .filter((box) => box.height > 0 && box.bottom >= rootBox.top && box.top <= rootBox.bottom)
      .map((box) => [Math.max(rootBox.top, box.top), Math.min(rootBox.bottom, box.bottom)])
      .sort((a, b) => a[0] - b[0]);
    const mergedIntervals = [];
    for (const interval of verticalIntervals) {
      const previous = mergedIntervals.at(-1);
      if (!previous || interval[0] > previous[1]) mergedIntervals.push([...interval]);
      else previous[1] = Math.max(previous[1], interval[1]);
    }
    let cursor = rootBox.top;
    let largestVerticalGap = 0;
    for (const interval of mergedIntervals) {
      largestVerticalGap = Math.max(largestVerticalGap, interval[0] - cursor);
      cursor = Math.max(cursor, interval[1]);
    }
    largestVerticalGap = Math.max(largestVerticalGap, rootBox.bottom - cursor);

    const topLevelChildren = [...root.children].filter(visible).map((node, index) => ({
      identity: identity(node, index),
      role: role(node),
      rect: rect(node),
      presentation: presentation(node),
    }));

    const edgeViolations = [];
    for (const child of topLevelChildren) {
      const delta = {
        left: round(rootBox.left - child.rect.left),
        right: round(child.rect.right - rootBox.right),
        top: round(rootBox.top - child.rect.top),
        bottom: round(child.rect.bottom - rootBox.bottom),
      };
      for (const [edge, pixels] of Object.entries(delta)) {
        if (pixels > 1) edgeViolations.push({ identity: child.identity, edge, pixels });
      }
    }

    const overlapArea = (a, b) => {
      const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return { width: round(width), height: round(height), area: round(width * height) };
    };
    const overlaps = [];
    for (let index = 0; index < topLevelChildren.length; index += 1) {
      for (let other = index + 1; other < topLevelChildren.length; other += 1) {
        const first = topLevelChildren[index];
        const second = topLevelChildren[other];
        const intersection = overlapArea(first.rect, second.rect);
        if (intersection.width > 1 && intersection.height > 1) {
          overlaps.push({
            first: first.identity,
            second: second.identity,
            width: intersection.width,
            height: intersection.height,
            area: intersection.area,
          });
        }
      }
    }

    const gridNodes = [...new Set([root, ...[...root.querySelectorAll("*")].slice(0, 1600)])]
      .filter(visible)
      .flatMap((node, index) => {
        const style = getComputedStyle(node);
        if (style.display !== "grid" || !style.gridTemplateColumns || style.gridTemplateColumns === "none") return [];
        const tracks = style.gridTemplateColumns.split(/\s+/u).filter(Boolean);
        return [{
          identity: identity(node, index),
          columns: tracks.length,
          template: style.gridTemplateColumns,
          columnGap: style.columnGap,
          rect: rect(node),
          rootDepth: rootDepth(node),
          rootWidthRatio: rootBox.width > 0 ? round(rect(node).width / rootBox.width) : 0,
          rootHeightRatio: rootBox.height > 0 ? round(rect(node).height / rootBox.height) : 0,
        }];
      });
    const primaryGrid = [...gridNodes]
      .filter((candidate) => candidate.columns >= 1)
      .sort((left, right) => (right.rect.width * right.rect.height) - (left.rect.width * left.rect.height))[0] || null;

    const menuNodes = [...new Set([
      ...root.querySelectorAll("nav,[role='menu'],[data-skin-menu],[data-library-directory],[data-settings-menu]"),
      ...(root.matches("nav,[role='menu'],[data-skin-menu],[data-library-directory],[data-settings-menu]") ? [root] : []),
    ])].filter(visible);
    const menus = menuNodes.map((menu, menuIndex) => {
      const items = [...menu.querySelectorAll("button,a[href],[role='menuitem'],[role='tab'],[data-dashboard-menu-item],[data-settings-secondary-item],[data-library-nav]")]
        .filter(visible)
        .map((item, itemIndex) => ({
          identity: identity(item, itemIndex),
          label: compactLabel(item),
          shortcut: item.getAttribute("data-dashboard-shortcut")
            || item.getAttribute("data-settings-shortcut")
            || item.getAttribute("data-library-shortcut")
            || item.getAttribute("data-shortcut")
            || "",
          selected: item.getAttribute("aria-selected") === "true"
            || item.getAttribute("aria-pressed") === "true"
            || item.classList.contains("is-selected"),
          rect: rect(item),
        }));
      const xSpread = items.length > 1 ? Math.max(...items.map((item) => item.rect.left)) - Math.min(...items.map((item) => item.rect.left)) : 0;
      const ySpread = items.length > 1 ? Math.max(...items.map((item) => item.rect.top)) - Math.min(...items.map((item) => item.rect.top)) : 0;
      const orientation = items.length < 2 ? "single" : xSpread > ySpread ? "horizontal" : "vertical";
      return {
        identity: identity(menu, menuIndex),
        orientation,
        rect: rect(menu),
        items,
      };
    });

    const majorSections = topLevelChildren
      .filter((child) => child.rect.height >= Math.max(40, innerHeight * 0.12))
      .map((child) => ({
        identity: child.identity,
        role: child.role,
        startY: child.rect.top,
        endY: child.rect.bottom,
        height: child.rect.height,
        viewportHeights: innerHeight > 0 ? round(child.rect.height / innerHeight) : 0,
      }));

    const media = [...root.querySelectorAll("img,video")].filter(visible).map((node, index) => {
      if (node instanceof HTMLImageElement) {
        return {
          identity: identity(node, index),
          kind: "img",
          broken: node.complete && node.naturalWidth === 0,
          detail: node.complete && node.naturalWidth === 0 ? `image failed: ${node.currentSrc || node.src || "missing source"}` : "",
        };
      }
      if (node instanceof HTMLVideoElement) {
        return {
          identity: identity(node, index),
          kind: "video",
          broken: Boolean(node.error),
          detail: node.error ? `video error code ${node.error.code}` : "",
        };
      }
      return { identity: identity(node, index), kind: "media", broken: false, detail: "" };
    });

    const shellLandmarks = [...document.querySelectorAll("[data-skin-reference='dashboard-canonical'],[data-matrix-preproduction-context='current'],header[role='banner'],nav[aria-label]")].filter(visible).length;
    const html = getComputedStyle(document.documentElement);
    const resolvedColors = {};
    for (const token of colors) {
      const probe = document.createElement("span");
      probe.style.color = `var(${token})`;
      probe.style.display = "none";
      document.body.appendChild(probe);
      resolvedColors[token] = getComputedStyle(probe).color;
      probe.remove();
    }

    const documentElement = document.documentElement;
    return {
      surface: name,
      root: presentation(root),
      resolvedColors,
      tokens: Object.fromEntries([...colors, ...tokens].map((token) => [token, html.getPropertyValue(token).trim()])),
      layout: {
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
        largestVerticalGap,
        shellLandmarks,
      },
      media: {
        total: media.length,
        broken: media.filter((item) => item.broken),
      },
      geometry: {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        document: { width: documentElement.scrollWidth, height: documentElement.scrollHeight },
        root: rootBox,
        gutters: {
          left: round(rootBox.left),
          right: round(window.innerWidth - rootBox.right),
        },
        pageHorizontalOverflowPx: round(Math.max(0, documentElement.scrollWidth - window.innerWidth)),
        topLevelChildren,
        edgeViolations,
        overlaps,
        grids: gridNodes,
        primaryGrid,
        menus,
        majorSections,
      },
      items: nodes.map((node, index) => {
        const typography = typographyRole(node);
        return {
          role: role(node),
          typographyRole: typography.role,
          typographyRoleSource: typography.source,
          visualTreatment: node.getAttribute("data-skin-visual-treatment") || "",
          controlDensityRole: node.getAttribute("data-skin-control-density") || "",
          identity: identity(node, index),
          presentation: presentation(node),
        };
      }),
    };
  }, {
    surfaceName,
    rootSelector,
    colorTokens,
    contractTokens,
  });
}

function artifactStem(surfaceId) {
  return String(surfaceId || "unknown").toLowerCase().replace(/[^a-z0-9-]+/gu, "-");
}

export async function writeRenderedGeometryEvidence({
  page,
  profile,
  surfaceId,
  artifactRoot = RENDERED_GEOMETRY_ARTIFACT_ROOT,
} = {}) {
  const stem = artifactStem(surfaceId || profile?.surface);
  const root = path.resolve(artifactRoot);
  await mkdir(root, { recursive: true });
  const jsonPath = path.join(root, `${stem}.json`);
  const screenshotPath = path.join(root, `${stem}.png`);
  const sanitized = sanitizeProfileLabels(profile);
  await writeFile(jsonPath, `${JSON.stringify(sanitized, null, 2)}\n`, "utf8");
  await page.screenshot({ path: screenshotPath, fullPage: false });
  return {
    json: jsonPath,
    screenshot: screenshotPath,
  };
}

function finding(surface, severity, category, identity, property, actual, expected, guidance) {
  return {
    surface,
    severity,
    category,
    identity: identity || "surface",
    property,
    actual: String(actual ?? ""),
    expected: String(expected ?? ""),
    guidance,
  };
}

export function analyzeRenderedSurfaceContract(contract, profile) {
  const findings = [];
  const geometry = profile.geometry || {};
  const surface = contract.surfaceId || profile.surface;
  const tolerance = Number(contract.expected?.measurement?.pixelTolerance ?? 1);
  const relativeToleranceRatio = Number(contract.expected?.measurement?.relativeToleranceRatio ?? 0.02);
  const rootWidth = Number(geometry.root?.width ?? 0);
  const rootHeight = Number(geometry.root?.height ?? 0);
  const horizontalTolerance = Math.max(tolerance, rootWidth * relativeToleranceRatio);
  const verticalTolerance = Math.max(tolerance, rootHeight * relativeToleranceRatio);

  if (geometry.pageHorizontalOverflowPx > tolerance && !contract.expected.measurement.pageLevelHorizontalOverflowAllowed) {
    findings.push(finding(
      surface,
      "blocker",
      "horizontal-overflow",
      "document",
      "pageHorizontalOverflowPx",
      `${geometry.pageHorizontalOverflowPx}px`,
      "0px",
      "Page-level horizontal overflow is outside the governed Skin V1 shell. Keep the surface within the viewport or declare an intentional horizontal workspace boundary.",
    ));
  }

  const leftGutter = Number(geometry.gutters?.left ?? 0);
  const rightGutter = Number(geometry.gutters?.right ?? 0);
  if (Math.abs(leftGutter - rightGutter) > horizontalTolerance) {
    findings.push(finding(
      surface,
      "advisory",
      "gutter-asymmetry",
      "root",
      "left/right gutter delta",
      `${Math.round(Math.abs(leftGutter - rightGutter))}px`,
      `<= ${Math.round(horizontalTolerance * 100) / 100}px (${Math.round(relativeToleranceRatio * 100)}% governed visual tolerance)`,
      "The governed root is not horizontally balanced. Check shared shell width, margin and frame containment before adding a surface-specific offset.",
    ));
  }

  for (const violation of geometry.edgeViolations || []) {
    const edgeTolerance = violation.edge === "left" || violation.edge === "right" ? horizontalTolerance : verticalTolerance;
    if (Number(violation.pixels) <= edgeTolerance) continue;
    findings.push(finding(
      surface,
      "blocker",
      "frame-overlap",
      violation.identity,
      `${violation.edge} edge`,
      `${violation.pixels}px outside root`,
      `<= ${Math.round(edgeTolerance * 100) / 100}px (${Math.round(relativeToleranceRatio * 100)}% governed visual tolerance)`,
      "A top-level region crosses the governed surface frame. Fix the shared containment/grid rule rather than masking the frame with another background.",
    ));
  }

  for (const overlap of geometry.overlaps || []) {
    if (Number(overlap.width) <= tolerance || Number(overlap.height) <= tolerance) continue;
    findings.push(finding(
      surface,
      "advisory",
      "structural-overlap",
      `${overlap.first} ↔ ${overlap.second}`,
      "intersection",
      `${overlap.width}px × ${overlap.height}px`,
      "no accidental sibling intersection",
      "Two top-level governed regions occupy the same rendered space. Confirm the overlap is intentional; otherwise repair the shared shell/grid/stacking context.",
    ));
  }

  const expectedColumns = contract.expected?.layout?.workspaceColumnCount;
  const gridCandidates = (geometry.grids || [])
    .filter((grid) => Number(grid.rootWidthRatio) >= 0.55 && Number(grid.rootHeightRatio) >= 0.05);
  const matchingGrid = Number.isInteger(expectedColumns)
    ? gridCandidates
      .filter((grid) => grid.columns === expectedColumns)
      .sort((left, right) => (right.rect.width * right.rect.height) - (left.rect.width * left.rect.height))[0] || null
    : null;
  const shellLevelGrid = (grid) => {
    if (!grid) return false;
    if (Number.isInteger(grid.rootDepth)) return grid.rootDepth <= 1;
    // Backward compatibility for older/synthetic evidence that predates rootDepth.
    return true;
  };
  const shellGridCandidates = gridCandidates
    .filter((grid) =>
      shellLevelGrid(grid)
      && Number(grid.rootWidthRatio) >= 0.65
      && Number(grid.rootHeightRatio) >= 0.2
    )
    .sort((left, right) => (right.rect.width * right.rect.height) - (left.rect.width * left.rect.height));
  const shellPrimaryGrid = shellGridCandidates[0] || null;
  if (Number.isInteger(expectedColumns) && !matchingGrid && shellPrimaryGrid && shellPrimaryGrid.columns !== expectedColumns) {
    findings.push(finding(
      surface,
      "blocker",
      "column-contract",
      shellPrimaryGrid.identity,
      "rendered grid columns",
      shellPrimaryGrid.columns,
      expectedColumns,
      "The shell-level rendered grid does not match the declared workspace-column contract. Nested content/card grids do not count as shell columns.",
    ));
  }

  for (const grid of geometry.grids || []) {
    if (
      grid.columns >= 4
      && shellLevelGrid(grid)
      && grid.rootWidthRatio >= 0.75
      && grid.rootHeightRatio >= 0.25
      && !contract.expected.layout.fourColumnShellAllowed
    ) {
      findings.push(finding(
        surface,
        "blocker",
        "undeclared-four-column-shell",
        grid.identity,
        "gridTemplateColumns",
        grid.template,
        "approved one/two/three-column shell or subordinate four-across content only",
        "A shell-level four-column grid is not an approved Skin V1 archetype. Subordinate four-across card/metric groups remain valid.",
      ));
    }
  }

  const normalizeMenuLabel = (value) => String(value || "")
    .replace(/^\s*\[[^\]]+\]\s*/u, "")
    .replace(/\s+\(\d+\)\s*$/u, "")
    .replace(/\s+-\s+.*$/u, "")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase();
  const expectedLabels = contract.expected?.menu?.expectedVisibleLabels || [];
  if (expectedLabels.length) {
    const renderedLabels = new Set((geometry.menus || []).flatMap((menu) => menu.items || []).map((item) =>
      normalizeMenuLabel(item.label)
    ));
    const missing = expectedLabels.filter((label) =>
      !renderedLabels.has(normalizeMenuLabel(label))
    );
    if (missing.length) {
      findings.push(finding(
        surface,
        "advisory",
        "menu-completeness",
        "navigation",
        "visible menu labels",
        `missing: ${missing.join(", ")}`,
        expectedLabels.join(", "),
        "Expected registered child destinations are not visible in the governed menu evidence. Check menu projection before adding another navigation implementation.",
      ));
    }
  }

  const canonicalFamily = contract.expected?.typography?.canonicalFamily;
  if (canonicalFamily) {
    const drift = (profile.items || []).find((item) => {
      const family = String(item.presentation?.fontFamily || "");
      return family && !family.toLocaleLowerCase().includes(canonicalFamily.toLocaleLowerCase());
    });
    if (drift && !contract.expected.typography.localFontFamilyAllowed) {
      findings.push(finding(
        surface,
        "blocker",
        "typography-contract",
        drift.identity,
        "fontFamily",
        drift.presentation?.fontFamily,
        canonicalFamily,
        "Use the canonical Skin V1 typography profile instead of a local/fallback surface font.",
      ));
    }
  }

  const semanticTypography = contract.expected?.typography?.semanticRoles || {};
  const governedTypographySources = new Set(["explicit", "context", "semantic-heading"]);
  for (const item of profile.items || []) {
    const roleName = item.typographyRole;
    const expectedRole = semanticTypography[roleName];
    if (!roleName || !expectedRole || !governedTypographySources.has(item.typographyRoleSource)) continue;
    const actualSize = Number.parseFloat(String(item.presentation?.fontSize || ""));
    const expectedSize = Number(expectedRole.sizePx);
    if (Number.isFinite(expectedSize) && Number.isFinite(actualSize) && Math.abs(actualSize - expectedSize) > 0.75) {
      findings.push(finding(
        surface,
        "advisory",
        "typography-role-size",
        item.identity,
        roleName,
        `${actualSize}px`,
        `${expectedSize}px`,
        "Use the canonical semantic typography scale for this role; keep hierarchy in the shared token/profile system instead of local font sizing.",
      ));
    }
    const actualWeight = Number.parseInt(String(item.presentation?.fontWeight || ""), 10);
    const expectedWeight = Number(expectedRole.weight);
    if (Number.isFinite(expectedWeight) && Number.isFinite(actualWeight) && actualWeight !== expectedWeight) {
      findings.push(finding(
        surface,
        "advisory",
        "typography-role-weight",
        item.identity,
        roleName,
        actualWeight,
        expectedWeight,
        "Use the canonical semantic weight for this role; JetBrains Mono remains the single family.",
      ));
    }
    if (expectedRole.textTransform && expectedRole.textTransform !== "none") {
      const actualTransform = String(item.presentation?.textTransform || "none");
      if (actualTransform !== expectedRole.textTransform) {
        findings.push(finding(
          surface,
          "advisory",
          "typography-role-transform",
          item.identity,
          roleName,
          actualTransform,
          expectedRole.textTransform,
          "Apply the declared semantic casing rather than a local text-transform rule.",
        ));
      }
    }
  }

  const enforcementMode = contract.expected?.measurement?.enforcementMode || "advisory-census";
  if (enforcementMode === "blocking") return findings;
  return findings.map((item) => item.severity === "blocker"
    ? { ...item, severity: "advisory", proposedSeverity: "blocker", enforcementMode }
    : { ...item, proposedSeverity: item.severity, enforcementMode });
}
