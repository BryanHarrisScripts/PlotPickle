"use client";

import { useEffect } from "react";
import {
  createLibraryWorkingCopy,
  listLibraryProjects,
  switchActiveLibraryProject,
} from "@/core/storage/project-library-browser";

const SOURCE_ID = "afterglow-v9";
const TITLE = "Afterglow: Reflections of Sentience";

export const AFTERGLOW_REPRESENTATIVE_FIXTURE_QUERY = "representative";
export const AFTERGLOW_REPRESENTATIVE_FIXTURE_VALUE = "afterglow";

async function prepareAfterglowRepresentativeFixture() {
  const existing = listLibraryProjects().find((item) => (
    !item.archivedAt
    && item.sourceKind === "example"
    && item.sourceId === SOURCE_ID
  ));

  const project = existing
    ? switchActiveLibraryProject(existing.id)
    : createLibraryWorkingCopy({
      sourceProject: (await import("@/modules/library/reference/afterglow-v9-foundations")).createAfterglowV9FoundationsReference(),
      sourceKind: "example",
      sourceId: SOURCE_ID,
      title: TITLE,
      genre: "Science Fiction · Drama",
      format: "Screenplay · v9 reference",
    });

  document.documentElement.dataset.plotpickleRepresentativeFixture = AFTERGLOW_REPRESENTATIVE_FIXTURE_VALUE;
  document.documentElement.dataset.plotpickleRepresentativeProjectId = project.id;
  document.documentElement.dataset.plotpickleRepresentativeStoryAddress = "17.1";
  window.dispatchEvent(new CustomEvent("plotpickle:representative-fixture-ready", {
    detail: { sourceId: SOURCE_ID, projectId: project.id, block: 17, mini: 1 },
  }));
}

export default function AfterglowRepresentativeFixture() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get(AFTERGLOW_REPRESENTATIVE_FIXTURE_QUERY) !== AFTERGLOW_REPRESENTATIVE_FIXTURE_VALUE) return;
    void prepareAfterglowRepresentativeFixture();
  }, []);
  return null;
}
