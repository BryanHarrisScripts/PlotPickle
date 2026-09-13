# Issue #2016 — Settings DATA UX

Settings DATA should use human language for ordinary users, keep the yellow review state on the Settings navigation marker, and place implementation terminology behind Advanced Data Diagnostics.

The ordinary DATA hierarchy is:

1. Project Files & Backups
2. Project Search
3. Media & Preview Cache
4. Advanced Data Diagnostics

Canonical project files and user-owned project assets must never be described as disposable cache. Database migrations are automatic product maintenance; ordinary Settings should expose only understandable data-format status. Detailed database, migration, search-engine, storage-path and repair information belongs under Advanced Data Diagnostics.

The DATA page remains canonical Skin V1 monochrome. Yellow is reserved for the Settings navigation review marker and must not be repeated as page chrome.

Implementation must preserve existing functionality and must not invent cache-clearing or index-rebuild actions unless the underlying safe operation already exists. Focused Settings DATA tests, keyboard navigation, visual/readiness checks and exact-head Architecture Verification are required before merge.

Authority: https://github.com/BryanHarrisScripts/PlotPickle/issues/2016
