import { extractPageState, resultText as defaultResultText } from "./creative-uat/mcp-runtime.mjs";

const severityRank = { low: 1, medium: 2, high: 3 };

function finding(kind, severity, summary, expectation, impact) {
  return { kind, severity, actionable: severityRank[severity] >= severityRank.medium, summary, expectation, impact };
}

function parseMaybeJson(value) {
  let current = String(value || "").trim();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (!current) break;
    try {
      const parsed = JSON.parse(current);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
      if (typeof parsed === "string") { current = parsed.trim(); continue; }
    } catch {}
    break;
  }
  return null;
}

export function parseRenderedEvaluateText(rawText) {
  const raw = String(rawText || "").trim();
  const marker = "### Result";
  const markerIndex = raw.indexOf(marker);
  const section = markerIndex >= 0
    ? raw.slice(markerIndex + marker.length).split(/\r?\n###\s/)[0].trim()
    : raw;

  for (const candidate of [section, raw]) {
    const direct = parseMaybeJson(candidate);
    if (direct) return direct;
    const extracted = extractPageState(candidate);
    if (extracted && typeof extracted === "object" && Object.keys(extracted).length) return extracted;
  }
  return { error: "Visual observer returned no parseable rendered JSON snapshot." };
}

export async function observeRenderedUi(client, textExtractor = defaultResultText) {
  const result = await client.call("browser_evaluate", { function: `() => {
    const hiddenByClosedDetails = (node) => {
      const details = node?.closest?.('details:not([open])');
      if (!details) return false;
      const summary = details.querySelector(':scope > summary');
      return !summary || (node !== summary && !summary.contains(node));
    };
    const visible = (node) => {
      if (!node || !(node instanceof Element) || hiddenByClosedDetails(node)) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.02 && rect.width > 1 && rect.height > 1;
    };
    const rect = (node) => {
      const box = node?.getBoundingClientRect();
      return box ? { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height), right: Math.round(box.right), bottom: Math.round(box.bottom) } : null;
    };
    const label = (node) => {
      const raw = node?.getAttribute?.('aria-label') || node?.textContent || node?.getAttribute?.('placeholder') || node?.getAttribute?.('title') || '';
      const clean = String(raw).replace(/\\s+/g, ' ').trim().slice(0, 90);
      if (clean) return clean;
      const tag = node?.tagName?.toLowerCase?.() || 'control';
      const type = node?.getAttribute?.('type');
      return type ? '<' + tag + ' type="' + type + '">' : '<' + tag + '>';
    };
    const rgba = (value) => {
      const match = String(value || '').match(/rgba?\\((\\d+(?:\\.\\d+)?),\\s*(\\d+(?:\\.\\d+)?),\\s*(\\d+(?:\\.\\d+)?)(?:,\\s*(\\d+(?:\\.\\d+)?))?/i);
      return match ? { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: match[4] === undefined ? 1 : Number(match[4]) } : null;
    };
    const luminance = (colour) => colour ? (0.2126 * colour.r + 0.7152 * colour.g + 0.0722 * colour.b) / 255 : 0;
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const body = document.body;
    const horizontallyScrollable = (node) => {
      let parent = node?.parentElement;
      while (parent && parent !== body) {
        const style = getComputedStyle(parent);
        if ((style.overflowX === 'auto' || style.overflowX === 'scroll') && parent.scrollWidth > parent.clientWidth + 2) return true;
        parent = parent.parentElement;
      }
      return false;
    };
    const main = document.querySelector('main, [role="main"], .workspace');
    const mainRect = rect(main);
    const bodyStyle = getComputedStyle(body);
    const lightSurfaces = [];
    for (const node of [...document.querySelectorAll('main *, body > *')]) {
      if (!visible(node) || node.matches('img, video, canvas, svg, path')) continue;
      const box = node.getBoundingClientRect();
      if (box.width * box.height < 10000) continue;
      const style = getComputedStyle(node);
      const colour = rgba(style.backgroundColor);
      if (!colour || colour.a < 0.7 || luminance(colour) < 0.62) continue;
      lightSurfaces.push({ tag: node.tagName.toLowerCase(), label: label(node), background: style.backgroundColor, rect: rect(node) });
      if (lightSurfaces.length >= 8) break;
    }
    const controls = [...document.querySelectorAll('button, a, input, textarea, select, summary, [role="button"], [role="tab"]')]
      .filter((node) => visible(node) && getComputedStyle(node).pointerEvents !== 'none' && !node.matches(':disabled'));
    const clippedControls = controls
      .filter((node) => {
        const box = node.getBoundingClientRect();
        return (box.x < -2 || box.right > viewport.width + 2) && !horizontallyScrollable(node);
      })
      .map((node) => ({ label: label(node), rect: rect(node) }));
    const overlaps = [];
    for (let i = 0; i < controls.length && overlaps.length < 8; i += 1) {
      const a = controls[i].getBoundingClientRect();
      const areaA = Math.max(1, a.width * a.height);
      for (let j = i + 1; j < controls.length && overlaps.length < 8; j += 1) {
        if (controls[i].contains(controls[j]) || controls[j].contains(controls[i])) continue;
        const b = controls[j].getBoundingClientRect();
        const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (width <= 8 || height <= 8) continue;
        const overlapArea = width * height;
        const areaB = Math.max(1, b.width * b.height);
        const ratio = overlapArea / Math.min(areaA, areaB);
        if (ratio < 0.08) continue;
        overlaps.push({
          first: label(controls[i]),
          second: label(controls[j]),
          width: Math.round(width),
          height: Math.round(height),
          overlapRatio: Math.round(ratio * 100),
        });
      }
    }
    const majorRegions = [...document.querySelectorAll('main > section, main > article, main > aside, main > nav, main > details')]
      .filter(visible).slice(0, 12).map((node) => ({ tag: node.tagName.toLowerCase(), label: label(node), rect: rect(node) }));
    const leftGap = mainRect ? Math.max(0, mainRect.x) : 0;
    const rightGap = mainRect ? Math.max(0, viewport.width - mainRect.right) : 0;
    const payload = {
      url: location.href,
      title: document.title,
      theme: document.documentElement.dataset.plotpickleTheme || '',
      viewport,
      body: { background: bodyStyle.backgroundColor, color: bodyStyle.color, fontFamily: bodyStyle.fontFamily, scrollWidth: body.scrollWidth, clientWidth: body.clientWidth },
      main: mainRect ? { rect: mainRect, centerOffset: Math.round((mainRect.x + mainRect.width / 2) - viewport.width / 2), leftGap: Math.round(leftGap), rightGap: Math.round(rightGap), gapImbalance: Math.round(Math.abs(leftGap - rightGap)) } : null,
      horizontalOverflow: Math.max(0, body.scrollWidth - viewport.width),
      lightSurfaces,
      clippedControls: clippedControls.slice(0, 8),
      overlaps,
      majorRegions
    };
    return JSON.stringify(payload);
  }` });
  return parseRenderedEvaluateText(textExtractor(result));
}

export function reviewRenderedUi(label, facts) {
  const findings = [];
  if (!facts || facts.error) {
    findings.push(finding("friction", "medium", `${label}: visual review could not read the rendered screen.`, "A rendered product screen should be reviewable for visible layout quality.", facts?.error || "No rendered facts were available."));
    return findings;
  }
  if (facts.theme !== "dark") findings.push(finding("need", "high", `${label}: the screen is not using PlotPickle's current dark visual theme.`, "Active PlotPickle surfaces should share the current matte-black visual system.", "The screen can feel like a different or older product."));
  if ((facts.lightSurfaces || []).length) {
    const sample = facts.lightSurfaces.slice(0, 2).map((item) => `${item.tag} ${item.background}`).join(", ");
    findings.push(finding("need", "medium", `${label}: large light-coloured surfaces remain inside the current dark PlotPickle experience (${sample}).`, "Active and nested screens should visually belong to the same matte-black / teal / orange product family.", "A writer may think they have fallen into an older settings or utility screen."));
  }
  if (Number(facts.horizontalOverflow || 0) > 8) findings.push(finding("friction", "high", `${label}: the rendered page overflows the viewport horizontally by ${facts.horizontalOverflow}px.`, "The main workflow should fit the available window without sideways page scrolling.", "Controls or content can be missed and the layout feels unfinished."));
  if ((facts.clippedControls || []).length) {
    const sample = facts.clippedControls.slice(0, 3).map((item) => item.label || "unnamed control").join(", ");
    findings.push(finding("bug", "high", `${label}: visible controls are clipped outside the viewport (${sample}).`, "Visible controls should remain fully reachable in the active window.", "A writer may be unable to understand or use the navigation."));
  }
  if ((facts.overlaps || []).length) {
    const sample = facts.overlaps[0];
    findings.push(finding("bug", "high", `${label}: visible controls overlap (${sample.first} / ${sample.second}; ${sample.width}×${sample.height}px, ${sample.overlapRatio}% of the smaller hit area).`, "Interactive controls should have clear, non-overlapping hit areas.", "Navigation becomes ambiguous and visually broken."));
  }
  const main = facts.main;
  if (main && main.rect?.width < facts.viewport.width * 0.94 && main.gapImbalance > 48) findings.push(finding("friction", "medium", `${label}: the primary content area is visibly off-balance by about ${main.gapImbalance}px between left and right margins.`, "A deliberately constrained layout should still feel visually balanced unless the asymmetry serves a clear workflow purpose.", "The screen can feel accidentally shifted rather than intentionally composed."));
  return findings;
}

export function visualFactsForWriter(facts) {
  if (!facts || facts.error) return `Visual observer: ${facts?.error || "unavailable"}`;
  return [
    `theme=${facts.theme || "unknown"}`,
    `horizontalOverflow=${facts.horizontalOverflow || 0}px`,
    `largeLightSurfaces=${facts.lightSurfaces?.length || 0}`,
    `clippedControls=${facts.clippedControls?.length || 0}`,
    `overlappingControls=${facts.overlaps?.length || 0}`,
    `mainMarginImbalance=${facts.main?.gapImbalance ?? 0}px`,
  ].join(", ");
}