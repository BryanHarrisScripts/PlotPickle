# #3241 — bounded storage inventory and retention preview

This slice adds a local, metadata-only report before any cleanup implementation. It preserves the existing capacity preflight and does not close #3241.

Run `node scripts/engineering-team/queue/storage/report.mjs` locally. It reports immediate children of the persistent runtime, npm cache, engineering-team and repository artifact roots, with aggregate file counts, timestamps, lossless apparent byte totals, free-space observations and progress. It does not read screenplay, project, evidence or credential contents. No file is created, changed or removed by the report.

Traversal rejects redirected roots/ancestors, skips symbolic links and Windows junctions, deduplicates usable inode identities within each root, and bounds entries, depth and total elapsed time. Missing, blocked and partial roots have distinct states; partial totals are lower bounds. These are best-effort observations of a changing filesystem, not a snapshot or an ownership attestation. Apparent bytes cannot establish how many bytes deletion would release.

If an isolated verification app home is nested beneath repository artifacts, the report explicitly omits the broader artifact root rather than traversing overlapping scopes or failing the whole command. `excludedRoots` names that omission. Actual owner storage and synthetic verification homes remain different evidence scopes.

Retention is preview-only. Factory directories, evidence, artifacts, caches and unidentified or special runtimes are protected. A retirement candidate requires a complete inventory and host-verified ownership plus process/task/worktree references, an active runtime, distinct fallback and ten explicitly selected historical runtimes. The current CLI does not collect that reference evidence and therefore retains everything. There is no deletion operation, no automatic cleanup, and no claim that proposed candidates authorize deletion.

Expected checks: fixture counts and byte totals; hard-link deduplication; outside links and redirected parents; bounded traversal and incomplete states; no content reads or mutation; protected evidence, projects and unclassified Factory children; missing reference evidence; retention of active/fallback/selected historical/referenced runtimes. Approved White Paper v3 sections 8 and 9 govern independent evidence and regression scope. Static/fixture and Windows filesystem results remain distinct from owner storage acceptance.

Remaining #3241 work: actual owner-Windows inventory, independent process/task/worktree ownership collection, durable reservations before every install, interrupted-install lifecycle, Settings/Operations presentation and separately approved cleanup batches. The CLI is not an MCP tool and does not grant remote arbitrary-path access.
