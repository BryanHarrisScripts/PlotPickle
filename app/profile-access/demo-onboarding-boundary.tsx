"use client";

import { ReactNode, useEffect, useState } from "react";
import DemoExperience from "./demo-experience";
import styles from "./demo-onboarding-boundary.module.css";

type ProfileStatusProbe = {
  readonly configured: boolean;
  readonly authenticated: boolean;
  readonly accessMode: "desktop-loopback" | "server-network";
  readonly autonomousGuest?: { readonly active?: boolean } | null;
};

type EntryMode = "probing" | "first-run" | "normal" | "demo";

function isFreshDesktop(status: ProfileStatusProbe) {
  return status.accessMode === "desktop-loopback"
    && !status.configured
    && !status.authenticated
    && !status.autonomousGuest?.active;
}

function canOfferReturningDemo(status: ProfileStatusProbe | null) {
  return status?.accessMode === "desktop-loopback"
    && status.configured
    && !status.authenticated
    && !status.autonomousGuest?.active;
}

export default function DemoOnboardingBoundary({ children }: { readonly children: ReactNode }) {
  const [status, setStatus] = useState<ProfileStatusProbe | null>(null);
  const [mode, setMode] = useState<EntryMode>("probing");
  const [returningDemoVisible, setReturningDemoVisible] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/profile", { credentials: "same-origin", cache: "no-store" })
      .then(async (result) => {
        if (!result.ok) throw new Error("Profile status unavailable");
        return result.json() as Promise<ProfileStatusProbe>;
      })
      .then((next) => {
        if (!active) return;
        setStatus(next);
        setReturningDemoVisible(canOfferReturningDemo(next));
        setMode(isFreshDesktop(next) ? "first-run" : "normal");
      })
      .catch(() => {
        if (active) setMode("normal");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (mode !== "normal" || !returningDemoVisible || !canOfferReturningDemo(status)) return;
    const dismissAfterProfileInteraction = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-profile-access-boundary="locked"] button, [data-profile-access-boundary="locked"] a, [data-profile-access-boundary="locked"] input, [data-profile-access-boundary="locked"] textarea')) {
        setReturningDemoVisible(false);
      }
    };
    window.addEventListener("click", dismissAfterProfileInteraction, true);
    return () => window.removeEventListener("click", dismissAfterProfileInteraction, true);
  }, [mode, returningDemoVisible, status]);

  if (mode === "probing") {
    return (
      <main className={styles.entry} data-demo-onboarding="probing">
        <section className={styles.card} aria-busy="true">
          <p className={styles.eyebrow}>PlotPickle</p>
          <h1>Opening the local entry…</h1>
          <p>Checking this PlotPickle Node before showing the correct local entry path.</p>
        </section>
      </main>
    );
  }

  if (mode === "demo") {
    return (
      <DemoExperience
        onExit={() => setMode(status && isFreshDesktop(status) ? "first-run" : "normal")}
        onEnterPlotPickle={() => setMode("normal")}
      />
    );
  }

  if (mode === "first-run") {
    return (
      <main className={styles.entry} data-demo-onboarding="fresh-desktop">
        <section className={styles.card}>
          <p className={styles.eyebrow}>Welcome to PlotPickle</p>
          <h1>See it work, or make it yours.</h1>
          <p>You can try a small disposable STORY world before creating a private local profile. DEMO needs no account, provider key, BUZZ identity, GitHub, Google, or Internet connection.</p>
          <div className={styles.choices}>
            <button type="button" onClick={() => setMode("demo")}>
              <strong>DEMO — See PlotPickle work</strong>
              <span>Play five prepared story decisions, see consequences change, then reset or leave with nothing private retained.</span>
            </button>
            <button type="button" onClick={() => setMode("normal")}>
              <strong>ENTER PLOTPICKLE — Create your local profile</strong>
              <span>Continue into the existing encrypted Human profile setup. No cloud account is required.</span>
            </button>
          </div>
          <small>DEMO is separate from Guest and cannot read Human profiles, credentials, private projects, BUZZ identity, connectors, or real canon.</small>
        </section>
      </main>
    );
  }

  return (
    <>
      {children}
      {returningDemoVisible && canOfferReturningDemo(status) ? (
        <button type="button" className={styles.demoShortcut} onClick={() => setMode("demo")}>
          Try DEMO
        </button>
      ) : null}
    </>
  );
}
