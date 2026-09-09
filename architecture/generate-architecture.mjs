import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SOURCE_PATH = path.join(HERE, "plotpickle.architecture.json");
const SKIN_PATH = path.join(HERE, "architecture-skin.css");
const SVG_PATH = path.join(HERE, "plotpickle-architecture.svg");
const README_PATH = path.join(ROOT, "README.md");
const START = "<!-- PLOTPICKLE:ARCHITECTURE:START -->";
const END = "<!-- PLOTPICKLE:ARCHITECTURE:END -->";
const CHECK = process.argv.includes("--check");

const esc = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

function wrap(text, max = 34) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function textLines(lines, x, y, className, lineHeight = 10, attrs = "") {
  return lines.map((line, index) => `<text x="${x}" y="${y + index * lineHeight}" class="${className}" ${attrs}>${esc(line)}</text>`).join("\n");
}

function toneStroke(tone) {
  return `${tone}-stroke`;
}

function componentBoxes(layer, x, y, width, height) {
  const gap = 8;
  const cols = layer.components.length >= 7 ? 5 : layer.components.length;
  const rows = Math.ceil(layer.components.length / cols);
  const boxWidth = (width - gap * (cols - 1)) / cols;
  const boxHeight = Math.max(38, (height - gap * (rows - 1)) / rows);
  return layer.components.map((component, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const bx = x + col * (boxWidth + gap);
    const by = y + row * (boxHeight + gap);
    const klass = `component ${toneStroke(layer.tone)}${component.emphasis ? " emphasis" : ""}`;
    const title = wrap(component.title, 27).slice(0, 2);
    const detail = wrap(component.detail, 34).slice(0, 3);
    const titleY = by + 15;
    const detailY = titleY + title.length * 9 + 4;
    return [
      `<rect x="${bx}" y="${by}" width="${boxWidth}" height="${boxHeight}" rx="2" class="${klass}"/>`,
      textLines(title, bx + 10, titleY, "component-title", 9),
      textLines(detail, bx + 10, detailY, "component-detail", 8)
    ].join("\n");
  }).join("\n");
}

