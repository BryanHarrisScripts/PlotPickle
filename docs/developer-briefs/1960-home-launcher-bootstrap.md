# #1960 — Windows home launcher bootstrap

## Why this exists

The Human starts PlotPickle from `C:\Users\bryan` using `GIT-PlotPickle.ps1`. The governed `PlotPickle.ps1` lives inside the repository at `C:\Users\bryan\PlotPickle`, so launching `./PlotPickle.ps1` from the home directory fails by design.

The home-folder launcher must therefore be a tiny bootstrap, not a second startup authority.

## Required startup order

1. Start from the Windows home directory.
2. Resolve the repository as `$HOME\PlotPickle` by default.
3. Verify Git is available and the target is a Git checkout.
4. `Set-Location` into the repository.
5. Run `git pull --ff-only` and fail closed if it cannot fast-forward safely.
6. Resolve the freshly pulled repository `PlotPickle.ps1`.
7. Delegate to that launcher.
8. Only the repository `PlotPickle.ps1` may ask the WebMCP/Human `[Y/N]` question.

This ordering guarantees the Human answers the testing-mode question against the newest launcher and newest repository code rather than a stale local copy.

## Boundaries

`GIT-PlotPickle.ps1` must not duplicate the WebMCP/Human prompt, startup implementation, app launch logic, or Skin V1 testing behavior. Those remain owned by `PlotPickle.ps1` and `Start-PlotPickle.bat`.

The bootstrap supports `-WebMCPTesting` and `-HumanTesting` only as pass-through switches for automation or explicit startup. When neither switch is supplied, the freshly pulled `PlotPickle.ps1` owns the interactive Y/N prompt.

The bootstrap must fail before launching PlotPickle when:

- Git is unavailable;
- `$HOME\PlotPickle` does not exist;
- the folder is not a Git checkout;
- `git pull --ff-only` fails; or
- the pulled repository does not contain `PlotPickle.ps1`.

No LEARN, curriculum, Journey, Agent, provider, project schema, or Phase 5 behavior is changed by #1960.

## One-time Windows placement

The tracked canonical bootstrap lives at the repository root as `GIT-PlotPickle.ps1`. The Human-facing copy may live at `C:\Users\bryan\GIT-PlotPickle.ps1` so it can be launched directly from the normal PowerShell starting directory.

After this change is merged and pulled once, the canonical file can be installed/replaced with:

```powershell
Copy-Item "$HOME\PlotPickle\GIT-PlotPickle.ps1" "$HOME\GIT-PlotPickle.ps1" -Force
```

From then on the normal command is:

```powershell
.\GIT-PlotPickle.ps1
```

The expected visible order is repository path, Git update, repository-current confirmation, then the Y/N testing-mode prompt from `PlotPickle.ps1`.
