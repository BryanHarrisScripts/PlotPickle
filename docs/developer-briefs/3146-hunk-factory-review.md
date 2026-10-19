# #3146 — Hunk 0.23 in the Software Factory (manual advisory review)

Parent #3110, first pilot #3141. Source: https://www.hunk.dev/changelog/0.23/ .

## Already installed in PlotPickle source

PlotPickle already owns the Hunk 0.23.x integration in `build/dsdd/hunk-review-controller.mjs`, `build/dsdd/hunk-review-gateway.ts`, and `scripts/pi/hunk-review-terminal.ps1`. The pinned optional npm proof package is `tools/hunk-review/package.json` with `hunkdiff` **0.23.0** and the reviewed `shell-quote` 1.11.0 security override. Do not install a second tool at product startup, silently update to the Hunk 0.24 prerelease, change the root dependency graph, or remove the security override.

Hunk 0.23 bundles `hunk gh` for GitHub PRs, search within diffs, an inline status line and daemon-build-mismatch diagnostics. These are **human review conveniences**, not deterministic verifier results.

## Integration in the Software Factory

New operator-only CLI, using the existing 0.23.x version probe and native PowerShell launch bridge:

```powershell
cd C:\Users\bryan\plotpickle
node scripts/engineering-team/review/factory-hunk.mjs --status
node scripts/engineering-team/review/factory-hunk.mjs --pr 3145
```

Replace 3145 with an actual factory-generated PR number. A generated factory DRAFT PR description now points to the same command. The adapter admits only a positive integer PR, uses the **fixed** PlotPickle repository, disables Hunk extensions, passes no GitHub issue body, notes, URLs, shell script or arbitrary revision into its arguments and requires a local operator to issue each launch. The owned native bridge is the same reviewed one used by PlotPickle Settings / Command.

If Hunk 0.23.x is not installed or not on PATH, `--status` reports unavailable. Nothing is auto-installed. After launch, close the Hunk review window to end the operator review. The CLI currently does not persist an independent review/cancellation session across invocations; application Settings / Command owns its own authenticated profile-scoped start/stop flow.

## Verification/merge truth

A Hunk review is always **advisory**: it cannot create a source patch, run Pi inference, auto-approve tests or Story Factory data, mark a Windows browser UAT PASS, authorize a merge, or close a GitHub issue. The existing independent BEN, W8/W9, seven-layer exact-head CI, required reviews, native Product Gate and scope policies remain authoritative.

The first acceptance is (1) CLI negative-argument and fixture launch tests, (2) exact SHA-256-bound test catalog, (3) independent GitHub CI, and (4) an actual owner Windows `--status` and optional review window launch for an existing non-sensitive PR. The tests cannot prove native review window appearance or product acceptance. #3141 should continue as the deliberately bounded docs-only local Pi execution pilot.

The future Factory GUI integration should reuse the profile-locked Settings/Command Hunk gateway rather than silently opening a terminal from the autonomous worker.
