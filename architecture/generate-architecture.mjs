import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SOURCE_PATH = path.join(HERE, "plotpickle.architecture.json");
const SKIN_PATH = path.join(HERE, "architecture-skin.css");
const FULL_SVG_PATH = path.join(HERE, "plotpickle-architecture.svg");
const OVERVIEW_SVG_PATH = path.join(HERE, "plotpickle-architecture-overview.svg");
const README_PATH = path.join(ROOT, "README.md");
const START = "<!-- PLOTPICKLE:ARCHITECTURE:START -->";
const END = "<!-- PLOTPICKLE:ARCHITECTURE:END -->";
const CHECK = process.argv.includes("--check");
const esc = (v = "") => String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

function wrap(text, max) {
  const out = [];
  let line = "";
  for (const word of String(text ?? "").split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && next.length > max) { out.push(line); line = word; } else line = next;
  }
  if (line) out.push(line);
  return out;
}

function textLines(text, x, y, cls, max = 42, gap = 15, limit = 3, anchor = "start") {
  return wrap(text, max).slice(0, limit).map((t, i) => `<text x="${x}" y="${y + i * gap}" class="${cls}" text-anchor="${anchor}">${esc(t)}</text>`).join("\n");
}

function validate(a) {
  const ids = new Set();
  a.layers.forEach((layer, i) => {
    if (layer.number !== i + 1) throw new Error(`Layer numbering must be contiguous at ${layer.id}.`);
    if (ids.has(layer.id) || !layer.components?.length) throw new Error(`Invalid layer ${layer.id}.`);
    ids.add(layer.id);
    for (const component of layer.components) {
      if (!component.title || !component.detail) throw new Error(`Layer ${layer.id} has an incomplete component.`);
    }
  });
  for (const flow of a.flows) {
    const known = (id) => ids.has(id) || id === "community" || id === "bridge";
    if (!known(flow.from) || !known(flow.to)) throw new Error(`Unknown flow boundary ${flow.from} -> ${flow.to}.`);
  }
}

