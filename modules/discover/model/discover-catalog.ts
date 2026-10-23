/** #3227: published discoveries require explicit Human editorial authority.
 * OSS RADAR candidates never pass this projection without a new review decision.
 */
export type DiscoverJournalEntry = Readonly<{
  id: string; title: string; category: string; sourceUrl: string;
  summary: string; publisher: string; checkedAt: string;
  editorialState: "REVIEWED"; areas: readonly string[];
  decisions: readonly { decision: "APPROVED"; authority: "HUMAN"; at: string }[];
}>;
export type DiscoverCapability = Readonly<{
  id: string; title: string; category: string; description: string;
  status: "VERIFIED_NATIVE" | "VERIFIED_EQUIVALENT" | "EXTERNAL_OPTION" |
    "PROPOSED" | "DUPLICATE" | "DECLINED" | "UNKNOWN";
  ownerModule: string | null; exactCommit: string | null;
  productEvidenceUrl: string | null;
}>;
export type DiscoverFeed = Readonly<{ title: string; url: string; state: "REVIEW_REQUIRED" }>;
export type DiscoverView = Readonly<{
  entries: readonly DiscoverJournalEntry[];
  capabilities: readonly DiscoverCapability[];
  feeds: readonly DiscoverFeed[];
  lastReviewed: string | null;
}>;

const RECORD = (item: unknown): item is Record<string, unknown> =>
  Boolean(item && typeof item === "object" && !Array.isArray(item));
const SHA = /^[a-f0-9]{40}$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const STATUS = new Set<DiscoverCapability["status"]>([
  "VERIFIED_NATIVE", "VERIFIED_EQUIVALENT", "EXTERNAL_OPTION",
  "PROPOSED", "DUPLICATE", "DECLINED", "UNKNOWN",
]);

export function safeDiscoverUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.includes(".") &&
      !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
function date(value: unknown): value is string {
  return typeof value === "string" && DATE.test(value) &&
    Number.isFinite(Date.parse(value + "T00:00:00Z"));
}
function str(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}
export function normalizeDiscoverCatalog(source: unknown): DiscoverView {
  if (!RECORD(source) || source.schemaVersion !== 1 ||
      source.editorialAuthority !== "HUMAN_REVIEW_REQUIRED")
    return { entries: [], capabilities: [], feeds: [], lastReviewed: null };
  const entries: DiscoverJournalEntry[] = [];
  const capabilities: DiscoverCapability[] = [];
  const feeds: DiscoverFeed[] = [];
  const ids = new Set<string>();
  const sources = new Set<string>();
  for (const raw of Array.isArray(source.entries) ? source.entries.slice(0, 100) : []) {
    if (!RECORD(raw) || !str(raw.id, 120) || ids.has(raw.id) ||
        !str(raw.title, 180) || !str(raw.summary, 650) ||
        !str(raw.category, 80) || !str(raw.publisher, 120) ||
        !date(raw.checkedAt) || raw.editorialState !== "REVIEWED" ||
        !Array.isArray(raw.decisions) || !raw.decisions.some(d =>
          RECORD(d) && d.authority === "HUMAN" &&
          d.decision === "APPROVED" && date(d.at)) ||
        !Array.isArray(raw.areas)) continue;
    const sourceUrl = safeDiscoverUrl(raw.sourceUrl);
    if (!sourceUrl) continue;
    const unique = sourceUrl + "::" + raw.category.toLowerCase();
    if (sources.has(unique)) continue;
    sources.add(unique);
    ids.add(raw.id);
    entries.push({
      id: raw.id, title: raw.title, category: raw.category,
      summary: raw.summary, publisher: raw.publisher, checkedAt: raw.checkedAt,
      editorialState: "REVIEWED", sourceUrl,
      areas: raw.areas.filter((x): x is string => str(x, 80)).slice(0, 10),
      decisions: raw.decisions.filter((d): d is DiscoverJournalEntry["decisions"][number] =>
        RECORD(d) && d.authority === "HUMAN" && d.decision === "APPROVED" &&
        date(d.at)).map(d => ({ ...d })),
    });
  }
  const capabilityIds = new Set<string>();
  for (const raw of Array.isArray(source.capabilities) ? source.capabilities.slice(0, 100) : []) {
    if (!RECORD(raw) || !str(raw.id, 100) || capabilityIds.has(raw.id) ||
        !str(raw.title, 180) || !str(raw.category, 80) || !str(raw.description, 650))
      continue;
    capabilityIds.add(raw.id);
    const requested = STATUS.has(raw.status as DiscoverCapability["status"])
      ? raw.status as DiscoverCapability["status"] : "UNKNOWN";
    const ownerModule = str(raw.ownerModule, 250) ? raw.ownerModule : null;
    const exactCommit = typeof raw.exactCommit === "string" && SHA.test(raw.exactCommit)
      ? raw.exactCommit : null;
    const productEvidenceUrl = safeDiscoverUrl(raw.productEvidenceUrl);
    // No feature gets a check from an OSS research score or code link alone.
    const verified = Boolean(ownerModule && exactCommit && productEvidenceUrl &&
      raw.independentVerification === true && raw.productAcceptance === true);
    const status = (requested === "VERIFIED_NATIVE" || requested === "VERIFIED_EQUIVALENT") &&
      !verified ? "UNKNOWN" : requested;
    capabilities.push({
      id: raw.id, title: raw.title, category: raw.category,
      description: raw.description, status,
      ownerModule, exactCommit, productEvidenceUrl,
    });
  }
  for (const raw of Array.isArray(source.researchFeeds) ? source.researchFeeds.slice(0, 15) : []) {
    if (!RECORD(raw) || !str(raw.title, 180) || raw.state !== "REVIEW_REQUIRED")
      continue;
    const url = safeDiscoverUrl(raw.url);
    if (url && !feeds.some(feed => feed.url === url))
      feeds.push({ title: raw.title, url, state: "REVIEW_REQUIRED" });
  }
  return {
    entries, capabilities, feeds,
    lastReviewed: date(source.reviewedAt) ? source.reviewedAt : null,
  };
}

export function filterDiscover(
  source: DiscoverView, query: string, category: string,
): Pick<DiscoverView, "entries" | "capabilities"> {
  const q = query.trim().toLocaleLowerCase("en-US").slice(0, 120);
  const matchCategory = (v: string) => category === "all" || v === category;
  const match = (values: readonly string[]) =>
    !q || values.some(value => value.toLocaleLowerCase("en-US").includes(q));
  return {
    entries: source.entries.filter(item => matchCategory(item.category) &&
      match([item.title, item.summary, item.publisher, ...item.areas])),
    capabilities: source.capabilities.filter(item => matchCategory(item.category) &&
      match([item.title, item.description, item.status])),
  };
}
