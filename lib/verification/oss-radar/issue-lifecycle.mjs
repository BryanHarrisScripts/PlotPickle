import {
  findDailyComment,
  monthlyIssueTitle,
  utcDate,
} from "./history.mjs";
import { renderRadarReviewEmail } from "./public-digest.mjs";
import { renderPublicBlogDraft } from "./blog-draft.mjs";
import { monthlyIssueBody, renderDailyReport, selectDailyFindings } from "./report-renderer.mjs";

const API = "https://api.github.com";
const COMMENT_SIZE_GUARD = 240_000;

function repoPath(repository) {
  if (!/^[^/]+\/[^/]+$/u.test(String(repository || ""))) throw new Error("OSS Radar requires repository identity as owner/name.");
  return String(repository);
}

function headers(auth, hasBody = false) {
  const result = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "PlotPickle-OSS-Radar",
  };
  if (auth) result.Authorization = `Bearer ${String(auth).trim()}`;
  if (hasBody) result["Content-Type"] = "application/json";
  return result;
}

async function requestJson(url, { auth, fetchImpl, method = "GET", body } = {}) {
  const response = await fetchImpl(url, {
    method,
    headers: headers(auth, body !== undefined),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response?.ok) {
    let detail = "";
    try {
      const payload = await response.json();
      detail = payload?.message ? `: ${payload.message}` : "";
    } catch {
      detail = "";
    }
    const bodyChars = typeof body?.body === "string" ? ` (bodyChars=${body.body.length})` : "";
    throw new Error(`OSS Radar issue API failed with HTTP ${response?.status ?? "unknown"}${detail}${bodyChars}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export async function searchRadarIssues({ repository, auth, fetchImpl = globalThis.fetch }) {
  const repo = repoPath(repository);
  const query = `repo:${repo} is:issue in:title "[OSS RADAR]"`;
  const url = new URL(`${API}/search/issues`);
  url.searchParams.set("q", query);
  url.searchParams.set("sort", "created");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", "100");
  const payload = await requestJson(url.toString(), { auth, fetchImpl });
  return (payload?.items || []).filter((issue) => String(issue?.title || "").startsWith("[OSS RADAR] "));
}

export async function listIssueComments({ repository, issueNumber, auth, fetchImpl = globalThis.fetch }) {
  const repo = repoPath(repository);
  const url = `${API}/repos/${repo}/issues/${Number(issueNumber)}/comments?per_page=100`;
  const payload = await requestJson(url, { auth, fetchImpl });
  return Array.isArray(payload) ? payload : [];
}

async function createMonthlyIssue({ repository, title, value, auth, fetchImpl }) {
  const repo = repoPath(repository);
  return requestJson(`${API}/repos/${repo}/issues`, {
    auth,
    fetchImpl,
    method: "POST",
    body: { title, body: monthlyIssueBody(value) },
  });
}

async function createDailyComment({ repository, issueNumber, body, auth, fetchImpl }) {
  const repo = repoPath(repository);
  return requestJson(`${API}/repos/${repo}/issues/${Number(issueNumber)}/comments`, {
    auth,
    fetchImpl,
    method: "POST",
    body: { body },
  });
}

async function updateDailyComment({ repository, commentId, body, auth, fetchImpl }) {
  const repo = repoPath(repository);
  return requestJson(`${API}/repos/${repo}/issues/comments/${Number(commentId)}`, {
    auth,
    fetchImpl,
    method: "PATCH",
    body: { body },
  });
}

export async function publishDailyRadar({
  repository,
  auth,
  contract,
  discoveryResult,
  history = new Map(),
  fetchImpl = globalThis.fetch,
  now = new Date(),
} = {}) {
  if (!auth || !String(auth).trim()) throw new Error("OSS Radar issue publishing requires authentication.");
  if (!contract) throw new Error("OSS Radar publishing requires the discovery contract.");
  if (!discoveryResult || !Array.isArray(discoveryResult.candidates)) throw new Error("OSS Radar publishing requires discovery candidates.");
  if (typeof fetchImpl !== "function") throw new Error("OSS Radar publishing requires a fetch implementation.");

  const reportDate = utcDate(now);
  const expectedTitle = monthlyIssueTitle(now);
  const issues = await searchRadarIssues({ repository, auth, fetchImpl });
  const exact = issues.filter((issue) => issue.title === expectedTitle);
  if (exact.length > 1) throw new Error(`OSS Radar found duplicate monthly issues titled ${expectedTitle}.`);

  const selection = selectDailyFindings({
    candidates: discoveryResult.candidates,
    contract,
    history,
    reportDate,
  });
  const rendered = renderDailyReport({ reportDate, selection, contract, history });
  if (rendered.body.length > COMMENT_SIZE_GUARD) {
    throw new Error(`OSS Radar human report exceeded the ${COMMENT_SIZE_GUARD}-character publish guard (bodyChars=${rendered.body.length}).`);
  }

  let monthlyIssue = exact[0] || null;
  if (!monthlyIssue) {
    monthlyIssue = await createMonthlyIssue({ repository, title: expectedTitle, value: now, auth, fetchImpl });
  }

  const currentComments = await listIssueComments({
    repository,
    issueNumber: monthlyIssue.number,
    auth,
    fetchImpl,
  });
  const existing = findDailyComment(currentComments, reportDate);
  const comment = existing
    ? await updateDailyComment({ repository, commentId: existing.id, body: rendered.body, auth, fetchImpl })
    : await createDailyComment({ repository, issueNumber: monthlyIssue.number, body: rendered.body, auth, fetchImpl });
  const commentId = comment?.id || existing?.id || null;
  const reportUrl = commentId
    ? `https://github.com/${repoPath(repository)}/issues/${monthlyIssue.number}#issuecomment-${commentId}`
    : `https://github.com/${repoPath(repository)}/issues/${monthlyIssue.number}`;
  const email = renderRadarReviewEmail({
    reportDate,
    candidates: selection.reviewQueue,
    publicDigest: rendered.publicDigest,
    reportUrl,
  });
  const publicBlogDraft = renderPublicBlogDraft({ reportDate, candidates: selection.reviewQueue });

  return {
    reportDate,
    monthlyIssueNumber: monthlyIssue.number,
    monthlyIssueTitle: expectedTitle,
    commentId,
    reportUrl,
    action: existing ? "updated" : "created",
    selectedCount: selection.selected.length,
    belowThresholdCount: selection.belowThreshold.length,
    reviewCount: selection.reviewQueue.length,
    reviewTarget: selection.reviewTarget,
    suppressed: selection.suppressed,
    reportBody: rendered.body,
    reportBodyChars: rendered.body.length,
    publicDigest: rendered.publicDigest,
    publicBlogDraft,
    email,
    state: rendered.state,
  };
}
