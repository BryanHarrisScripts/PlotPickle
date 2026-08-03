# PlotPickle public release checklist

Use this checklist before changing the repository from private to public. The configuration script is intentionally a dry run unless `-Apply` is supplied, and it does not change visibility unless `-MakePublic` is also supplied.

## 1. Repository contents

- [ ] `npm run audit:public-readiness` passes on the exact commit to publish.
- [ ] `Public history readiness / Full history audit` passes from a complete clone.
- [ ] Quality, Phase 1, Public Readiness, Public Security, Release Candidate, Repomix and Full History are green.
- [ ] No API keys, OAuth client secrets, tokens, signing keys, certificates or `.env` files exist in the working tree or reachable Git history.
- [ ] Any invitation URL previously committed—including Buzz community invitations—has been revoked or rotated before a narrowly scoped historical exception is recorded.
- [ ] Current public source contains no live community invitation; an optional invite may be supplied only through `NEXT_PUBLIC_PLOTPICKLE_BUZZ_INVITE_URL` in a controlled private build.
- [ ] No unpublished story projects, PPF backups, private images, personal information or diagnostic archives are committed.
- [ ] Afterglow is clearly identified as the read-only PlotPickle example and not as a destination for user work.
- [ ] Licensing, trademarks, contribution terms and the security policy are current.

## 2. GitHub administration

Run the configurator first as a dry run:

```powershell
pwsh ./scripts/configure-public-repository.ps1 -Repository BryanHarrisScripts/PlotPickle
```

Apply settings while keeping the repository private:

```powershell
pwsh ./scripts/configure-public-repository.ps1 -Repository BryanHarrisScripts/PlotPickle -Apply
```

After reviewing every result, publish and apply the public-only security settings:

```powershell
pwsh ./scripts/configure-public-repository.ps1 -Repository BryanHarrisScripts/PlotPickle -Apply -MakePublic
```

Confirm in GitHub Settings:

- [ ] `main` requires pull requests and the eight required CI checks, including Full History Audit.
- [ ] Force pushes and branch deletion are blocked.
- [ ] Conversations must be resolved before merge.
- [ ] Secret scanning and push protection are enabled.
- [ ] Private vulnerability reporting is enabled.
- [ ] Dependabot alerts, security updates and version updates are enabled.
- [ ] Discussions are enabled and the security contact route is private.
- [ ] Merge commits and rebase merges are disabled; squash merge is enabled.
- [ ] Branches are deleted automatically after merge.

## 3. Public presentation

- [ ] Repository description, topics and README accurately describe the local-first product.
- [ ] The README explains that Ollama, ComfyUI and local projects require no PlotPickle account.
- [ ] Cloud providers, Buzz and GitHub are described as optional bring-your-own-account services.
- [ ] Screenshots contain no personal story material or credentials.
- [ ] Issue forms, pull-request template, Code of Conduct, contribution guidance and security policy render correctly.

## 4. First stable release

- [ ] Update the version and release notes.
- [ ] Create an annotated `v*` tag only from a fully green `main` commit.
- [ ] Confirm the release workflow publishes Windows, macOS and Linux archives plus `SHA256SUMS.txt`.
- [ ] Download each archive from the public Releases page and verify its checksum.
- [ ] Install the Windows archive on a clean user account and test Ollama, ComfyUI and Buzz detection.
- [ ] Perform optional OpenAI and MiniMax BYOK tests with low-cost requests and revoked test credentials afterward.

## 5. After publication

- [ ] Review the Security and Insights tabs for alerts.
- [ ] Confirm no private forks, artifacts, caches or workflow logs expose sensitive material.
- [ ] Confirm the issue tracker and Discussions moderation settings.
- [ ] Keep real writer projects in their own private repositories unless the writer explicitly chooses otherwise.
