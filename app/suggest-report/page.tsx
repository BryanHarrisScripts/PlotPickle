import Link from "next/link";
import SuggestReportWorkspace from "../suggest-report-workspace";

export default function SuggestReportPage() {
  return (
    <main>
      <div style={{ padding: "18px 22px 0" }}>
        <Link href="/?workspace=dashboard">← Back to Dashboard</Link>
      </div>
      <SuggestReportWorkspace />
    </main>
  );
}
