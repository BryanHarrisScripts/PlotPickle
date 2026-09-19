import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const SKIN_V1_GEOMETRY_ARTIFACT_ROOT = ".artifacts/browser-diagnostics/skin-v1-visual-director/geometry";
export const SKIN_V1_GEOMETRY_REPORT_PATH = `${SKIN_V1_GEOMETRY_ARTIFACT_ROOT}/surface-contract-report.json`;
export const SKIN_V1_GEOMETRY_REPORT_MARKDOWN_PATH = `${SKIN_V1_GEOMETRY_ARTIFACT_ROOT}/surface-contract-report.md`;

const NUMERIC_LAYOUT_COLUMNS = Object.freeze({
  "one-column": 1,
  "two-column": 2,
  "three-column": 3,
  "editor-inspector": 2,
});

function rounded(value) {
  return Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
}

function expectedColumns(declaration) {
  return NUMERIC_LAYOUT_COLUMNS[declaration?.formatProfile?.layout] ?? null;
}

function geometryFinding(surface, severity, category, property, actual, expected, guidance, identity = surface) {
  return {
    surface,
    severity,
    category,
    identity,
    property,
    actual: String(actual ?? ""),
    expected: String(expected ?? ""),
    guidance,
  };
}

export function analyzeRenderedGeometry(profile, declaration = null) {
  if (!profile?.surface) throw new Error("Rendered geometry analysis requires a surface profile.");
  const findings = [];
  const surface = profile.surface;
  const layout = profile.layout || {};
  const expected = expectedColumns(declaration);

  if (layout.horizontalOverflowPx > 1) {
    findings.push(geometryFinding(
      surface,
      "blocker",
      "horizontal-overflow",
      "horizontalOverflowPx",
      `${rounded(layout.horizontalOverflowPx)}px`,
      "0px",
      "Keep governed content inside the viewport/shell; page-level horizontal overflow is not allowed.",
    ));
  }

  for (const overflow of (profile.geometry?.rootOverflow || []).slice(0, 12)) {
    findings.push(geometryFinding(
      surface,
      "blocker",
      "frame-overflow",
      overflow.edge,
      `${rounded(overflow.pixels)}px`,
      "inside governed root frame",
      "Move this governed region back inside the surface frame instead of painting through the outer boundary.",
      overflow.identity,
    ));
  }

  for (const collision of (profile.geometry?.siblingOverlaps || []).slice(0, 12)) {
    findings.push(geometryFinding(
      surface,
      "advisory",
      "structural-overlap",
      "intersection",
      `${rounded(collision.width)}×${rounded(collision.height)}px`,
      "0px unless explicitly declared",
      "Review the sibling stacking/box geometry. Structural regions should not accidentally cover each other.",
      `${collision.left} ↔ ${collision.right}`,
    ));
  }

  const shellColumns = Number(profile.geometry?.shellColumns?.count || 0);
  if (expected !== null && shellColumns && shellColumns !== expected) {
    findings.push(geometryFinding(
      surface,
      "advisory",
      "column-contract",
      "shellColumns",
      shellColumns,
      expected,
      "Match the declared Skin V1 layout archetype. An undeclared extra column often appears as a phantom gap or shortened work area.",
    ));
  }
  if (shellColumns >= 4) {
    findings.push(geometryFinding(
      surface,
      "blocker",
      "column-contract",
      "shellColumns",
      shellColumns,
      "<= 3 shell-level columns",
      "Four-column subordinate card/metric groups are allowed, but the current Surface Grammar has no approved four-column shell archetype.",
    ));
  }

  if (declaration?.footer?.required && Number(profile.geometry?.footerCount || 0) === 0) {
    findings.push(geometryFinding(
      surface,
      "advisory",
      "missing-footer",
      "footerCount",
      0,
      ">= 1 governed status/footer region",
      "Restore the declared status/footer treatment or explicitly correct the surface declaration if the current product semantics changed.",
    ));
  }

  return findings;
}