function panel(layer, x, y, width, height) {
  const headerY = y + 22;
  const componentY = y + 34;
  const footerReserve = layer.footer ? 24 : 8;
  return [
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="7" class="panel ${toneStroke(layer.tone)}"/>`,
    `<path d="M ${x + 10} ${y + 7} H ${x + 52}" class="${layer.tone}" fill="none" stroke-width="1.4"/>`,
    `<text x="${x + 10}" y="${headerY}" class="panel-title ${layer.tone}">${esc(layer.title)}</text>`,
    layer.note ? `<text x="${x + width - 10}" y="${headerY}" class="note" text-anchor="end">${esc(layer.note)}</text>` : "",
    componentBoxes(layer, x + 10, componentY, width - 20, height - (componentY - y) - footerReserve),
    layer.footer ? `<text x="${x + 10}" y="${y + height - 8}" class="footer">${esc(layer.footer)}</text>` : ""
  ].filter(Boolean).join("\n");
}

function layerRail(layer, x, y) {
  const tone = layer.tone;
  return [
    `<path d="M ${x + 14} ${y - 18} L ${x + 28} ${y - 10} L ${x + 28} ${y + 8} L ${x + 14} ${y + 16} L ${x} ${y + 8} L ${x} ${y - 10} Z" fill="none" class="${tone}" stroke-width="1.2"/>`,
    `<text x="${x + 14}" y="${y - 1}" class="number ${tone}">${layer.number}</text>`,
    textLines(wrap(layer.label, 20), x + 44, y - 8, `layer-label ${tone}`, 11),
    textLines(wrap(layer.summary, 25), x + 44, y + 22, "layer-summary", 9)
  ].join("\n");
}

function sideCommunity(architecture, x, y, width) {
  const c = architecture.community;
  let cursor = y + 36;
  const parts = [
    `<rect x="${x}" y="${y}" width="${width}" height="365" rx="7" class="panel purple-stroke"/>`,
    `<text x="${x + 12}" y="${y + 22}" class="panel-title purple">${esc(c.title)}</text>`,
    `<text x="${x + 12}" y="${y + 36}" class="note">${esc(c.summary)}</text>`
  ];
  for (const item of c.components) {
    const boxH = 57;
    parts.push(`<rect x="${x + 12}" y="${cursor}" width="${width - 24}" height="${boxH}" rx="2" class="component purple-stroke"/>`);
    parts.push(textLines(wrap(item.title, 38).slice(0, 2), x + 22, cursor + 15, "component-title", 9));
    parts.push(textLines(wrap(item.detail, 54).slice(0, 3), x + 22, cursor + 34, "component-detail", 8));
    cursor += boxH + 8;
  }
  cursor += 2;
  c.rules.forEach((rule, index) => {
    parts.push(`<text x="${x + 12}" y="${cursor + index * 13}" class="${index === c.rules.length - 1 ? "micro purple" : "footer"}">${esc(rule)}</text>`);
  });
  return parts.join("\n");
}

function sideBridge(architecture, x, y, width) {
  const b = architecture.bridge;
  const h = 160;
  const parts = [
    `<rect x="${x}" y="${y}" width="${width}" height="${h}" rx="7" class="panel purple-stroke dashed"/>`,
    `<text x="${x + 12}" y="${y + 22}" class="panel-title purple">${esc(b.title)}</text>`,
    `<text x="${x + width - 12}" y="${y + 22}" class="micro purple" text-anchor="end">${esc(b.status)}</text>`
  ];
  b.steps.forEach((step, index) => {
    const sy = y + 38 + index * 34;
    parts.push(`<rect x="${x + 12}" y="${sy}" width="${width - 24}" height="24" rx="2" class="component purple-stroke"/>`);
    parts.push(`<text x="${x + 20}" y="${sy + 16}" class="component-title">${index + 1} ${esc(step)}</text>`);
  });
  parts.push(`<text x="${x + 12}" y="${y + h - 10}" class="footer purple">${esc(b.footer)}</text>`);
  return parts.join("\n");
}

function principlesPanel(architecture, x, y, width) {
  const h = 112;
  const cols = 2;
  const itemW = width / cols;
  const parts = [
    `<rect x="${x}" y="${y}" width="${width}" height="${h}" rx="7" class="panel cyan-stroke"/>`,
    `<text x="${x + 12}" y="${y + 22}" class="panel-title cyan">CORE PRINCIPLES</text>`
  ];
  architecture.principles.forEach((p, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const px = x + 12 + col * itemW;
    const py = y + 43 + row * 22;
    parts.push(`<text x="${px}" y="${py}" class="component-title">${esc(p.title)}</text>`);
    parts.push(`<text x="${px}" y="${py + 9}" class="component-detail">${esc(p.detail)}</text>`);
  });
  return parts.join("\n");
}

function renderSvg(architecture, skin) {
  const width = 1500;
  const height = 980;
  const mainX = 180;
  const mainW = 845;
  const sideX = 1090;
  const sideW = 365;
  const top = 82;
  const layerHeights = [88, 170, 112, 82, 150, 84, 92];
  const gap = 16;
  const layerY = [];
  let y = top;
  for (const h of layerHeights) {
    layerY.push(y);
    y += h + gap;
  }

  const ids = new Map(architecture.layers.map((layer, index) => [layer.id, { y: layerY[index], h: layerHeights[index] }]));
  ids.set("community", { y: 210, h: 365 });
  ids.set("bridge", { y: 592, h: 160 });

  const css = skin.replace(/:root\s*\{([\s\S]*?)\}/, (_, vars) => `svg {${vars}}`);
  const layers = architecture.layers.map((layer, index) => [
    layerRail(layer, 24, layerY[index] + 36),
    panel(layer, mainX, layerY[index], mainW, layerHeights[index])
  ].join("\n")).join("\n");

  const mainFlowParts = [];
  for (let i = 0; i < architecture.layers.length - 1; i++) {
    const current = ids.get(architecture.layers[i].id);
    const next = ids.get(architecture.layers[i + 1].id);
    const cx = mainX + 145;
    mainFlowParts.push(`<path d="M ${cx} ${current.y + current.h} V ${next.y - 5}" class="flow amber-stroke"/>`);
  }

  const communityY = ids.get("community").y;
  const harness = ids.get("production-harness");
  const story = ids.get("story-canon");
  const bridge = ids.get("bridge");
  mainFlowParts.push(`<path d="M ${mainX + mainW} ${harness.y + 44} H ${sideX}" class="flow amber-stroke"/>`);
  mainFlowParts.push(`<path d="M ${sideX} ${harness.y + 66} H ${mainX + mainW}" class="flow"/>`);
  mainFlowParts.push(`<path d="M ${sideX + sideW / 2} ${communityY + 365} V ${bridge.y - 4}" class="flow purple-stroke dashed"/>`);
  mainFlowParts.push(`<path d="M ${sideX} ${bridge.y + 112} H ${mainX + mainW + 26} V ${story.y + 112} H ${mainX + mainW}" class="flow purple-stroke dashed"/>`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
<title id="title">${esc(architecture.blueprint.title)} architecture blueprint</title>
<desc id="desc">Generated from ${esc(architecture.blueprint.source)}. Seven PlotPickle architecture layers with BUZZ Community provider and Bring into Story bridge.</desc>
<style>${css}</style>
<defs>
  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" class="grid" fill="none"/></pattern>
  <marker id="arrow-cyan" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#58d7e7"/></marker>
  <marker id="arrow-amber" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#f0b82f"/></marker>
  <marker id="arrow-purple" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#bc83e8"/></marker>
</defs>
<rect width="${width}" height="${height}" class="bg"/>
<rect width="${width}" height="${height}" fill="url(#grid)" opacity="0.22"/>
<text x="180" y="36" class="title">${esc(architecture.blueprint.title)}</text>
<text x="385" y="36" class="tagline">${esc(architecture.blueprint.tagline)}</text>
<text x="180" y="58" class="subtitle">${esc(architecture.blueprint.subtitle)}</text>
<text x="1450" y="26" class="micro cyan" text-anchor="end">ARCHITECTURE BLUEPRINT v${esc(architecture.blueprint.version)}</text>
<text x="1450" y="46" class="note" text-anchor="end">${esc(architecture.blueprint.updated)} · ${esc(architecture.blueprint.status)}</text>
<line x1="180" y1="68" x2="1450" y2="68" class="cyan" stroke-width="0.7" opacity="0.6"/>
${layers}
${mainFlowParts.join("\n")}
${principlesPanel(architecture, sideX, 82, sideW)}
${sideCommunity(architecture, sideX, 210, sideW)}
${sideBridge(architecture, sideX, 592, sideW)}
<rect x="1090" y="770" width="365" height="108" rx="7" class="panel cyan-stroke"/>
<text x="1102" y="792" class="panel-title cyan">READING THE DIAGRAM</text>
${architecture.legend.map((item, index) => `<text x="1102" y="${814 + index * 18}" class="footer ${item.tone}">${item.advisory ? "⋯⋯→" : "────→"} ${esc(item.label)}</text>`).join("\n")}
<text x="180" y="948" class="micro amber">MIGRATION STATUS</text>
<text x="275" y="948" class="footer">${esc(architecture.migration)}</text>
<text x="1450" y="964" class="micro cyan" text-anchor="end">SOURCE: ${esc(architecture.blueprint.source)}</text>
</svg>\n`;
}

function renderReadmeSection(architecture) {
  const layerRows = architecture.layers.map((layer) => `| ${layer.number} | ${layer.label.replaceAll("|", "\\|")} | ${layer.summary.replaceAll("|", "\\|")} |`).join("\n");
  return `${START}
## ARCHITECTURE

PlotPickle's architecture blueprint is generated from one machine-readable source: [\`architecture/plotpickle.architecture.json\`](architecture/plotpickle.architecture.json). The application Skins do not own this documentation style; architecture diagrams use their own dedicated Architecture Skin.

<p align="center">
  <img src="architecture/plotpickle-architecture.svg" alt="PlotPickle target architecture blueprint" width="1200">
</p>

| Layer | Boundary | Responsibility |
|---:|---|---|
${layerRows}

BUZZ is the first provider behind PlotPickle-owned Community contracts. Community material has no direct canon authority. The governed bridge remains: **Community material → Bring into Story → Candidate → Evidence / Revision → Human approval → PPF Canon**.

To regenerate the diagram and this section after an architecture change, run \`node architecture/generate-architecture.mjs\`. CI runs \`node architecture/generate-architecture.mjs --check\` so the JSON source, SVG and managed README section cannot silently drift apart.
${END}`;
}

function replaceManagedSection(readme, section) {
  if (readme.includes(START) && readme.includes(END)) {
    const start = readme.indexOf(START);
    const end = readme.indexOf(END) + END.length;
    return `${readme.slice(0, start)}${section}${readme.slice(end)}`;
  }
  const anchor = "\n## The default feature-film production model";
  if (!readme.includes(anchor)) {
    throw new Error("README architecture insertion anchor not found.");
  }
  return readme.replace(anchor, `\n${section}\n${anchor}`);
}

function assertArchitecture(architecture) {
  const layerIds = new Set();
  architecture.layers.forEach((layer, index) => {
    if (layer.number !== index + 1) throw new Error(`Layer numbering must be contiguous at ${layer.id}.`);
    if (layerIds.has(layer.id)) throw new Error(`Duplicate layer id: ${layer.id}`);
    if (!Array.isArray(layer.components) || layer.components.length === 0) throw new Error(`Layer ${layer.id} has no components.`);
    layerIds.add(layer.id);
  });
  for (const flow of architecture.flows) {
    const known = (id) => layerIds.has(id) || id === "community" || id === "bridge";
    if (!known(flow.from) || !known(flow.to)) throw new Error(`Flow references unknown boundary: ${flow.from} -> ${flow.to}`);
  }
}

const architecture = JSON.parse(fs.readFileSync(SOURCE_PATH, "utf8"));
const skin = fs.readFileSync(SKIN_PATH, "utf8");
assertArchitecture(architecture);
const svg = renderSvg(architecture, skin);
const readme = fs.readFileSync(README_PATH, "utf8");
const nextReadme = replaceManagedSection(readme, renderReadmeSection(architecture));

if (CHECK) {
  const currentSvg = fs.existsSync(SVG_PATH) ? fs.readFileSync(SVG_PATH, "utf8") : "";
  const failures = [];
  if (currentSvg !== svg) failures.push("architecture/plotpickle-architecture.svg is stale");
  if (readme !== nextReadme) failures.push("README.md ARCHITECTURE section is stale");
  if (failures.length) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Architecture blueprint, Architecture Skin and README section are synchronized.");
  }
} else {
  fs.writeFileSync(SVG_PATH, svg);
  fs.writeFileSync(README_PATH, nextReadme);
  console.log("Generated architecture/plotpickle-architecture.svg and updated README.md ARCHITECTURE section.");
}
