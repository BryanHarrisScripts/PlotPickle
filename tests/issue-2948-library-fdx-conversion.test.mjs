import assert from "node:assert/strict";
import { Readable, PassThrough } from "node:stream";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createServer } from "vite";

const repoRoot = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, repoRoot), "utf8");

const finalDraft = `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Version="3"><Content>
<Paragraph Type="Scene Heading"><Text>INT. CONTROL ROOM - NIGHT</Text></Paragraph>
<Paragraph Type="Action"><Text>AVA turns the emergency switch.</Text></Paragraph>
<Paragraph Type="Character"><Text>AVA</Text></Paragraph>
<Paragraph Type="Dialogue"><Text>The signal is gone.</Text></Paragraph>
<Paragraph Type="Scene Heading"><Text>EXT. CITY - DAY</Text></Paragraph>
<Paragraph Type="Action"><Text>The street lights flicker.</Text></Paragraph>
</Content></FinalDraft>`;

async function withGateway(run) {
  const server = await createServer({
    root: new URL("..", import.meta.url).pathname,
    configFile: false,
    logLevel: "error",
    appType: "custom",
    server: { middlewareMode: true },
  });
  try {
    const [gateway, packageReader] = await Promise.all([
      server.ssrLoadModule("/build/library-ppf-import-gateway.ts"),
      server.ssrLoadModule("/lib/projects/persistence/project-package.ts"),
    ]);
    let handler;
    gateway.registerLibraryPpfImportGateway({ middlewares: { use: (middleware) => { handler = middleware; } } });
    assert.equal(typeof handler, "function");

    async function request({ url = gateway.LIBRARY_FDX_CONVERT_PATH, method = "POST", filename = "My Script.fdx", body = finalDraft, origin = "http://127.0.0.1:4173", contentLength } = {}) {
      const incoming = Readable.from([Buffer.from(body)]);
      incoming.url = url;
      incoming.method = method;
      incoming.socket = { remoteAddress: "127.0.0.1" };
      incoming.headers = {
        host: "127.0.0.1:4173",
        origin,
        "content-length": String(contentLength ?? Buffer.byteLength(body)),
        ...(filename === null ? {} : { "x-plotpickle-screenplay-filename": encodeURIComponent(filename) }),
      };
      const outgoing = new PassThrough();
      let status = 0;
      let responseHeaders = {};
      const received = [];
      outgoing.on("data", (chunk) => received.push(chunk));
      outgoing.writeHead = (code, headers) => { status = code; responseHeaders = headers; return outgoing; };
      let nextCalled = false;
      const finished = new Promise((resolve, reject) => {
        outgoing.once("finish", resolve);
        outgoing.once("error", reject);
      });
      await handler(incoming, outgoing, () => { nextCalled = true; outgoing.end(); });
      await finished;
      return { status, headers: responseHeaders, body: Buffer.concat(received), nextCalled };
    }
    await run({ request, parse: packageReader.parsePortableProjectFile });
  } finally {
    await server.close();
  }
}

test("#2948 Final Draft upload creates a real portable PPF with original screenplay evidence", async () => {
  await withGateway(async ({ request, parse }) => {
    const reply = await request({});
    assert.equal(reply.status, 200);
    assert.match(reply.headers["Content-Disposition"], /\.ppf"/);
    assert.equal(reply.headers["Cache-Control"], "no-store");
    assert.ok(Number(reply.headers["X-PlotPickle-Source-Scenes"]) >= 2);
    assert.ok(Number(reply.headers["X-PlotPickle-Source-Passages"]) >= 6);
    const parsed = parse(reply.body.toString("utf8"));
    assert.equal(parsed.integrityValid, true);
    assert.equal(parsed.project.screenplay.fileName, "My Script.fdx");
    assert.equal(parsed.project.screenplay.format, "final-draft");
    assert.equal(parsed.project.screenplay.sourceText, finalDraft);
    assert.equal(parsed.project.screenplay.analysisStatus, "suggested");
    assert.ok(parsed.project.screenplay.draftElements.some((item) => item.text === "The signal is gone."));
    assert.equal(parsed.project.blocks.length, 24);
    assert.equal(parsed.project.blocks.flatMap((block) => block.scenes.flatMap((scene) => scene.miniBlocks)).length, 96);
  });
});

test("#2948 local boundary refuses invalid/malformed FDX, oversized input and foreign origins", async () => {
  await withGateway(async ({ request }) => {
    const malformed = await request({ body: "<html>not a screenplay</html>" });
    assert.equal(malformed.status, 400);
    assert.match(malformed.body.toString(), /recognizable Final Draft/);
    assert.equal((await request({ filename: "malware.txt" })).status, 400);
    assert.equal((await request({ filename: null })).status, 400);
    assert.equal((await request({ body: "" })).status, 400);
    assert.equal((await request({ contentLength: 49 * 1024 * 1024 })).status, 413);
    assert.equal((await request({ origin: "https://example.com" })).status, 403);
    assert.equal((await request({ method: "GET" })).status, 405);
  });
});

test("#2948 Import Export exposes conversion separately from PPF import and Library backup", async () => {
  const [ui, gateway, reader] = await Promise.all([
    source("modules/library/ui/library-workspace.tsx"),
    source("build/library-ppf-import-gateway.ts"),
    source("build/projects/portable-ppf-reader.ts"),
  ]);
  assert.match(ui, /Convert Final Draft to PlotPickle \(\.ppf\)/);
  assert.match(ui, /\/api\/library\/convert\/fdx/);
  assert.match(ui, /accept="\.fdx,application\/xml,text\/xml"/);
  assert.match(ui, /Convert Final Draft/);
  assert.match(ui, /Import a story/);
  assert.match(ui, /Export current story/);
  assert.match(ui, /\/api\/library\/import\/ppf/);
  assert.match(gateway, /convertScreenplayTextToPpf/);
  assert.match(gateway, /isLocalPlotPickleRequest/);
  assert.match(reader, /48 \* 1024 \* 1024/);
  assert.doesNotMatch(ui, /markScreenplayAnalysisReviewed/);
});
