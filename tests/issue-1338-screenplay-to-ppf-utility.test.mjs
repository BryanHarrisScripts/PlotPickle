import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createServer } from "vite";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

async function withConverter(run) {
  const server = await createServer({
    root: new URL("..", import.meta.url).pathname,
    configFile: false,
    logLevel: "error",
    appType: "custom",
    server: { middlewareMode: true },
  });
  try {
    const converter = await server.ssrLoadModule("/lib/projects/screenplay/screenplay-to-ppf.ts");
    await run(converter.convertScreenplayTextToPpf);
  } finally {
    await server.close();
  }
}

const fountain = `Title: Utility Test Story

INT. KITCHEN - NIGHT
MARA
We cannot stay here.

JON
Then choose where we go.

Mara takes the brass key from the table.

EXT. ROAD - NIGHT
The storm closes in behind them.
`;

const fdx = `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Template="No" Version="3">
<Content>
<Paragraph Type="Scene Heading"><Text>INT. WORKSHOP - DAY</Text></Paragraph>
<Paragraph Type="Action"><Text>Avery opens the sealed envelope.</Text></Paragraph>
<Paragraph Type="Character"><Text>AVERY</Text></Paragraph>
<Paragraph Type="Dialogue"><Text>This changes everything.</Text></Paragraph>
<Paragraph Type="Scene Heading"><Text>EXT. RIVER - DUSK</Text></Paragraph>
<Paragraph Type="Action"><Text>The map burns at the edges.</Text></Paragraph>
</Content>
</FinalDraft>`;

const pdfText = Array.from({ length: 14 }, (_, index) => [
  `INT. ROOM ${index + 1} - NIGHT`,
  "MARA",
  `We need to move before the signal changes ${index + 1}.`,
  `Mara crosses the room and locks door ${index + 1}.`,
].join("\n")).join("\n");

test("issue #1338 composes the existing rich screenplay importer and portable PPF package", async () => {
  const converter = await source("lib/projects/screenplay/screenplay-to-ppf.ts");
  for (const contract of [
    "createProjectFromScreenplay",
    "createPortableProjectFile",
    "serializePortableProjectFile",
    "portableProjectFileName",
    "screenplayFormatForFile",
    "analyzeScreenplayText",
  ]) assert.ok(converter.includes(contract), `Converter is missing existing capability: ${contract}`);
  assert.doesNotMatch(converter, /createBlankProject\(/);
  assert.doesNotMatch(converter, /plotpickle-project-file.*version\s*[:=]/i);
});

test("issue #1338 converts Fountain directly into a rich portable PPF", async () => {
  await withConverter(async (convert) => {
    const result = convert({ fileName: "utility-test.fountain", sourceText: fountain, importedAt: "2026-08-24T12:00:00.000Z" });
    assert.match(result.fileName, /\.ppf$/);
    assert.ok(result.sourcePassageCount > 0);
    assert.ok(result.sourceSceneCount >= 2);
    const portable = JSON.parse(result.serializedPpf);
    assert.equal(portable.format, "plotpickle-project-file");
    assert.equal(portable.project.screenplay.fileName, "utility-test.fountain");
    assert.equal(portable.project.screenplay.analysisStatus, "suggested");
    assert.ok(portable.project.screenplay.draftElements.length > 0);
    assert.ok(portable.project.screenplay.suggestedFields.includes("blocks"));
  });
});

test("issue #1338 converts Final Draft FDX through the same utility", async () => {
  await withConverter(async (convert) => {
    const result = convert({ fileName: "utility-test.fdx", sourceText: fdx, importedAt: "2026-08-24T12:00:00.000Z" });
    const portable = JSON.parse(result.serializedPpf);
    assert.equal(portable.project.screenplay.format, "final-draft");
    assert.equal(portable.project.screenplay.fileName, "utility-test.fdx");
    assert.ok(portable.project.screenplay.draftElements.some((element) => element.type === "dialogue"));
  });
});

test("issue #1338 accepts extracted text from a screenplay PDF and rejects scanned-like input", async () => {
  await withConverter(async (convert) => {
    const result = convert({ fileName: "utility-test.pdf", sourceText: pdfText, importedAt: "2026-08-24T12:00:00.000Z" });
    const portable = JSON.parse(result.serializedPpf);
    assert.equal(portable.project.screenplay.fileName, "utility-test.pdf");
    assert.ok(result.sourcePassageCount > 20);
    assert.throws(() => convert({
      fileName: "scanned.pdf",
      sourceText: "This page contains only a few extracted labels from what is otherwise an image-only scanned screenplay PDF. There is no reliable script body here.",
    }), /scanned or image-only|enough screenplay structure/i);
  });
});

test("issue #1338 Human-facing converter stays a thin local utility with explicit PDF boundary", async () => {
  const [runner, launcher, readme, afterglow] = await Promise.all([
    source("scripts/projects/convert-screenplay-to-ppf.mjs"),
    source("Utilities/Convert-Screenplay-To-PPF.cmd"),
    source("Utilities/README.md"),
    source("lib/afterglow-reference-ppf.ts"),
  ]);
  assert.match(runner, /pdftotext/);
  assert.match(runner, /mutool/);
  assert.match(runner, /Scanned PDFs require an explicit OCR step|Scanned\/image-only PDFs are not OCR'd automatically/);
  assert.match(runner, /ssrLoadModule\("\/lib\/projects\/screenplay\/screenplay-to-ppf\.ts"\)/);
  assert.match(launcher, /scripts\\projects\\convert-screenplay-to-ppf\.mjs/);
  assert.match(readme, /Convert-Screenplay-To-PPF\.cmd/);
  assert.match(readme, /does not silently OCR/i);
  assert.match(afterglow, /createAfterglowReferencePpf/);
  assert.match(afterglow, /packageProject/);
});
