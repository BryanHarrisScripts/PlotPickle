"use client";

import { useEffect, useState } from "react";
import ReportsWorkspace from "../reports-workspace";
import {
  CONSOLIDATED_REPORT_SECTIONS,
  type ConsolidatedReportSection,
  type ReportTarget,
} from "@/lib/consolidated-reports";
import {
  PRODUCTION_REPORT_SECTIONS,
  type ProductionReportSection,
} from "@/lib/production-reports";
import {
  createBlankProject,
  normalizePlotPickleProject,
  type PlotPickleProject,
} from "@/lib/projects/project";

const STORAGE_KEY = "plotpickle.project.v1";

function requestedReportSection(value: string | null): ConsolidatedReportSection {
  return CONSOLIDATED_REPORT_SECTIONS.some((item) => item.id === value)
    ? value as ConsolidatedReportSection
    : "project";
}

function requestedProductionSection(value: string | null): ProductionReportSection {
  return PRODUCTION_REPORT_SECTIONS.some((item) => item.id === value)
    ? value as ProductionReportSection
    : "overview";
}

function targetHref(target: ReportTarget) {
  if (target.workspace === "dashboard") return "/skin-v1";
  if (target.workspace === "plan") return "/?workspace=plan";
  if (target.workspace === "build") return "/?workspace=build";
  if (target.workspace === "write") return "/write";
  if (target.workspace === "storyboard") return "/storyboard";
  if (target.workspace === "refine") return "/diagnostics";
  if (target.workspace === "feedback") return "/feedback";
  if (target.workspace === "settings") return "/?workspace=settings";
  return "/reports";
}

export default function ReportsPage() {
  const [project, setProject] = useState<PlotPickleProject>(() => createBlankProject());
  const [section, setSection] = useState<ConsolidatedReportSection>("project");
  const [productionSection, setProductionSection] = useState<ProductionReportSection>("overview");
  const [status, setStatus] = useState("Loading the active PlotPickle project…");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const parameters = new URLSearchParams(window.location.search);
      setSection(requestedReportSection(parameters.get("section")));
      setProductionSection(requestedProductionSection(parameters.get("productionSection")));
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          setStatus("No saved project was found. Reports is showing the blank canonical project.");
          return;
        }
        const normalized = normalizePlotPickleProject(JSON.parse(stored));
        if (!normalized) {
          setStatus("The saved project could not be upgraded. Reports is showing the blank project instead.");
          return;
        }
        setProject(normalized);
        setStatus("Reports is reading the active canonical PlotPickle project.");
      } catch {
        setStatus("The saved project could not be opened. Reports is showing the blank project instead.");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function openTarget(target: ReportTarget) {
    window.location.assign(targetHref(target));
  }

  return (
    <main
      className="standalone-studio-surface"
      data-reports-workspace="canonical"
      style={{ minHeight: "100vh" }}
    >
      <ReportsWorkspace
        project={project}
        section={section}
        onSectionChange={setSection}
        productionSection={productionSection}
        onProductionSectionChange={setProductionSection}
        onOpenTarget={openTarget}
      />
      <p aria-live="polite" style={{ margin: "0 16px 16px" }}>{status}</p>
    </main>
  );
}
