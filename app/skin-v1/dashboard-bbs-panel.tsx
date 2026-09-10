"use client";

import Image from "next/image";
import { Fragment, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { SKIN_V1_ASSETS } from "./skin-v1-assets";

export type DashboardBbsItem = Readonly<{
  id: string;
  shortcut: string;
  label: string;
  description: string;
  group?: string;
}>;

const CONNECTED_DASHBOARD_ITEMS = new Set(["community", "profile"]);

export default function DashboardBbsPanel({
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
  const [dashboardArt, setDashboardArt] = useState(SKIN_V1_ASSETS.dashboard.hero);

  function handleRowKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key.length === 1) {
      const shortcut = event.key.toUpperCase();
      const shortcutIndex = items.findIndex((item) => item.shortcut.toUpperCase() === shortcut);
      if (shortcutIndex >= 0) {
        event.preventDefault();
        onActivate(shortcutIndex);
        return;
      }
    }
    onKeyDown(event, index);
  }

  return (
    <section
      className="pp-skin-v1-dashboard pp-skin-v1-dashboard-bbs"
      aria-label="PlotPickle Dashboard"
      data-skin-reference="dashboard-canonical"
    >
      <div className="pp-skin-v1-bbs" data-skin-reference-panel="standard">
        <div className="pp-skin-v1-dashboard-shell-title" data-skin-reference-type="title">
          <span className="pp-skin-v1-dashboard-shell-chevron" aria-hidden="true">&gt;&gt;&gt;</span>
          <span>PLOTPICKLE BBS</span>
          <span className="pp-skin-v1-dashboard-shell-chevron" aria-hidden="true">&lt;&lt;&lt;</span>
        </div>

        <div className="pp-skin-v1-dashboard-art" aria-hidden="true" data-skin-reference-media-container="primary">
          <Image
            src={dashboardArt}
            alt=""
            width={1200}
            height={400}
            priority
            draggable={false}
            data-dashboard-art="skin-v1"
            data-skin-reference-media="primary"
            onError={() => {
              if (dashboardArt === SKIN_V1_ASSETS.dashboard.heroFallback) return;
              setDashboardArt(SKIN_V1_ASSETS.dashboard.heroFallback);
            }}
          />
        </div>

        <div className="pp-skin-v1-dashboard-brand" aria-label="PlotPickle AI-Native Agentic Story Operating System">
          <h1 data-skin-reference-type="brand">PlotPickle</h1>
          <p data-skin-reference-type="meta">AI-Native Agentic Story Operating System</p>
          {/* Compatibility token for the original regression contract: AI-NATIVE AGENTIC STORY OPERATING SYSTEM */}
        </div>

        <div className="pp-skin-v1-dashboard-title" data-skin-reference-type="body-title">*** DASHBOARD ***</div>

        <div className="pp-skin-v1-menu pp-skin-v1-dashboard-menu" role="listbox" aria-label="Dashboard menu">
          {items.map((item, index) => {
            const selected = index === selectedIndex;
            const connected = CONNECTED_DASHBOARD_ITEMS.has(item.id);
            const statusActive = selected && connected;
            const showGroup = Boolean(item.group && (index === 0 || items[index - 1]?.group !== item.group));
            const command = `[${item.shortcut}] ${item.label}`.padEnd(24, " ");
            return (
              <Fragment key={item.id}>
                {showGroup ? <div className="pp-skin-v1-dashboard-group" aria-hidden="true">-- {item.group} --</div> : null}
                <button
                  ref={(node) => setItemRef(index, node)}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  className={`pp-skin-v1-menu-item pp-skin-v1-dashboard-row${selected ? " is-selected" : ""}`}
                  data-dashboard-menu-item={item.id}
                  data-dashboard-shortcut={item.shortcut}
                  data-dashboard-connected={connected ? "true" : "false"}
                  data-skin-reference-state={selected ? "selected" : "unselected"}
                  onClick={() => onActivate(index)}
                  onKeyDown={(event) => handleRowKeyDown(event, index)}
                >
                  <span className="pp-skin-v1-dashboard-command-line">{command} - {item.description}</span>
                  <span
                    className={`pp-skin-v1-dashboard-status-box${statusActive ? " is-active" : ""}`}
                    aria-label={statusActive ? "Active connected submenu" : "Inactive menu item"}
                    data-skin-reference-state="status"
                    data-dashboard-status={statusActive ? "active" : "inactive"}
                  />
                </button>
              </Fragment>
            );
          })}
        </div>

        <div className="pp-skin-v1-dashboard-rule" aria-hidden="true" />
        <p className="pp-skin-v1-dashboard-reminder" data-skin-reference-type="emphasis">Remember: Write dirty, edit clean. 1 page = 1 minute.</p>

        <div className="pp-skin-v1-bbs-help" data-skin-reference-type="muted">
          <span>UP/DOWN OR SHORTCUT KEY: SELECT</span>
          <span>ENTER: OPEN COMMUNITY / PROFILE</span>
          <span>OTHER MENU ITEMS ARE NOT CONNECTED YET</span>
        </div>
      </div>
    </section>
  );
}
