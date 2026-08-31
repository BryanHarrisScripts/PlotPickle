import Link from "next/link";
import AutonomousGuestSchedulerSettings from "../../autonomous-guest-scheduler-settings";
import styles from "../../autonomous-guest-scheduler-settings.module.css";

export default function AutonomousGuestTaskSchedulerSettingsPage() {
  return (
    <main className={styles.routePage}>
      <header className={styles.routeHeader}>
        <div>
          <p>Settings → Autonomous Guest → Task Scheduler</p>
          <h1>Autonomous Guest Task Scheduler</h1>
          <span>Inspect and control durable local scheduling for the current delegated Guest run. Scheduling never grants story, Human-profile, credential or provider authority.</span>
        </div>
        <Link href="/">Back to PlotPickle</Link>
      </header>
      <AutonomousGuestSchedulerSettings />
    </main>
  );
}
