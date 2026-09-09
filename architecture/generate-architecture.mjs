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
const esc = (v = "") => String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

function wrap(text, max) {
  const out = [];
  let line = "";
  for (const word of String(text).split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && next.length > max) { out.push(line); line = word; } else line = next;
  }
  if (line) out.push(line);
  return out;
}

function lines(text, x, y, cls, max = 48, gap = 10, limit = 3) {
  return wrap(text, max).slice(0, limit).map((t, i) => `<text x="${x}" y="${y + i * gap}" class="${cls}">${esc(t)}</text>`).join("\n");
}

function validate(a) {
  const ids = new Set();
  a.layers.forEach((layer, i) => {
    if (layer.number !== i + 1) throw new Error(`Layer numbering must be contiguous at ${layer.id}.`);
    if (ids.has(layer.id) || !layer.components?.length) throw new Error(`Invalid layer ${layer.id}.`);
    ids.add(layer.id);
  });
  for (const flow of a.flows) {
    const known = (id) => ids.has(id) || id === "community" || id === "bridge";
    if (!known(flow.from) || !known(flow.to)) throw new Error(`Unknown flow boundary ${flow.from} -> ${flow.to}.`);
  }
}

function renderSvg(a, skin) {
  const mainX = 180, mainW = 840, sideX = 1090, sideW = 365;
  const y0 = 82, rowH = 108, gap = 10;
  const css = skin.replace(/:root\s*\{([\s\S]*?)\}/, (_, vars) => `svg {${vars}}`);
  const layerSvg = a.layers.map((layer, i) => {
    const y = y0 + i * (rowH + gap);
    const tone = layer.tone;
    const comp = layer.components.map((c) => c.title).join(" · ");
    return `<g id="layer-${esc(layer.id)}">
<path d="M38 ${y+28} l14 8 v18 l-14 8 l-14-8 v-18 z" fill="none" class="${tone}"/>
<text x="38" y="${y+47}" class="number ${tone}">${layer.number}</text>
${lines(layer.label, 68, y+32, `layer-label ${tone}`, 20, 11, 3)}
${lines(layer.summary, 68, y+70, "layer-summary", 22, 9, 3)}
<rect x="${mainX}" y="${y}" width="${mainW}" height="${rowH}" rx="7" class="panel ${tone}-stroke"/>
<text x="${mainX+12}" y="${y+23}" class="panel-title ${tone}">${esc(layer.title)}</text>
${layer.note ? `<text x="${mainX+mainW-12}" y="${y+23}" class="note" text-anchor="end">${esc(layer.note)}</text>` : ""}
<rect x="${mainX+12}" y="${y+34}" width="${mainW-24}" height="42" rx="2" class="component ${tone}-stroke"/>
${lines(comp, mainX+24, y+51, "component-title", 115, 11, 2)}
<text x="${mainX+12}" y="${y+96}" class="footer">${esc(layer.footer ?? "")}</text>
</g>`;
  }).join("\n");

  const principles = a.principles.map((p, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    return `<text x="${sideX+14+col*176}" y="${126+row*25}" class="component-title">${esc(p.title)}</text><text x="${sideX+14+col*176}" y="${136+row*25}" class="component-detail">${esc(p.detail)}</text>`;
  }).join("\n");

  const community = a.community.components.map((c, i) => {
    const y = 252 + i * 61;
    return `<rect x="${sideX+12}" y="${y}" width="${sideW-24}" height="52" rx="2" class="component purple-stroke"/><text x="${sideX+22}" y="${y+17}" class="component-title">${esc(c.title)}</text>${lines(c.detail, sideX+22, y+31, "component-detail", 55, 8, 2)}`;
  }).join("\n");

  const bridge = a.bridge.steps.map((s, i) => `<rect x="${sideX+12}" y="${643+i*32}" width="${sideW-24}" height="23" rx="2" class="component purple-stroke"/><text x="${sideX+20}" y="${659+i*32}" class="component-title">${i+1} ${esc(s)}</text>`).join("\n");
  const connectors = a.layers.slice(0, -1).map((_, i) => {
    const y = y0 + i * (rowH + gap) + rowH;
    return `<path d="M325 ${y} v${gap-3}" class="flow amber-stroke"/>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 980" role="img" aria-labelledby="title desc">
<title id="title">${esc(a.blueprint.title)} architecture blueprint</title><desc id="desc">Generated from ${esc(a.blueprint.source)}.</desc>
<style>${css}</style>
<defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" class="grid" fill="none"/></pattern><marker id="arrow-cyan" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7Z" fill="#58d7e7"/></marker><marker id="arrow-amber" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7Z" fill="#f0b82f"/></marker><marker id="arrow-purple" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7Z" fill="#bc83e8"/></marker></defs>
<rect width="1500" height="980" class="bg"/><rect width="1500" height="980" fill="url(#grid)" opacity=".22"/>
<text x="180" y="36" class="title">${esc(a.blueprint.title)}</text><text x="385" y="36" class="tagline">${esc(a.blueprint.tagline)}</text><text x="180" y="58" class="subtitle">${esc(a.blueprint.subtitle)}</text><text x="1450" y="27" class="micro cyan" text-anchor="end">ARCHITECTURE BLUEPRINT v${esc(a.blueprint.version)}</text><text x="1450" y="46" class="note" text-anchor="end">${esc(a.blueprint.updated)} · ${esc(a.blueprint.status)}</text><line x1="180" y1="68" x2="1450" y2="68" class="cyan" opacity=".6"/>
${layerSvg}
${connectors}
<rect x="${sideX}" y="82" width="${sideW}" height="112" rx="7" class="panel cyan-stroke"/><text x="${sideX+12}" y="105" class="panel-title cyan">CORE PRINCIPLES</text>${principles}
<rect x="${sideX}" y="210" width="${sideW}" height="350" rx="7" class="panel purple-stroke"/><text x="${sideX+12}" y="233" class="panel-title purple">${esc(a.community.title)}</text><text x="${sideX+12}" y="247" class="note">${esc(a.community.summary)}</text>${community}<text x="${sideX+12}" y="518" class="footer">${esc(a.community.rules[0])}</text><text x="${sideX+12}" y="535" class="micro purple">${esc(a.community.rules.at(-1))}</text>
<path d="M1020 416H1090" class="flow amber-stroke"/><path d="M1090 438H1020" class="flow"/>
<rect x="${sideX}" y="590" width="${sideW}" height="158" rx="7" class="panel purple-stroke dashed"/><text x="${sideX+12}" y="613" class="panel-title purple">${esc(a.bridge.title)}</text><text x="${sideX+sideW-12}" y="613" class="micro purple" text-anchor="end">${esc(a.bridge.status)}</text>${bridge}<text x="${sideX+12}" y="737" class="footer purple">${esc(a.bridge.footer)}</text><path d="M1272 560V586" class="flow purple-stroke dashed"/>
<rect x="${sideX}" y="770" width="${sideW}" height="108" rx="7" class="panel cyan-stroke"/><text x="${sideX+12}" y="793" class="panel-title cyan">READING THE DIAGRAM</text>${a.legend.map((l,i)=>`<text x="${sideX+12}" y="${817+i*18}" class="footer ${l.tone}">${l.advisory?"⋯⋯→":"────→"} ${esc(l.label)}</text>`).join("")}
<text x="180" y="948" class="micro amber">MIGRATION STATUS</text><text x="275" y="948" class="footer">${esc(a.migration)}</text><text x="1450" y="965" class="micro cyan" text-anchor="end">SOURCE: ${esc(a.blueprint.source)}</text>
</svg>\n`;
}

function readmeSection(a) {
  const rows = a.layers.map((l) => `| ${l.number} | ${l.label.replaceAll("|", "\\|")} | ${l.summary.replaceAll("|", "\\|")} |`).join("\n");
  return `${START}\n## ARCHITECTURE\n\nPlotPickle's architecture blueprint is generated from one machine-readable source: [\`architecture/plotpickle.architecture.json\`](architecture/plotpickle.architecture.json). The application Skins do not own this documentation style; architecture diagrams use their own dedicated Architecture Skin.\n\n<p align="center">\n  <img src="architecture/plotpickle-architecture.svg" alt="PlotPickle target architecture blueprint" width="1200">\n</p>\n\n| Layer | Boundary | Responsibility |\n|---:|---|---|\n${rows}\n\nBUZZ is the first provider behind PlotPickle-owned Community contracts. Community material has no direct canon authority. The governed bridge remains: **Community material → Bring into Story → Candidate → Evidence / Revision → Human approval → PPF Canon**.\n\nTo regenerate the diagram and this section after an architecture change, run \`node architecture/generate-architecture.mjs\`. CI runs \`node architecture/generate-architecture.mjs --check\` so the JSON source, SVG and managed README section cannot silently drift apart.\n${END}`;
}

function withSection(readme, section) {
  if (readme.includes(START) && readme.includes(END)) return `${readme.slice(0, readme.indexOf(START))}${section}${readme.slice(readme.indexOf(END) + END.length)}`;
  const anchor = "\n## The default feature-film production model";
  if (!readme.includes(anchor)) throw new Error("README architecture insertion anchor not found.");
  return readme.replace(anchor, `\n${section}\n${anchor}`);
}

const architecture = JSON.parse(fs.readFileSync(SOURCE_PATH, "utf8"));
validate(architecture);
const svg = renderSvg(architecture, fs.readFileSync(SKIN_PATH, "utf8"));
const readme = fs.readFileSync(README_PATH, "utf8");
const nextReadme = withSection(readme, readmeSection(architecture));
if (CHECK) {
  const errors = [];
  if (!fs.existsSync(SVG_PATH) || fs.readFileSync(SVG_PATH, "utf8") !== svg) errors.push("architecture/plotpickle-architecture.svg is stale");
  if (readme !== nextReadme) errors.push("README.md ARCHITECTURE section is stale");
  if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; } else console.log("Architecture blueprint, Architecture Skin and README section are synchronized.");
} else {
  fs.writeFileSync(SVG_PATH, svg);
  fs.writeFileSync(README_PATH, nextReadme);
  console.log("Generated architecture blueprint and updated README.md ARCHITECTURE section.");
}
