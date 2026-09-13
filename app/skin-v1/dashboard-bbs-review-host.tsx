"use client";

import { useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import DashboardBbsPanel, { type DashboardBbsItem } from "./dashboard-bbs-panel";
import HelpIssueLogSkinPanel from "./help-issue-log-skin-panel";
import OpenSourceSkinPanel from "./open-source-skin-panel";
import reviewStyles from "./dashboard-bbs-review-host.module.css";

export default function DashboardBbsReviewHost({
  items,
  selectedIndex,
  onActivate,
  onKeyDown,
  setItemRef,
}: {
  readonly items: readonly DashboardBbsItem[];
  readonly selectedIndex: number;
  readonly onActivate: (index: number) => void;
  readonly onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => void;
  readonly setItemRef: (index: number, node: HTMLButtonElement | null) => void;
}) {
  const [openSourceOpen, setOpenSourceOpen] = useState(false);
  const [helpIssueLogOpen, setHelpIssueLogOpen] = useState(false);

  function restoreDashboardFocus(itemId: string) {
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(`[data-dashboard-menu-item="${itemId}"]`)?.focus();
    });
  }

  function closeOpenSource() {
    setOpenSourceOpen(false);
    restoreDashboardFocus("open-source");
  }

  function closeHelpIssueLog() {
    setHelpIssueLogOpen(false);
    restoreDashboardFocus("help");
  }

  function activateItem(index: number) {
    const item = items[index];
    if (!item) return;
    if (item.id === "open-source") {
      onActivate(index);
      setOpenSourceOpen(true);
      return;
    }
    if (item.id === "help") {
      onActivate(index);
      setHelpIssueLogOpen(true);
      return;
    }
    onActivate(index);
  }

  if (openSourceOpen) {
    return (
      <section aria-label="Open Source" data-dashboard-review-surface="open-source" onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); closeOpenSource(); }
      }}>
        <div className="pp-skin-v1-bbs-banner">
          <h1>OPEN SOURCE</h1>
          <button type="button" className="pp-skin-v1-return" onClick={closeOpenSource}>Back to Dashboard</button>
        </div>
        <OpenSourceSkinPanel />
      </section>
    );
  }

  if (helpIssueLogOpen) {
    return (
      <section aria-label="Help / Issue Log" data-dashboard-review-surface="help" onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); closeHelpIssueLog(); }
      }}>
        <div className="pp-skin-v1-bbs-banner">
          <h1>HELP / ISSUE LOG</h1>
          <button type="button" className="pp-skin-v1-return" onClick={closeHelpIssueLog}>Back to Dashboard</button>
        </div>
        <HelpIssueLogSkinPanel />
      </section>
    );
  }

  return (
    <div className={reviewStyles.reviewHost}>
      <DashboardBbsPanel
        items={items}
        selectedIndex={selectedIndex}
        onActivate={activateItem}
        onKeyDown={onKeyDown}
        setItemRef={setItemRef}
      />
    </div>
  );
}
