# PlotPickle CI testing strategy

PlotPickle uses four stable pull-request gates. Historical issue contracts remain tests, but they no longer create a new workflow and runner for every completed issue.

## Pull-request gates

### Quality

- installs dependencies once;
- validates the changed-test registry and CI topology;
- runs lint and the production build;
- runs the suites selected by `npm run test:changed`;
- uses a bounded core fallback when a file is not registered yet.

### Safety

- validates repository-publication and credential boundaries;
- scans only commits introduced by the pull request;
- runs dependency audit and review only when dependency manifests change.

Complete reachable-history scanning and CodeQL run after merge, weekly, or manually.

### Visual

- completes immediately when no interface-owned file changed;
- runs the retained deterministic UI, accessibility, navigation, dashboard, routing and Storyboard contracts for visual changes;
- captures rendered browser evidence for visual changes;
- keeps the AI design review advisory so provider or rate-limit failures cannot block a merge.

The full Windows screen inventory runs after merge or manually.

### Release readiness

- always returns one PR outcome;
- runs release-contract tests;
- stages and smoke-tests one representative Linux package only when runtime, packaging or dependency files change.

Complete Windows, macOS and Linux packaging runs after merge, on release tags, or manually.

## Post-merge and manual validation

- complete regression suite;
- smoke Human Acceptance dispatch;
- complete Git-history and CodeQL security scans;
- full-product visual inventory;
- Windows, macOS and Linux clean-package validation;
- installed Windows product acceptance;
- Repomix diagnostic generation.

The maintained workflow inventory is seven files: four PR gates plus Human Acceptance, Windows Installed Acceptance and Repomix Diagnostics.

The operating rule is:

`PR = Quality + Safety + Visual + Release readiness`

`main/release = full regression + full security + full package + full visual evidence`