function cssForSvg(skin) {
  const root = skin.match(/:root\s*\{([\s\S]*?)\}/);
  const vars = new Map();
  if (root) {
    for (const match of root[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) vars.set(match[1], match[2].trim());
  }
  let css = skin.replace(/:root\s*\{[\s\S]*?\}\s*/, "");
  for (const [name, value] of vars) css = css.replaceAll(`var(${name})`, value);
  return css;
}

function layerHeight(layer) {
  const rows = Math.ceil(layer.components.length / 5);
  return 46 + rows * 58 + 24;
}

function renderFullSvg(a, skin) {
  const W = 2400;
  const railX = 62;
  const labelX = 108;
  const mainX = 300;
  const mainW = 1320;
  const sideX = 1680;
  const sideW = 680;
  const top = 118;
  const gap = 12;
  const pad = 18;
  const colGap = 12;
  const columns = 5;
  const compW = (mainW - pad * 2 - colGap * (columns - 1)) / columns;
  const compH = 50;
  const positions = new Map();
  let y = top;

  const layerSvg = a.layers.map((layer) => {
    const h = layerHeight(layer);
    positions.set(layer.id, { top: y, bottom: y + h, center: y + h / 2 });
    const tone = layer.tone;
    const components = layer.components.map((c, i) => {
      const row = Math.floor(i / columns);
      const col = i % columns;
      const cx = mainX + pad + col * (compW + colGap);
      const cy = y + 42 + row * 58;
      const emphasis = c.emphasis ? " emphasis" : "";
      const stroke = c.emphasis ? "" : ` ${tone}-stroke`;
      return `<g class="architecture-component" data-component="${esc(c.title)}">
<rect x="${cx}" y="${cy}" width="${compW}" height="${compH}" rx="4" class="component${stroke}${emphasis}"/>
${textLines(c.title, cx + 14, cy + 18, c.emphasis ? "component-title green" : "component-title", 26, 13, 2)}
${textLines(c.detail, cx + 14, cy + 36, "component-detail", 31, 12, 2)}
</g>`;
    }).join("\n");

    const footerY = y + h - 10;
    const out = `<g id="layer-${esc(layer.id)}" data-layer="${layer.number}">
<line x1="${railX}" y1="${y - gap}" x2="${railX}" y2="${y + h + gap}" class="cyan" opacity=".22"/>
<path d="M${railX} ${y + 28} l18 10 v24 l-18 10 l-18-10 v-24 z" fill="none" class="${tone}" stroke-width="2"/>
<text x="${railX}" y="${y + 51}" class="number ${tone}">${layer.number}</text>
${textLines(layer.label, labelX, y + 24, `layer-label ${tone}`, 22, 19, 3)}
${textLines(layer.summary, labelX, y + 88, "layer-summary", 26, 15, 4)}
<rect x="${mainX}" y="${y}" width="${mainW}" height="${h}" rx="10" class="panel ${tone}-stroke"/>
<path d="M${mainX} ${y + 16} h96" class="${tone}" fill="none" stroke-width="2"/>
<text x="${mainX + 18}" y="${y + 32}" class="panel-title ${tone}">${esc(layer.title)}</text>
${layer.note ? `<text x="${mainX + mainW - 18}" y="${y + 31}" class="note" text-anchor="end">${esc(layer.note)}</text>` : ""}
${components}
<text x="${mainX + 18}" y="${footerY}" class="footer">${esc(layer.footer ?? "")}</text>
</g>`;
    y += h + gap;
    return out;
  }).join("\n");

  const H = Math.max(1380, y + 58);
  const principles = a.principles.map((p, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = sideX + 24 + col * 320;
    const py = 192 + row * 54;
    return `<text x="${x}" y="${py}" class="component-title">${esc(p.title)}</text><text x="${x}" y="${py + 17}" class="component-detail">${esc(p.detail)}</text>`;
  }).join("\n");

  const communityStart = 304;
  const communityComponents = a.community.components.map((c, i) => {
    const cy = communityStart + 68 + i * 88;
    return `<g data-community-component="${esc(c.title)}"><rect x="${sideX + 22}" y="${cy}" width="${sideW - 44}" height="72" rx="4" class="component purple-stroke"/>
${textLines(c.title, sideX + 40, cy + 22, "component-title", 58, 14, 2)}
${textLines(c.detail, sideX + 40, cy + 43, "component-detail", 78, 12, 2)}</g>`;
  }).join("\n");

  const communityRulesY = communityStart + 68 + a.community.components.length * 88 + 8;
  const communityRules = a.community.rules.map((r, i) => `<text x="${sideX + 26}" y="${communityRulesY + i * 18}" class="${i === a.community.rules.length - 1 ? "micro purple" : "footer"}">${esc(r)}</text>`).join("\n");
  const communityH = 68 + a.community.components.length * 88 + a.community.rules.length * 18 + 30;

  const bridgeY = communityStart + communityH + 20;
  const bridgeSteps = a.bridge.steps.map((s, i) => {
    const by = bridgeY + 54 + i * 48;
    return `<rect x="${sideX + 22}" y="${by}" width="${sideW - 44}" height="36" rx="3" class="component purple-stroke"/><text x="${sideX + 38}" y="${by + 23}" class="component-title">${i + 1} ${esc(s)}</text>${i < a.bridge.steps.length - 1 ? `<path d="M${sideX + sideW / 2} ${by + 36} v10" class="flow purple-stroke dashed"/>` : ""}`;
  }).join("\n");
  const bridgeH = 54 + a.bridge.steps.length * 48 + 36;

  const legendY = bridgeY + bridgeH + 20;
  const legendLines = a.legend.map((l, i) => `<text x="${sideX + 28}" y="${legendY + 58 + i * 24}" class="footer ${l.tone}">${l.advisory ? "⋯⋯→" : "────→"} ${esc(l.label)}</text>`).join("\n");

  const verticalFlows = a.flows.filter((f) => positions.has(f.from) && positions.has(f.to));
  const flowSvg = verticalFlows.map((flow) => {
    const from = positions.get(flow.from);
    const to = positions.get(flow.to);
    if (!from || !to) return "";
    const x = mainX + 232;
    const cls = `flow ${flow.tone === "amber" ? "amber-stroke" : flow.tone === "purple" ? "purple-stroke" : ""}${flow.advisory ? " dashed" : ""}`;
    const y1 = from.bottom;
    const y2 = to.top;
    return `<path d="M${x} ${y1} V${y2 - 5}" class="${cls}"/><text x="${x + 14}" y="${(y1 + y2) / 2 + 4}" class="micro ${flow.tone}">${esc(flow.label)}</text>`;
  }).join("\n");

  const harness = positions.get("production-harness");
  const story = positions.get("story-canon");
  const bridgeMidY = bridgeY + bridgeH / 2;
  const sideFlows = [
    harness ? `<path d="M${mainX + mainW} ${harness.center - 16} H${sideX - 8}" class="flow amber-stroke"/><text x="${mainX + mainW + 20}" y="${harness.center - 25}" class="micro amber">CALLS</text>` : "",
    harness ? `<path d="M${sideX - 8} ${harness.center + 16} H${mainX + mainW}" class="flow"/><text x="${mainX + mainW + 20}" y="${harness.center + 40}" class="micro cyan">EVENTS</text>` : "",
    `<path d="M${sideX + sideW / 2} ${communityStart + communityH} V${bridgeY - 8}" class="flow purple-stroke dashed"/><text x="${sideX + sideW / 2 + 14}" y="${bridgeY - 18}" class="micro purple">Selected material</text>`,
    story ? `<path d="M${sideX} ${bridgeMidY} H${mainX + mainW + 72} V${story.center} H${mainX + mainW}" class="flow purple-stroke dashed"/><text x="${mainX + mainW + 85}" y="${story.center - 10}" class="micro purple">Candidate</text>` : ""
  ].join("\n");

  const css = cssForSvg(skin);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc" data-projection="full-blueprint">
<title id="title">${esc(a.blueprint.title)} full architecture blueprint</title><desc id="desc">Detailed engineering blueprint generated from ${esc(a.blueprint.source)}.</desc>
<style>${css}</style>
<defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" class="grid" fill="none"/></pattern><marker id="arrow-cyan" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9Z" fill="#58d7e7"/></marker><marker id="arrow-amber" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9Z" fill="#f0b82f"/></marker><marker id="arrow-purple" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9Z" fill="#bc83e8"/></marker></defs>
<rect width="${W}" height="${H}" class="bg"/><rect width="${W}" height="${H}" fill="url(#grid)" opacity=".18"/>
<text x="300" y="52" class="title">${esc(a.blueprint.title)}</text><text x="570" y="52" class="tagline">${esc(a.blueprint.tagline)}</text><text x="300" y="82" class="subtitle">${esc(a.blueprint.subtitle)}</text><text x="2360" y="36" class="micro cyan" text-anchor="end">ARCHITECTURE BLUEPRINT v${esc(a.blueprint.version)}</text><text x="2360" y="58" class="note" text-anchor="end">${esc(a.blueprint.updated)} · ${esc(a.blueprint.status)}</text><line x1="300" y1="98" x2="2360" y2="98" class="cyan" opacity=".55"/>
${flowSvg}
${sideFlows}
${layerSvg}
<rect x="${sideX}" y="132" width="${sideW}" height="170" rx="10" class="panel cyan-stroke"/><text x="${sideX + 22}" y="162" class="panel-title cyan">CORE PRINCIPLES</text>${principles}
<rect x="${sideX}" y="${communityStart}" width="${sideW}" height="${communityH}" rx="10" class="panel purple-stroke"/><text x="${sideX + 22}" y="${communityStart + 32}" class="panel-title purple">${esc(a.community.title)}</text><text x="${sideX + 22}" y="${communityStart + 53}" class="note">${esc(a.community.summary)}</text>${communityComponents}${communityRules}
<rect x="${sideX}" y="${bridgeY}" width="${sideW}" height="${bridgeH}" rx="10" class="panel purple-stroke dashed"/><text x="${sideX + 22}" y="${bridgeY + 32}" class="panel-title purple">${esc(a.bridge.title)}</text><text x="${sideX + sideW - 22}" y="${bridgeY + 32}" class="micro purple" text-anchor="end">${esc(a.bridge.status)}</text>${bridgeSteps}<text x="${sideX + 22}" y="${bridgeY + bridgeH - 16}" class="footer purple">${esc(a.bridge.footer)}</text>
<rect x="${sideX}" y="${legendY}" width="${sideW}" height="150" rx="10" class="panel cyan-stroke"/><text x="${sideX + 22}" y="${legendY + 32}" class="panel-title cyan">READING THE DIAGRAM</text>${legendLines}<text x="${sideX + 28}" y="${legendY + 132}" class="footer">Bands show responsibilities, not a sequential execution chain.</text>
<text x="300" y="${H - 34}" class="micro amber">MIGRATION STATUS</text>${textLines(a.migration, 438, H - 34, "footer", 145, 14, 2)}<text x="2360" y="${H - 18}" class="micro cyan" text-anchor="end">SOURCE: ${esc(a.blueprint.source)}</text>
</svg>\n`;
}

function renderOverviewSvg(a, skin) {
  const W = 1200, H = 720;
  const railX = 42, labelX = 74, mainX = 210, mainW = 610, sideX = 850, sideW = 320;
  const rowH = 72, gap = 10, top = 94;
  const css = cssForSvg(skin);
  const layers = a.layers.map((layer, i) => {
    const y = top + i * (rowH + gap);
    return `<g data-overview-layer="${layer.number}"><path d="M${railX} ${y + 18} l12 7 v16 l-12 7 l-12-7 v-16 z" fill="none" class="${layer.tone}"/><text x="${railX}" y="${y + 34}" class="number ${layer.tone}" style="font-size:15px">${layer.number}</text><text x="${labelX}" y="${y + 22}" class="overview-layer ${layer.tone}">${esc(layer.label)}</text>${textLines(layer.summary, labelX, y + 40, "overview-summary", 24, 11, 2)}<rect x="${mainX}" y="${y}" width="${mainW}" height="${rowH}" rx="7" class="panel ${layer.tone}-stroke"/><text x="${mainX + 16}" y="${y + 27}" class="panel-title ${layer.tone}" style="font-size:14px">${esc(layer.title)}</text><text x="${mainX + 16}" y="${y + 50}" class="overview-summary">${esc(layer.components.map((c) => c.title).slice(0, 5).join(" · "))}${layer.components.length > 5 ? " · …" : ""}</text></g>`;
  }).join("\n");
  const sidePrinciples = a.principles.map((p, i) => `<text x="${sideX + 18}" y="${144 + i * 25}" class="overview-layer" style="font-size:10px">${esc(p.title)} <tspan class="overview-summary">— ${esc(p.detail)}</tspan></text>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc" data-projection="readme-overview">
<title id="title">${esc(a.blueprint.title)} architecture overview</title><desc id="desc">Compact README overview generated from ${esc(a.blueprint.source)}. Open the full blueprint for engineering detail.</desc>
<style>${css}</style><defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" class="grid" fill="none"/></pattern></defs>
<rect width="${W}" height="${H}" class="bg"/><rect width="${W}" height="${H}" fill="url(#grid)" opacity=".14"/>
<text x="210" y="42" class="overview-title">${esc(a.blueprint.title)}</text><text x="390" y="42" class="overview-tagline">${esc(a.blueprint.tagline)}</text><text x="210" y="66" class="subtitle">ARCHITECTURE OVERVIEW · FULL BLUEPRINT AVAILABLE</text>
${layers}
<rect x="${sideX}" y="94" width="${sideW}" height="210" rx="8" class="panel cyan-stroke"/><text x="${sideX + 18}" y="122" class="panel-title cyan" style="font-size:14px">CORE PRINCIPLES</text>${sidePrinciples}
<rect x="${sideX}" y="326" width="${sideW}" height="138" rx="8" class="panel purple-stroke"/><text x="${sideX + 18}" y="354" class="panel-title purple" style="font-size:14px">BUZZ / COMMUNITY</text>${textLines(a.community.summary, sideX + 18, 380, "overview-summary", 45, 13, 3)}<text x="${sideX + 18}" y="440" class="micro purple">NO DIRECT CANON AUTHORITY</text>
<rect x="${sideX}" y="486" width="${sideW}" height="118" rx="8" class="panel purple-stroke dashed"/><text x="${sideX + 18}" y="514" class="panel-title purple" style="font-size:14px">BRING INTO STORY</text>${a.bridge.steps.map((s,i)=>`<text x="${sideX + 18}" y="${540+i*20}" class="overview-summary">${i+1}. ${esc(s)}</text>`).join("")}
<text x="${sideX + 18}" y="650" class="micro cyan">OPEN FULL SVG FOR COMPONENT + FLOW DETAIL</text><text x="1170" y="694" class="micro cyan" text-anchor="end">SOURCE: ${esc(a.blueprint.source)}</text>
</svg>\n`;
}

function readmeSection(a) {
  const rows = a.layers.map((l) => `| ${l.number} | ${l.label.replaceAll("|", "\\|")} | ${l.summary.replaceAll("|", "\\|")} |`).join("\n");
  return `${START}\n## ARCHITECTURE\n\nPlotPickle's architecture is generated from one machine-readable source: [\`architecture/plotpickle.architecture.json\`](architecture/plotpickle.architecture.json). The application Skins do not own this documentation style; architecture diagrams use their own dedicated Architecture Skin.\n\nThe README intentionally shows a compact overview. **[Open the full-resolution Architecture Blueprint](architecture/plotpickle-architecture.svg)** for component-level detail, authority boundaries and flows.\n\n<p align="center">\n  <img src="architecture/plotpickle-architecture-overview.svg" alt="PlotPickle architecture overview" width="1200">\n</p>\n\n| Layer | Boundary | Responsibility |\n|---:|---|---|\n${rows}\n\nBUZZ is the first provider behind PlotPickle-owned Community contracts. Community material has no direct canon authority. The governed bridge remains: **Community material → Bring into Story → Candidate → Evidence / Revision → Human approval → PPF Canon**.\n\nTo regenerate both diagrams and this managed section after an architecture change, run \`node architecture/generate-architecture.mjs\`. CI runs \`node architecture/generate-architecture.mjs --check\` so the JSON source, full blueprint, README overview and managed README section cannot silently drift apart.\n${END}`;
}

function withSection(readme, section) {
  if (readme.includes(START) && readme.includes(END)) return `${readme.slice(0, readme.indexOf(START))}${section}${readme.slice(readme.indexOf(END) + END.length)}`;
  const anchor = "\n## The default feature-film production model";
  if (!readme.includes(anchor)) throw new Error("README architecture insertion anchor not found.");
  return readme.replace(anchor, `\n${section}\n${anchor}`);
}

const architecture = JSON.parse(fs.readFileSync(SOURCE_PATH, "utf8"));
validate(architecture);
const skin = fs.readFileSync(SKIN_PATH, "utf8");
const fullSvg = renderFullSvg(architecture, skin);
const overviewSvg = renderOverviewSvg(architecture, skin);
const readme = fs.readFileSync(README_PATH, "utf8");
const nextReadme = withSection(readme, readmeSection(architecture));
if (CHECK) {
  const errors = [];
  if (!fs.existsSync(FULL_SVG_PATH) || fs.readFileSync(FULL_SVG_PATH, "utf8") !== fullSvg) errors.push("architecture/plotpickle-architecture.svg is stale");
  if (!fs.existsSync(OVERVIEW_SVG_PATH) || fs.readFileSync(OVERVIEW_SVG_PATH, "utf8") !== overviewSvg) errors.push("architecture/plotpickle-architecture-overview.svg is stale");
  if (readme !== nextReadme) errors.push("README.md ARCHITECTURE section is stale");
  if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; } else console.log("Architecture source, full blueprint, README overview and managed README section are synchronized.");
} else {
  fs.writeFileSync(FULL_SVG_PATH, fullSvg);
  fs.writeFileSync(OVERVIEW_SVG_PATH, overviewSvg);
  fs.writeFileSync(README_PATH, nextReadme);
  console.log("Generated full architecture blueprint, README overview and updated README.md ARCHITECTURE section.");
}
