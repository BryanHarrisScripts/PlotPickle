import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  filterDiscover, normalizeDiscoverCatalog, safeDiscoverUrl,
} from "../modules/discover/model/discover-catalog.ts";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");
const record = (extra = {}) => ({
  id: "craft-1", title: "Screenplay craft", category: "Writing",
  summary: "Human-reviewed original summary of a craft resource.",
  publisher: "Example publisher", sourceUrl: "https://example.org/craft",
  checkedAt: "2026-10-22", editorialState: "REVIEWED",
  areas: ["Write", "Learn"],
  decisions: [{ authority: "HUMAN", decision: "APPROVED", at: "2026-10-22" }],
  ...extra,
});
const capability = (extra = {}) => ({
  id: "lighting", title: "Lighting practice", category: "Film craft",
  description: "Research pending", status: "UNKNOWN",
  ownerModule: null, exactCommit: null, productEvidenceUrl: null, ...extra,
});
const catalog = (extra = {}) => ({
  schemaVersion: 1, editorialAuthority: "HUMAN_REVIEW_REQUIRED",
  reviewedAt: "2026-10-22", entries: [], capabilities: [], researchFeeds: [],
  ...extra,
});

test("#3227 current Discover catalogue is review-only, never fabricated journal publication", async () => {
  const raw = JSON.parse(await read("content/discover/editorial-catalog.json"));
  const result = normalizeDiscoverCatalog(raw);
  assert.equal(result.entries.length, 0);
  assert.equal(result.lastReviewed, null);
  assert.ok(result.capabilities.length >= 4);
  assert.ok(result.capabilities.every(v => v.status === "UNKNOWN"));
  assert.equal(result.feeds.length, 3);
  assert.ok(result.feeds.every(v => v.url.startsWith("https://")));
  assert.equal(JSON.stringify(raw).includes("VERIFIED_NATIVE"), false);
});

test("#3227 only explicit Human-approved discoveries with HTTPS source evidence are journal entries", () => {
  const payload = catalog({ entries: [
    record(), record({ id: "pending", editorialState: "REVIEW_REQUIRED" }),
    record({ id: "unapproved", decisions: [] }),
    record({ id: "model-approved", decisions: [{ authority: "AI", decision: "APPROVED", at: "2026-10-22" }] }),
    record({ id: "url-attack", sourceUrl: "javascript:alert(1)" }),
    record({ id: "http", sourceUrl: "http://example.org" }),
    record({ id: "credential", sourceUrl: "https://user:secret@example.org" }),
    record({ id: "duplicate", title: "Duplicate source" }),
    record({ id: "good-different", category: "Production", title: "Editing craft", sourceUrl: "https://example.org/edit" }),
  ] });
  const projection = normalizeDiscoverCatalog(payload);
  assert.deepEqual(projection.entries.map(x => x.id), ["craft-1", "good-different"]);
  assert.ok(projection.entries.every(x => x.editorialState === "REVIEWED"));
  assert.equal(safeDiscoverUrl("data:text/html,x"), null);
  assert.equal(safeDiscoverUrl("https://example.org"), "https://example.org/");
  assert.equal(normalizeDiscoverCatalog({ ...payload, editorialAuthority: "AUTO_PUBLISH" }).entries.length, 0);
});

test("#3227 missing independent proof downgrades positive capability claims, nonverified states stay distinct", () => {
  const proof = { ownerModule: "app/skin-v1/example.tsx", exactCommit: "a".repeat(40),
    productEvidenceUrl: "https://github.com/example/proof",
    independentVerification: true, productAcceptance: true };
  const result = normalizeDiscoverCatalog(catalog({ capabilities: [
    capability({ status: "VERIFIED_NATIVE" }),
    capability({ id: "native", status: "VERIFIED_NATIVE", ...proof }),
    capability({ id: "equivalent", status: "VERIFIED_EQUIVALENT", ...proof }),
    capability({ id: "weak", status: "VERIFIED_EQUIVALENT", ...proof, productAcceptance: false }),
    capability({ id: "external", status: "EXTERNAL_OPTION" }),
    capability({ id: "proposed", status: "PROPOSED" }),
    capability({ id: "duplicate", status: "DUPLICATE" }),
    capability({ id: "declined", status: "DECLINED" }),
  ] }));
  assert.deepEqual(result.capabilities.map(x => x.status), [
    "UNKNOWN", "VERIFIED_NATIVE", "VERIFIED_EQUIVALENT", "UNKNOWN",
    "EXTERNAL_OPTION", "PROPOSED", "DUPLICATE", "DECLINED",
  ]);
});

test("#3227 search/category works on approved journal and unknown capability map", () => {
  const data = normalizeDiscoverCatalog(catalog({
    entries: [record()],
    capabilities: [capability()],
  }));
  assert.equal(filterDiscover(data, "screenplay", "all").entries.length, 1);
  assert.equal(filterDiscover(data, "lighting", "Film craft").capabilities.length, 1);
  assert.equal(filterDiscover(data, "lighting", "Writing").capabilities.length, 0);
  assert.equal(filterDiscover(data, "  NOT-MATCHING  ", "all").entries.length, 0);
  assert.equal(filterDiscover(data, "", "all").capabilities.length, 1);
});

test("#3227 Discover opens inside authenticated Matrix with Back/F5, without a new startup preference", async () => {
  const [menu,explore,host,client,ui] = await Promise.all([
    read("app/skin-v1/dashboard-menu-registry.ts"),
    read("app/_components/dashboard/dashboard-exploration-surface.tsx"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("app/skin-v1/skin-v1-client.tsx"),
    read("app/_components/discover/discover-journal.tsx"),
  ]);
  assert.ok(menu.includes('id: "discover", shortcut: "J", label: "Discover"'));
  assert.ok(menu.includes('["logout", "shutdown", "discover"]'));
  assert.ok(explore.includes('case "discover":'));
  assert.ok(explore.includes('<DiscoverJournal />'));
  assert.ok(host.includes('url.searchParams.set("workspace", item.id)'));
  assert.ok(host.includes('url.searchParams.set("workspace", "dashboard")'));
  assert.ok(host.includes('Back to Dashboard'));
  assert.ok(client.includes('view.state !== "authenticated"'));
  const auth = client.indexOf('if (view.state !== "authenticated")');
  const deepLink = client.indexOf('get("workspace") === "discover"', auth);
  assert.ok(auth >= 0 && deepLink > auth);
  assert.ok(ui.includes('type="search"'));
  assert.ok(ui.includes('role="search"'));
  assert.ok(ui.includes('rel="noopener noreferrer"'));
  assert.ok(ui.includes('data-discover-authority="read-only"'));
  assert.ok(!/saveActiveLibraryProject|fetch\(|localStorage|sessionStorage|approve\(/u.test(ui));
});
