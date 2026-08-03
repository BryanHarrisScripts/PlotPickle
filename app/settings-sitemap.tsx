"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { ConnectionStatusSnapshot, ConnectionState } from "@/lib/connection-status";
import {
  COLLABORATION_NAVIGATION,
  PRIMARY_WORKFLOW_NAVIGATION,
  type ProductNavigationId,
} from "@/lib/product-direction";
import { SUPPORT_NAVIGATION } from "@/lib/support-navigation";
import styles from "./settings-sitemap.module.css";

type SettingsStatus = "installed" | "configure" | "optional" | "planned" | "reference";

type SettingsMapItem = {
  id: string;
  label: string;
  description: string;
  helpTerm: string;
  status: SettingsStatus;
  target?: string;
  href?: string;
};

type SettingsMapGroup = {
  id: string;
  label: string;
  description: string;
  items: SettingsMapItem[];
};

type SettingsTaxonomy = {
  workspace: SettingsMapItem[];
  systems: SettingsMapGroup[];
};

type BuzzStatus = "checking" | "ready" | "setup" | "unavailable";

type SitemapStatus = {
  label: string;
  tone: "ready" | "attention" | "muted";
  detail: string;
};

const SETTINGS_STATUS_LABELS: Record<SettingsStatus, string> = {
  installed: "Installed",
  configure: "Configure",
  optional: "Optional",
  planned: "Planned",
  reference: "Reference",
};

const CONNECTION_LABELS: Record<ConnectionState, SitemapStatus> = {
  connected: { label: "Connected", tone: "ready", detail: "The optional connection is available now." },
  configured: { label: "Configured", tone: "ready", detail: "Configuration exists; test it before relying on remote work." },
  checking: { label: "Checking", tone: "attention", detail: "PlotPickle is checking the local connection." },
  error: { label: "Needs attention", tone: "attention", detail: "Open the destination to review repair guidance." },
  unavailable: { label: "Unavailable here", tone: "muted", detail: "The downloaded local server may be required for this check." },
  disabled: { label: "Disabled", tone: "muted", detail: "This optional provider is currently disabled." },
  disconnected: { label: "Not connected", tone: "muted", detail: "Core local PlotPickle remains available without this connection." },
};

function workspaceStatus(id: string, connections: ConnectionStatusSnapshot, buzzStatus: BuzzStatus): SitemapStatus {
  if (id === "community") {
    if (buzzStatus === "ready") return { label: "Buzz connected", tone: "ready", detail: "Community collaboration is available." };
    if (buzzStatus === "checking") return { label: "Checking Buzz", tone: "attention", detail: "PlotPickle is checking Buzz Desktop and the saved community." };
    if (buzzStatus === "unavailable") return { label: "Local check unavailable", tone: "muted", detail: "Buzz remains optional; open Settings to review the installation boundary." };
    return { label: "Buzz setup optional", tone: "muted", detail: "Connect Buzz only when a Writers’ Room is needed." };
  }
  if (id === "collab") {
    const github = connections.items.github;
    const mapped = CONNECTION_LABELS[github.state];
    return { ...mapped, label: github.state === "connected" || github.state === "configured" ? `GitHub ${mapped.label.toLowerCase()}` : "Connections optional" };
  }
  return { label: "Available", tone: "ready", detail: "This workspace is part of the installed local PlotPickle application." };
}

function settingsStatus(item: SettingsMapItem, connections: ConnectionStatusSnapshot, buzzStatus: BuzzStatus): SitemapStatus {
  if (item.target === "buzz") {
    if (buzzStatus === "ready") return { label: "Buzz connected", tone: "ready", detail: "Buzz Desktop, identity and community are ready." };
    if (buzzStatus === "checking") return { label: "Checking Buzz", tone: "attention", detail: "PlotPickle is checking the optional Buzz runtime." };
    return { label: "Buzz setup optional", tone: "muted", detail: "Open this destination to configure or inspect Buzz." };
  }

  const connectionId = item.target === "github"
    ? "github"
    : item.target === "ai"
      ? "ai"
      : item.target === "google"
        ? "google"
        : item.target === "plugins"
          ? "plugins"
          : item.target === "storage"
            ? (item.id.includes("backup") ? "backups" : "storage")
            : null;

  if (connectionId) {
    const connection = connections.items[connectionId];
    const mapped = CONNECTION_LABELS[connection.state];
    return {
      ...mapped,
      detail: connection.detail || mapped.detail,
    };
  }

  const label = SETTINGS_STATUS_LABELS[item.status];
  return {
    label,
    tone: item.status === "installed" || item.status === "configure" ? "ready" : item.status === "planned" ? "attention" : "muted",
    detail: item.status === "planned"
      ? "The system is named for planning but no connector is active yet."
      : item.status === "reference"
        ? "Open the reference to understand the installed boundary."
        : "Open this Settings destination to review or configure it.",
  };
}

