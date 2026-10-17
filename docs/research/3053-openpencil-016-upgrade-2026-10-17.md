# OpenPencil 0.16.0 managed upgrade — #3053 / #3024

Reviewed release: https://github.com/open-pencil/open-pencil/releases/tag/v0.16.0
Upstream release timestamp: 2026-10-14T12:37:16Z
Upgrade target: 0.15.1 -> 0.16.0 (CLI, MCP, Windows desktop x64).
Upstream GitHub release API SHA-256: `OpenPencil_0.16.0_x64-setup.exe` = `1b851ac488ce9be437f8b321cadb87ee169f9a1d11968d8e8be87742c9d4df4b`.
The asset is downloaded from the version-specific upstream release and SHA-256 verified before executing `/S`. No executable is included in this repository.
Upstream tagged package declarations confirm `@open-pencil/cli@0.16.0` bin `bin/openpencil.js` and `@open-pencil/mcp@0.16.0` HTTP bin `dist/index.mjs`.

## Behaviour and compatibility
- Three managed components advance together: CLI, HTTP MCP, desktop version and pinned SHA-256. Local package preparation stays after PlotPickle core readiness. No design or MCP server is launched automatically.
- Desktop checks ProductVersion/FileVersion instead of accepting any older executable as current. An already running OpenPencil app defers installer execution rather than interrupting a design session.
- Explicit user-managed executable override is not replaced. Version mismatch is reported as a warning instead of a false ready result.
- OpenPencil upstream 0.16 changes JSX `render` transport, argument validation, `.fig` field compatibility, and rooms. PlotPickle uses managed CLI/MCP entrypoints and does not generate legacy pre-rendered JSX tool payloads; keep 0.15 designs under Human review on first opening. Do not silently migrate private design files or join shared rooms.
- None of this grants provider, cloud, project, source-write, or merge authority.

## Verification gate
Focused Node contracts: `node --test tests/issue-2778-openpencil-design-tool.test.mjs tests/issue-2782-openpencil-profile-startup.test.mjs tests/issue-2787-openpencil-gui-review.test.mjs`.
Then execute the impact-selected CI, build, security/OSS, Windows install/cold-start and explicitly scoped OpenPencil Command status/open/review proofs on exact PR head.
Linux source inspection and version matching **do not** constitute Windows GUI installation or a successful live 0.16 design session. Keep the PR unmerged until those facts are established.
