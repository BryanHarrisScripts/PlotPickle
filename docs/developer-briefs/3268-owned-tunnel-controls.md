# #3268 — owner Tunnel lifecycle controls

This focused slice adds Stop, Recheck and Clear Stale Session to the existing local Start path under Settings → Compute → Tunnel. The authenticated loopback/profile/recent-reauthentication boundary remains authoritative. No caller PID, path, executable or shell text is accepted.

Only the PowerShell child handle created by this running application session grants Stop authority. A completed owned-tree stop is distinguished from an occupied, unidentified MCP port. Exited launcher handles become visibly stale; Clear Stale Session drops that dead in-memory handle and does not delete any file or stop any listener. App restart deliberately discards process ownership instead of adopting stale PIDs or separately started launchers. Those remain controlled in their owning terminal.

PR TEST can locate the separately provisioned launcher in its canonical main checkout through local Git worktree metadata, only with the pinned PlotPickle repository origin, a main branch and the existing regular-file/realpath checks. It never copies the launcher or reads its contents. Credentials remain in the native hidden prompt and are not inherited from service/provider secrets.

Launcher presence, observed child, local port occupancy, remote authorization and product acceptance remain distinct. None of these controls establish a bilateral conversation or report remote green. Uncertain TCP errors/timeouts block competing startup. This code runs through the local application and does not require the authenticated tunnel or a Factory worker to function.

Fixtures cover owned start/stop, concurrent launches, exited handles, restart/external ownership rejection, stop failure, mutation authentication and argument/origin rejection. Native Windows terminal/control acceptance remains separate from those fixtures and from a successful build/CI run.

Remaining #3268 scope: independent Story, Software and Learning & Evolution startup/status contracts and local operator surfaces, durable service reconciliation where independently owned, and actual Windows acceptance. #3258/#3259 retain the genuine external question/answer and independently verified directional receipts; this slice does not claim those are implemented.
