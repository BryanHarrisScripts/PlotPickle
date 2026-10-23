"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import LibraryPpfReportsWorkspace from "./library-ppf-reports-workspace";
import {
  PROJECT_LIBRARY_CHANGED_EVENT,
  PROJECT_LIBRARY_ACTIVE_PROFILE_KEY,
  loadLibraryProjectSnapshot,
  sessionActiveProjectId,
  stageSessionActiveProjectHandoff,
} from "@/core/storage/project-library-browser";
import type { LibraryPPFProject } from "@/core/storage/library-project";
import { profilePrivateBrowserReadyFor } from "@/core/storage/profile-private-browser";
import { browserProfileAuthGateway } from "@/adapters/experience/browser-profile-auth-gateway";
import { resolveActiveLibraryReportsProject } from "@/modules/reports/model/library-ppf-report.mjs";
import { CONSOLIDATED_REPORT_SECTIONS, type ConsolidatedReportSection } from "@/lib/consolidated-reports";

function requestedReportSection(value: string | null): ConsolidatedReportSection {
  return CONSOLIDATED_REPORT_SECTIONS.some((item) => item.id === value)
    ? value as ConsolidatedReportSection
    : "project";
}

export default function ReportsPage({ onBackDashboard, onOpenLibrary }: Readonly<{ onBackDashboard?: () => void; onOpenLibrary?: () => void }> = {}) {
  const [project, setProject] = useState<LibraryPPFProject | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [authorizedProfileId, setAuthorizedProfileId] = useState<string | null>(null);
  const [section, setSection] = useState<ConsolidatedReportSection>("project");
  const [checked, setChecked] = useState(false);
  const refreshing = useRef<Promise<void> | null>(null);

  // A browser document reload loses in-memory profile authority. Revalidate
  // only the existing server-authenticated Human session and read its encrypted
  // Library snapshot; never ask for a passphrase or create/save a story here.
  const refresh = useCallback(() => {
    if (refreshing.current) return;
    const work = (async () => {
      try {
        const profileId = window.sessionStorage.getItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY)?.trim() || "";
        if (!profileId || !profilePrivateBrowserReadyFor(profileId)) {
          await browserProfileAuthGateway.read();
        }
        const hydratedId = window.sessionStorage.getItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY)?.trim() || "";
        const authorized = hydratedId && profilePrivateBrowserReadyFor(hydratedId);
        const activeProjectId = authorized ? sessionActiveProjectId() : null;
        setAuthorizedProfileId(authorized ? hydratedId : null);
        setProject(activeProjectId
          ? resolveActiveLibraryReportsProject({
              activeProjectId,
              loadSnapshot: loadLibraryProjectSnapshot,
            })
          : null);
        setSelectedId(activeProjectId);
      } catch {
        // Revoked/locked or unavailable auth fails closed; no legacy project
        // substitute, silent login, speculative save, or provider call.
        setAuthorizedProfileId(null);
        setProject(null);
        setSelectedId(null);
      } finally {
        setChecked(true);
      }
    })();
    refreshing.current = work;
    void work.finally(() => { if (refreshing.current === work) refreshing.current = null; });
  }, []);

  const changeSection = useCallback((next: ConsolidatedReportSection) => {
    setSection(next);
    const url = new URL(window.location.href);
    url.searchParams.set("section", next);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  useEffect(() => {
    setSection(requestedReportSection(new URLSearchParams(window.location.search).get("section")));
    refresh();
    const onRefresh = () => refresh();
    // Handoff stores only current-session selection identity (no screenplay
    // data). The authenticated rehydrator still must verify the encrypted PPF.
    const onPageHide = () => {
      const profileId = window.sessionStorage.getItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY)?.trim() || "";
      if (profileId && profilePrivateBrowserReadyFor(profileId)) {
        stageSessionActiveProjectHandoff();
      }
    };
    window.addEventListener(PROJECT_LIBRARY_CHANGED_EVENT, onRefresh);
    window.addEventListener("focus", onRefresh);
    window.addEventListener("pageshow", onRefresh);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener(PROJECT_LIBRARY_CHANGED_EVENT, onRefresh);
      window.removeEventListener("focus", onRefresh);
      window.removeEventListener("pageshow", onRefresh);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [refresh]);

  return (
    <main className="standalone-studio-surface" data-reports-workspace="library-ppf"
      style={{ minHeight: "100vh", maxWidth: "100%" }}>
      <LibraryPpfReportsWorkspace
        project={project} selectedId={selectedId} authorizedProfileId={authorizedProfileId} checked={checked}
        section={section} onSectionChange={changeSection} onRefresh={refresh}
        onBackDashboard={onBackDashboard} onOpenLibrary={onOpenLibrary}
      />
    </main>
  );
}
