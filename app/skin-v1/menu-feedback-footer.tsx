import DashboardReadinessRail from "./dashboard-readiness-rail";
import styles from "./menu-feedback-footer.module.css";

type MenuFeedbackFooterProps = Readonly<{
  id: string;
  label: string;
  available: boolean;
  review?: boolean;
  unavailableReason?: string;
}>;

export default function MenuFeedbackFooter({ id, label, available, review = false, unavailableReason }: MenuFeedbackFooterProps) {
  const availableAction = available
    ? `ENTER → OPEN ${label.toUpperCase()}`
    : `ENTER → ${label.toUpperCase()} UNAVAILABLE${unavailableReason ? ` — ${unavailableReason.toUpperCase()}` : ""}`;
  const action = review ? `ENTER → OPEN ${label.toUpperCase()} · IN REVIEW` : availableAction;
  const dashboardFooter = id === "dashboard-menu-status";

  return (
    <div className={`pp-skin-v1-bbs-help ${styles.footer}`} data-menu-feedback="contextual">
      <span>UP/DOWN OR SHORTCUT KEY: SELECT</span>
      <span id={id} role="status" aria-live="polite" aria-atomic="true">{action}</span>
      {dashboardFooter ? <span className={styles.dashboardReserve} aria-hidden="true">BUZZ COMMUNITY MODELS COMFY LOCAL CLOUD</span> : null}
      {dashboardFooter ? <span className={styles.dashboardReadiness}><DashboardReadinessRail /></span> : null}
    </div>
  );
}
