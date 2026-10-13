import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";

const root = new URL("..", import.meta.url);

async function withConversion(run) {
  const server = await createServer({
    root: root.pathname,
    configFile: false,
    logLevel: "error",
    appType: "custom",
    server: { middlewareMode: true },
  });
  try {
    const [converter, packageReader, libraryBridge] = await Promise.all([
      server.ssrLoadModule("/lib/projects/screenplay/screenplay-to-ppf.ts"),
      server.ssrLoadModule("/lib/projects/persistence/project-package.ts"),
      server.ssrLoadModule("/modules/library/import/rich-ppf-to-library-project.ts"),
    ]);
    await run({
      convert: converter.convertScreenplayTextToPpf,
      read: packageReader.parsePortableProjectFile,
      bridge: libraryBridge.richPpfToLibraryProject,
    });
  } finally {
    await server.close();
  }
}

function draft(titlePage) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Version="3">
<Content>
<Paragraph Type="Scene Heading"><Text>EXT. FIELD - DAY</Text></Paragraph>
<Paragraph Type="Action"><Text>Two brothers cross the open field.</Text></Paragraph>
<Paragraph Type="Character"><Text>ELI</Text></Paragraph>
<Paragraph Type="Dialogue"><Text>Stay with me.</Text></Paragraph>
<Paragraph Type="Scene Heading"><Text>INT. HOUSE - NIGHT</Text></Paragraph>
<Paragraph Type="Action"><Text>The door closes behind them.</Text></Paragraph>
</Content>
<TitlePage><Content>${titlePage}</Content></TitlePage>
</FinalDraft>`;
}

test("#2954 FDX title metadata survives portable conversion, integrity readback and Library projection", async () => {
  await withConversion(async ({ convert, read, bridge }) => {
    const sourceText = draft(`
      <Paragraph Type="Normal"><Text>.</Text></Paragraph>
      <Paragraph Type="Normal"><Text>Written by</Text></Paragraph>
      <Paragraph Type="Title"><Text Style="Bold">Brotherly</Text><Text> Love</Text></Paragraph>
    `);
    const converted = convert({
      fileName: "untitled.fdx",
      sourceText,
      importedAt: "2026-10-13T12:00:00.000Z",
    });
    assert.equal(converted.projectTitle, "Brotherly Love");
    assert.equal(converted.fileName, "brotherly-love.ppf");
    const parsed = read(converted.serializedPpf);
    assert.equal(parsed.integrityValid, true);
    assert.equal(parsed.project.metadata.title, "Brotherly Love");
    assert.equal(parsed.project.screenplay.fileName, "untitled.fdx");
    assert.equal(parsed.project.screenplay.sourceText, sourceText);
    assert.equal(parsed.project.screenplay.analysisStatus, "suggested");
    assert.equal(parsed.project.screenplay.draftElements.length, 6);
    const library = bridge(parsed.project, "2026-10-13T12:00:00.000Z");
    assert.equal(library.title, "Brotherly Love");
    assert.equal(library.sourceEvidence.screenplay.totalPassageCount, 6);
    assert.equal(library.sourceEvidence.screenplay.passages[3].text, "Stay with me.");
  });
});

test("#2954 rejects punctuation-only/byline title candidates and uses a readable source filename", async () => {
  await withConversion(async ({ convert, read }) => {
    const sourceText = draft(`
      <Paragraph Type="Normal"><Text>...</Text></Paragraph>
      <Paragraph Type="Normal"><Text>Written by</Text></Paragraph>
    `);
    const converted = convert({ fileName: "My_Brothers.fdx", sourceText });
    assert.equal(converted.projectTitle, "My Brothers");
    assert.equal(converted.fileName, "my-brothers.ppf");
    assert.equal(read(converted.serializedPpf).project.metadata.title, "My Brothers");
  });
});

test("#2954 first meaningful TitlePage paragraph and escaped XML title are handled without screenplay changes", async () => {
  await withConversion(async ({ convert, read }) => {
    const sourceText = draft(`
      <Paragraph Type="Normal"><Text>.</Text></Paragraph>
      <Paragraph Type="Normal"><Text>Love &amp; Loyalty</Text></Paragraph>
      <Paragraph Type="Normal"><Text>By</Text></Paragraph>
    `);
    const converted = convert({ fileName: "source.fdx", sourceText });
    assert.equal(converted.projectTitle, "Love & Loyalty");
    assert.equal(converted.fileName, "love-loyalty.ppf");
    assert.equal(read(converted.serializedPpf).project.screenplay.sourceText, sourceText);
  });
});