function StatusBadge({ status }: { status: SitemapStatus }) {
  return (
    <span className={styles.status} data-tone={status.tone} title={status.detail}>
      <i aria-hidden="true" />
      {status.label}
    </span>
  );
}

function SiteCard({
  label,
  description,
  status,
  action,
  meta,
}: {
  label: string;
  description: string;
  status: SitemapStatus;
  action: ReactNode;
  meta?: string;
}) {
  return (
    <article className={styles.card}>
      <div className={styles.cardHeading}>
        <div>
          {meta ? <span className={styles.meta}>{meta}</span> : null}
          <h3>{label}</h3>
        </div>
        <StatusBadge status={status} />
      </div>
      <p>{description}</p>
      <div className={styles.cardAction}>{action}</div>
    </article>
  );
}

export default function SettingsSitemap({
  taxonomy,
  connections,
  buzzStatus,
  onOpenWorkspace,
  onOpenSettingsItem,
  onOpenSettingsOverview,
}: {
  taxonomy: SettingsTaxonomy;
  connections: ConnectionStatusSnapshot;
  buzzStatus: BuzzStatus;
  onOpenWorkspace: (id: ProductNavigationId) => void;
  onOpenSettingsItem: (id: string) => void;
  onOpenSettingsOverview: () => void;
}) {
  const settingsItems = [
    ...taxonomy.workspace.map((item) => ({ item, group: "Workspace" })),
    ...taxonomy.systems.flatMap((group) => group.items.map((item) => ({ item, group: group.label }))),
  ];

  return (
    <main className={styles.sitemap} aria-labelledby="settings-sitemap-title">
      <header className={styles.hero}>
        <div>
          <p>Settings → Sitemap</p>
          <h2 id="settings-sitemap-title">Open any PlotPickle workspace from one map.</h2>
          <span>The map is generated from PlotPickle’s canonical workflow, collaboration and Settings registries so labels and destinations stay aligned as the product grows.</span>
        </div>
        <button type="button" onClick={onOpenSettingsOverview}>Open Settings overview</button>
      </header>

      <section className={styles.section} aria-labelledby="sitemap-story-workflow">
        <header><span>01</span><div><h2 id="sitemap-story-workflow">Story workflow</h2><p>Move from learning and planning through visual development, writing, review and production evidence.</p></div></header>
        <div className={styles.grid}>
          {PRIMARY_WORKFLOW_NAVIGATION.map((item) => (
            <SiteCard
              key={item.id}
              label={item.label}
              description={item.description}
              status={workspaceStatus(item.id, connections, buzzStatus)}
              action={<button type="button" onClick={() => onOpenWorkspace(item.id)}>Open {item.label}</button>}
            />
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="sitemap-collaboration">
        <header><span>02</span><div><h2 id="sitemap-collaboration">Collaboration and product feedback</h2><p>Review proposals, connect optional community tools and send structured product feedback without changing story canon automatically.</p></div></header>
        <div className={styles.grid}>
          {COLLABORATION_NAVIGATION.map((item) => (
            <SiteCard
              key={item.id}
              label={item.label}
              description={item.description}
              status={workspaceStatus(item.id, connections, buzzStatus)}
              action={<button type="button" onClick={() => onOpenWorkspace(item.id)}>Open {item.label}</button>}
            />
          ))}
          {SUPPORT_NAVIGATION.map((item) => (
            <SiteCard
              key={item.id}
              label={item.label}
              description={item.description}
              status={{ label: "GitHub access required", tone: "muted", detail: "The official repository must be public or your GitHub account must have access." }}
              action={<Link href={item.href}>Open {item.label}</Link>}
            />
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="sitemap-configuration">
        <header><span>03</span><div><h2 id="sitemap-configuration">Configuration</h2><p>Open every Settings area, including local runtime, storage, credentials, GitHub, Google, Buzz, AI and media-engine boundaries.</p></div></header>
        <div className={styles.grid}>
          {settingsItems.map(({ item, group }) => (
            <SiteCard
              key={`${group}-${item.id}`}
              label={item.label}
              description={item.description}
              meta={group}
              status={settingsStatus(item, connections, buzzStatus)}
              action={<button type="button" onClick={() => onOpenSettingsItem(item.id)}>Open {item.label}</button>}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
