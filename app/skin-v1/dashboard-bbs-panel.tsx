"use client";

import { Fragment, type KeyboardEvent as ReactKeyboardEvent } from "react";

export type DashboardBbsItem = Readonly<{
  id: string;
  shortcut: string;
  label: string;
  description: string;
  group?: string;
}>;

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
  return (
    <section className="pp-skin-v1-dashboard pp-skin-v1-dashboard-bbs" aria-label="PlotPickle Dashboard">
      <div className="pp-skin-v1-bbs">
        <div className="pp-skin-v1-dashboard-shell-title">PLOTPICKLE BBS</div>

        <div className="pp-skin-v1-dashboard-art" aria-hidden="true">
          <img src="/api/skin-v1/dashboard-art" alt="" draggable={false} />
        </div>

        <div className="pp-skin-v1-dashboard-divider" aria-hidden="true">================================================================</div>

        <div className="pp-skin-v1-dashboard-brand" aria-label="PlotPickle AI-native agentic story operating system">
          <h1>PlotPickle</h1>
          <p>AI-NATIVE AGENTIC STORY OPERATING SYSTEM</p>
        </div>

        <div className="pp-skin-v1-dashboard-divider" aria-hidden="true">================================================================</div>
        <div className="pp-skin-v1-dashboard-title">*** DASHBOARD ***</div>
        <div className="pp-skin-v1-dashboard-divider" aria-hidden="true">================================================================</div>

        <div className="pp-skin-v1-menu pp-skin-v1-dashboard-menu" role="listbox" aria-label="Dashboard menu">
          {items.map((item, index) => {
            const selected = index === selectedIndex;
            const showGroup = Boolean(item.group && (index === 0 || items[index - 1]?.group !== item.group));
            const command = `[${item.shortcut}] ${item.label}`.padEnd(22, " ");
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
                  onClick={() => onActivate(index)}
                  onKeyDown={(event) => onKeyDown(event, index)}
                >
                  <span className="pp-skin-v1-dashboard-command-line">{command} - {item.description}</span>
                </button>
              </Fragment>
            );
          })}
        </div>

        <div className="pp-skin-v1-dashboard-divider pp-skin-v1-dashboard-divider-bottom" aria-hidden="true">================================================================</div>
        <p className="pp-skin-v1-dashboard-reminder">Remember: Write dirty, edit clean. 1 page = 1 minute.</p>
        <div className="pp-skin-v1-dashboard-divider" aria-hidden="true">================================================================</div>

        <div className="pp-skin-v1-bbs-help">
          <span>UP/DOWN: SELECT</span>
          <span>ENTER: OPEN COMMUNITY / PROFILE</span>
          <span>OTHER MENU ITEMS ARE NOT CONNECTED YET</span>
        </div>
      </div>
    </section>
  );
}
