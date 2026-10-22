"use client";

import { useCallback, useEffect, useState } from "react";
import LibraryPpfReportsWorkspace from "./library-ppf-reports-workspace";
import {
  PROJECT_LIBRARY_CHANGED_EVENT,
  PROJECT_LIBRARY_ACTIVE_PROFILE_KEY,
  loadLibraryProjectSnapshot,
  sessionActiveProjectId,
} from "@/core/storage/project-library-browser";
import type { LibraryPPFProject } from "@/core/storage/library-project";
import { profilePrivateBrowserReadyFor } from "@/core/storage/profile-private-browser";
import { resolveActiveLibraryReportsProject } from "@/modules/reports/model/library-ppf-report.mjs";
import { CONSOLIDATED_REPORT_SECTIONS, type ConsolidatedReportSection } from "@/lib/consolidated-reports";

function requestedReportSection(value: string | null): ConsolidatedReportSection {
  return CONSOLIDATED_REPORT_SECTIONS.some((item) => item.id === value)
    ? value as ConsolidatedReportSection
    : "project";
}

export default function ReportsPage() {
  const [project, setProject] = useState<LibraryPPFProject | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [authorizedProfileId, setAuthorizedProfileId] = useState<string | null>(null);
  const [section, setSection] = useState<ConsolidatedReportSection>("project");
  const [checked, setChecked] = useState(false);

  const refresh = useCallback(() => {
    const activeProjectId = sessionActiveProjectId();
    const profileId = window.sessionStorage.getItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY)?.trim() || "";
    setAuthorizedProfileId(profileId && profilePrivateBrowserReadyFor(profileId) ? profileId : null);
    const current = resolveActiveLibraryReportsProject({
      activeProjectId,
      loadSnapshot: loadLibraryProjectSnapshot,
    });
    setProject(current);
    setSelectedId(activeProjectId);
    setChecked(true);
  }, []);

  useEffect(() => {
    setSection(requestedReportSection(new URLSearchParams(window.location.search).get("section")));
    refresh();
    window.addEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.removeEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [refresh]);

  return (
    <main className="standalone-studio-surface" data-reports-workspace="library-ppf"
      style={{ minHeight: "100vh", maxWidth: "100%" }}>
      <LibraryPpfReportsWorkspace
        project={project} selectedId={selectedId} authorizedProfileId={authorizedProfileId} checked={checked}
        section={section} onSectionChange={setSection} onRefresh={refresh}
      />
    </main>
  );
}