export async function collectRenderedSurfaceProfile(page, {
  surfaceId,
  surfaceName,
  rootSelector,
  colorTokens,
  contractTokens,
} = {}) {
  if (!surfaceId || !surfaceName || !rootSelector) throw new Error("Rendered surface collection requires surfaceId, surfaceName and rootSelector.");
  return page.evaluate(({ surfaceIdValue, surfaceNameValue, rootSelectorValue, colorTokenValues, contractTokenValues }) => {
    const root = document.querySelector(rootSelectorValue);
    if (!(root instanceof HTMLElement)) throw new Error(`Rendered profile could not resolve ${surfaceNameValue} root.`);
    const visible = (node) => node instanceof HTMLElement
      && getComputedStyle(node).display !== "none"
      && getComputedStyle(node).visibility !== "hidden"
      && node.getClientRects().length > 0;
    const rect = (node) => {
      const box = node.getBoundingClientRect();
      return {
        x: box.x, y: box.y, left: box.left, top: box.top,
        right: box.right, bottom: box.bottom, width: box.width, height: box.height,
      };
    };
    const identity = (node, index = 0) => node.getAttribute("data-skin-id")
      || node.getAttribute("data-dashboard-menu-item")
      || node.getAttribute("data-settings-secondary-item")
      || node.getAttribute("data-library-nav")
      || node.getAttribute("data-library-destination")
      || node.id
      || node.getAttribute("aria-label")
      || node.getAttribute("name")
      || `${node.tagName.toLowerCase()}#${index}`;
    const role = (node) => {
      if (node.matches("img,video")) return "media";
      if (node.matches("h1,h2,h3,h4,h5,h6,[role='heading'],.pp-skin-v1-title,.pp-skin-v1-bar,.pp-skin-v1-bbs-banner")) return "heading";
      if (node.matches(".pp-skin-v1-panel,.pp-skin-v1-bbs,[data-skin-role='panel']")) return "panel";
      if (node.matches("button,a[href],input:not([type='hidden']),select,textarea,[role='button'],[role='tab'],[role='menuitem'],[role='option']")) return "control";
      if (node.matches("[role='status'],[role='alert'],[aria-live],.pp-skin-v1-status")) return "status";
      if (node.matches("nav,[role='navigation']")) return "navigation";
      if (node.matches("footer,[data-skin-role='footer']")) return "footer";
      if (node.matches("p,label,small")) return "body";
      return node.getAttribute("data-skin-role") || "surface";
    };
    const presentation = (node) => {
      const style = getComputedStyle(node);
      const box = rect(node);
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
        display: style.display,
        position: style.position,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        zIndex: style.zIndex,
        gridTemplateColumns: style.gridTemplateColumns,
        flexDirection: style.flexDirection,
        gap: style.gap,
        width: `${box.width}px`,
        height: `${box.height}px`,
        rect: box,
      };
    };

    const selector = ".pp-skin-v1-panel,.pp-skin-v1-bbs,[data-skin-role],nav,[role='navigation'],header,footer,button,a[href],input:not([type='hidden']),select,textarea,[role='button'],[role='tab'],[role='menuitem'],[role='option'],h1,h2,h3,h4,h5,h6,[role='heading'],.pp-skin-v1-title,.pp-skin-v1-bar,.pp-skin-v1-bbs-banner,[role='status'],[role='alert'],[aria-live],.pp-skin-v1-status,p,label,small,img,video";
    const nodes = [...new Set([root, ...root.querySelectorAll(selector)])].filter(visible);
    const rootBox = rect(root);

    const verticalIntervals = nodes
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

    const structuralNodes = [...new Set([
      root,
      ...root.querySelectorAll(":scope > *, [data-skin-role], .pp-skin-v1-panel, .pp-skin-v1-bbs, nav[aria-label], header, footer"),
    ])].filter(visible).slice(0, 180);
    const rootOverflow = [];
    structuralNodes.filter((node) => node !== root).forEach((node, index) => {
      const box = rect(node);
      const id = identity(node, index);
      const edges = [
        ["left", rootBox.left - box.left],
        ["right", box.right - rootBox.right],
        ["top", rootBox.top - box.top],
        ["bottom", box.bottom - rootBox.bottom],
      ];
      for (const [edge, pixels] of edges) if (pixels > 1.5) rootOverflow.push({ identity: id, edge, pixels });
    });

    const siblingOverlaps = [];
    const siblingGroups = new Map();
    for (const node of structuralNodes.filter((item) => item !== root && item.parentElement)) {
      const list = siblingGroups.get(node.parentElement) || [];
      list.push(node);
      siblingGroups.set(node.parentElement, list);
    }
    for (const siblings of siblingGroups.values()) {
      for (let leftIndex = 0; leftIndex < siblings.length; leftIndex += 1) {
        const a = siblings[leftIndex];
        const aBox = rect(a);
        for (let rightIndex = leftIndex + 1; rightIndex < siblings.length; rightIndex += 1) {
          const b = siblings[rightIndex];
          const bBox = rect(b);
          const width = Math.min(aBox.right, bBox.right) - Math.max(aBox.left, bBox.left);
          const height = Math.min(aBox.bottom, bBox.bottom) - Math.max(aBox.top, bBox.top);
          if (width > 2 && height > 2) siblingOverlaps.push({
            left: identity(a, leftIndex),
            right: identity(b, rightIndex),
            width,
            height,
          });
          if (siblingOverlaps.length >= 40) break;
        }
        if (siblingOverlaps.length >= 40) break;
      }
      if (siblingOverlaps.length >= 40) break;
    }

    const columnContainers = structuralNodes.flatMap((node, index) => {
      const style = getComputedStyle(node);
      const children = [...node.children].filter(visible);
      if (children.length < 2) return [];
      const boxes = children.map((child) => rect(child)).filter((box) => box.width >= 80 && box.height >= 30);
      if (boxes.length < 2) return [];
      const horizontal = boxes.filter((box) => Math.abs(box.top - boxes[0].top) < 12);
      const gridColumns = style.display === "grid" && style.gridTemplateColumns && style.gridTemplateColumns !== "none"
        ? style.gridTemplateColumns.split(/\s+/u).filter(Boolean).length
        : 0;
      const flexColumns = style.display === "flex" && style.flexDirection !== "column" ? horizontal.length : 0;
      const count = Math.max(gridColumns, flexColumns);
      if (count < 2) return [];
      const box = rect(node);
      return [{
        identity: identity(node, index),
        count,
        width: box.width,
        gap: style.columnGap || style.gap,
        display: style.display,
        template: style.gridTemplateColumns,
        childWidths: horizontal.slice(0, 6).map((child) => child.width),
      }];
    }).sort((a, b) => b.width - a.width);
    const shellColumns = columnContainers.find((item) => item.width >= rootBox.width * 0.55) || columnContainers[0] || null;

    const menus = [...root.querySelectorAll("nav,[role='navigation'],[role='menu']")].filter(visible).slice(0, 20).map((menu, index) => {
      const menuBox = rect(menu);
      const items = [...menu.querySelectorAll(":scope button,:scope a[href],:scope [role='menuitem'],:scope [role='tab'],button,a[href],[role='menuitem'],[role='tab']")]
        .filter(visible)
        .slice(0, 30);
      const itemBoxes = items.map((item) => rect(item));
      const orientation = itemBoxes.length > 1 && Math.abs(itemBoxes[0].top - itemBoxes[1].top) <= 8 ? "horizontal" : "vertical";
      return {
        identity: identity(menu, index),
        orientation,
        rect: menuBox,
        itemCount: items.length,
        items: items.map((item, itemIndex) => ({
          identity: identity(item, itemIndex),
          rect: itemBoxes[itemIndex],
          selected: item.getAttribute("aria-current") || item.getAttribute("aria-selected") || item.getAttribute("aria-pressed") || "",
          keyHint: item.getAttribute("data-key") || item.getAttribute("data-hotkey") || item.querySelector("[data-keycap]")?.getAttribute("data-keycap") || "",
        })),
      };
    });

    const majorSections = [...root.children].filter(visible).slice(0, 30).map((node, index) => ({
      identity: identity(node, index),
      role: role(node),
      rect: rect(node),
    }));

    const media = [...root.querySelectorAll("img,video")].filter(visible).map((node, index) => {
      if (node instanceof HTMLImageElement) {
        return {
          identity: identity(node, index),
          kind: "img",
          broken: node.complete && node.naturalWidth === 0,
          detail: node.complete && node.naturalWidth === 0 ? "image failed to load" : "",
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
    for (const token of colorTokenValues) {
      const probe = document.createElement("span");
      probe.style.color = `var(${token})`;
      probe.style.display = "none";
      document.body.appendChild(probe);
      resolvedColors[token] = getComputedStyle(probe).color;
      probe.remove();
    }

    const documentElement = document.documentElement;
    const body = document.body;
    const documentWidth = Math.max(documentElement.scrollWidth, body?.scrollWidth || 0);
    const documentHeight = Math.max(documentElement.scrollHeight, body?.scrollHeight || 0);

    return {
      surfaceId: surfaceIdValue,
      surface: surfaceNameValue,
      root: presentation(root),
      resolvedColors,
      tokens: Object.fromEntries([...colorTokenValues, ...contractTokenValues].map((name) => [name, html.getPropertyValue(name).trim()])),
      layout: {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        documentWidth,
        documentHeight,
        scrollHeight: documentHeight,
        horizontalOverflowPx: Math.max(0, documentWidth - window.innerWidth),
        largestVerticalGap,
        shellLandmarks,
      },
      geometry: {
        rootRect: rootBox,
        rootOverflow,
        siblingOverlaps,
        shellColumns,
        columnContainers: columnContainers.slice(0, 12),
        menus,
        majorSections,
        footerCount: [...root.querySelectorAll("footer,[data-skin-role='footer'],.pp-skin-v1-status")].filter(visible).length,
      },
      media: {
        total: media.length,
        broken: media.filter((item) => item.broken),
      },
      items: nodes.map((node, index) => ({
        role: role(node),
        identity: identity(node, index),
        presentation: presentation(node),
      })),
    };
  }, {
    surfaceIdValue: surfaceId,
    surfaceNameValue: surfaceName,
    rootSelectorValue: rootSelector,
    colorTokenValues: colorTokens || [],
    contractTokenValues: contractTokens || [],
  });
}

export async function writeRenderedGeometryEvidence({
  page,
  surfaceId,
  evidenceStem,
  profile,
  declaration,
  findings,
  artifactRoot = SKIN_V1_GEOMETRY_ARTIFACT_ROOT,
} = {}) {
  const root = path.resolve(artifactRoot);
  await mkdir(root, { recursive: true });
  const stem = evidenceStem || surfaceId;
  const jsonPath = path.join(root, `${stem}__geometry.json`);
  const screenshotPath = path.join(root, `${stem}__geometry.png`);
  const payload = {
    schemaVersion: 1,
    issue: 2270,
    authority: "visual-director-rendered-profile",
    surfaceId,
    evidenceStem: stem,
    declaration: declaration ? {
      formatProfile: declaration.formatProfile,
      returnAction: declaration.returnAction,
      regions: declaration.regions,
      footer: declaration.footer,
    } : null,
    viewport: {
      width: profile?.layout?.viewportWidth || null,
      height: profile?.layout?.viewportHeight || null,
    },
    geometry: profile?.geometry || {},
    layout: profile?.layout || {},
    findings: findings || [],
    screenshot: `${artifactRoot.replaceAll("\\", "/")}/${stem}__geometry.png`,
  };
  await writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  if (page) await page.screenshot({ path: screenshotPath, fullPage: false });
  return {
    json: `${artifactRoot.replaceAll("\\", "/")}/${stem}__geometry.json`,
    screenshot: payload.screenshot,
  };
}

export async function writeRenderedGeometrySummary({
  profiles,
  findingsBySurface,
  evidenceBySurface,
  artifactRoot = SKIN_V1_GEOMETRY_ARTIFACT_ROOT,
} = {}) {
  const root = path.resolve(artifactRoot);
  await mkdir(root, { recursive: true });
  const surfaceIds = Object.keys(profiles || {});
  const summary = {
    schemaVersion: 1,
    issue: 2270,
    surfaces: surfaceIds.length,
    blockers: Object.values(findingsBySurface || {}).flat().filter((item) => item.severity === "blocker").length,
    advisories: Object.values(findingsBySurface || {}).flat().filter((item) => item.severity === "advisory").length,
    entries: Object.fromEntries(surfaceIds.map((surfaceId) => [surfaceId, {
      layout: profiles[surfaceId]?.layout || {},
      shellColumns: profiles[surfaceId]?.geometry?.shellColumns || null,
      menuCount: profiles[surfaceId]?.geometry?.menus?.length || 0,
      majorSectionCount: profiles[surfaceId]?.geometry?.majorSections?.length || 0,
      findings: findingsBySurface?.[surfaceId] || [],
      evidence: evidenceBySurface?.[surfaceId] || null,
    }])),
  };
  const markdown = [
    "# Skin V1 Rendered Geometry Report",
    "",
    "Generated from the existing Visual Director rendered-profile path. This is diagnostic evidence, not a new visual authority.",
    "",
    "| Surface | Viewport | Document | Columns | Menus | Sections | Blockers | Advisories |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...surfaceIds.map((surfaceId) => {
      const profile = profiles[surfaceId];
      const findings = findingsBySurface?.[surfaceId] || [];
      const viewport = `${profile?.layout?.viewportWidth || "?"}×${profile?.layout?.viewportHeight || "?"}`;
      const documentSize = `${profile?.layout?.documentWidth || "?"}×${profile?.layout?.documentHeight || "?"}`;
      return `| ${surfaceId} | ${viewport} | ${documentSize} | ${profile?.geometry?.shellColumns?.count || "—"} | ${profile?.geometry?.menus?.length || 0} | ${profile?.geometry?.majorSections?.length || 0} | ${findings.filter((item) => item.severity === "blocker").length} | ${findings.filter((item) => item.severity === "advisory").length} |`;
    }),
    "",
  ].join("\n");
  await writeFile(path.join(root, "surface-contract-report.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(path.join(root, "surface-contract-report.md"), markdown, "utf8");
  return summary;
}
