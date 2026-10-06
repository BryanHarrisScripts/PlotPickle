# PlotPickle lru 0.14.0 security backport

Issue: #2706

This directory starts from the upstream MIT-licensed lru 0.14.0 release commit:

`5ec44f564f561abf4b93f7c41764ced496d4bbb6`

PlotPickle applies only the two upstream memory-safety repairs needed by the FFrames 1.2.0 / usvgr 0.46.1 dependency line, whose semver constraints still require lru 0.14.x.

Backports:

- RUSTSEC-2026-0002 / GHSA-rhfx-m35p-ff5j — upstream PR #224, reviewed patch head `25669e76110133c73d72f1db0069934ba590162a`. The `IterMut` implementation now creates shared key references rather than temporary mutable references that violate Stacked Borrows.
- RUSTSEC-2026-0253 — upstream PR #238, reviewed patch head `2776ded569ee89a99c515bca8194f65639182c96`. `LruCache::pop` detaches the list node before running key destruction so an unwinding `Drop` cannot leave dangling linked-list pointers.

No API expansion or unrelated upstream changes are included. The package version remains 0.14.0 so it satisfies the existing FFrames/usvgr dependency constraints. Cargo is directed to this repository path with `[patch.crates-io]`, causing both transitive consumers to resolve the same reviewed source.

This is a bounded compatibility bridge. Replace it with a normal upstream crate once both FFrames and usvgr accept a release that includes the fixes (currently lru >=0.18.2 covers both public advisories).

License: upstream MIT license preserved in LICENSE.
