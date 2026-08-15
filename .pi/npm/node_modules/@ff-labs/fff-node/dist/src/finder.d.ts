/**
 * FileFinder - High-level API for the fff file finder
 *
 * This class provides a type-safe, ergonomic API for file finding operations.
 * Each instance owns an independent native file picker that can be created
 * and destroyed independently. Multiple instances can coexist.
 *
 * All methods return Result types for explicit error handling.
 */
import type { DirSearchOptions, DirSearchResult, FileFinderApi, GlobOptions, GrepOptions, GrepResult, HealthCheck, InitOptions, MixedSearchResult, MultiGrepOptions, Result, ScanProgress, SearchOptions, SearchResult, WatchBatchCallback, WatchOptions, WatchUnsubscribe } from "./fff-api.js";
/**
 * FileFinder - Fast file finder with fuzzy search
 *
 * Each instance is backed by an independent native file picker. Create as many
 * as you need and destroy them when done.
 *
 * @example
 *
 * ```ts
 * import { FileFinder } from "@ff-labs/fff-node";
 *
 * // Create an instance
 * const finder = FileFinder.create({ basePath: "/path/to/project" });
 * if (!finder.ok) {
 *   console.error(finder.error);
 *   process.exit(1);
 * }
 *
 * // Wait for initial scan
 * await finder.value.waitForScan(5000);
 *
 * // Search for files
 * const search = finder.value.search("main.ts");
 * if (search.ok) {
 *   for (const item of search.value.items) {
 *     console.log(item.relativePath);
 *   }
 * }
 *
 * // Cleanup
 * finder.value.destroy();
 * ```
 */
export declare class FileFinder implements FileFinderApi {
    private handle;
    /** Native ids of this instance's active watch subscriptions. */
    private watchers;
    private constructor();
    /**
     * Create a new file finder instance.
     *
     * @param options - Initialization options
     * @returns Result containing the new FileFinder instance or an error
     *
     * @example
     * ```typescript
     * // Basic initialization
     * const finder = FileFinder.create({ basePath: "/path/to/project" });
     *
     * // With custom database paths
     * const finder = FileFinder.create({
     *   basePath: "/path/to/project",
     *   frecencyDbPath: "/custom/frecency.mdb",
     *   historyDbPath: "/custom/history.mdb",
     * });
     * ```
     */
    static create(options: InitOptions): Result<FileFinder>;
    /**
     * Destroy and clean up all resources.
     *
     * Call this when you're done using the file finder to free memory
     * and stop background file watching. After calling this, the instance
     * must not be used again.
     */
    destroy(): void;
    /**
     * Check if this instance has been destroyed.
     */
    get isDestroyed(): boolean;
    /**
     * Guard that returns an error if the instance has been destroyed.
     */
    private ensureAlive;
    /**
     * Search for files matching the query.
     *
     * The query supports fuzzy matching and special syntax:
     * - `foo bar` - Match files containing "foo" and "bar"
     * - `src/` - Match files in src directory
     * - `file.ts:42` - Match file.ts with line 42
     * - `file.ts:42:10` - Match file.ts with line 42, column 10
     *
     * @param query - Search query string
     * @param options - Search options
     * @returns Search results with matched files and scores
     *
     * @example
     * ```typescript
     * const result = finder.search("main.ts", { pageSize: 10 });
     * if (result.ok) {
     *   console.log(`Found ${result.value.totalMatched} files`);
     *   for (const item of result.value.items) {
     *     console.log(item.relativePath);
     *   }
     * }
     * ```
     */
    fileSearch(query: string, options?: SearchOptions): Result<SearchResult>;
    /**
     * Filters files using glob wildcard expression.
     *
     * The pattern is applied as a single pass SIMD optimized prefiltering
     * without any fuzzy matching involved. Faster and 100% compatible to npm `glob`.
     *
     * @param pattern - Glob pattern (required, non-empty)
     * @param options - Glob search options (pagination, max threads, current file)
     * @returns Search results with files matching the glob
     *
     * @example
     * ```typescript
     * const result = finder.glob("**\/*.rs", { pageSize: 100 });
     * if (result.ok) {
     *   for (const item of result.value.items) {
     *     console.log(item.relativePath);
     *   }
     * }
     * ```
     */
    glob(pattern: string, options?: GlobOptions): Result<SearchResult>;
    /**
     * Search for directories matching the query.
     *
     * @param query - Search query string
     * @param options - Directory search options
     * @returns Search results with matched directories and scores
     *
     * @example
     * ```typescript
     * const result = finder.directorySearch("src/comp", { pageSize: 10 });
     * if (result.ok) {
     *   console.log(`Found ${result.value.totalMatched} directories`);
     *   for (const item of result.value.items) {
     *     console.log(item.relativePath);
     *   }
     * }
     * ```
     */
    directorySearch(query: string, options?: DirSearchOptions): Result<DirSearchResult>;
    /**
     * Search for files and directories matching the query (mixed results).
     *
     * Results are interleaved by total score in descending order, mixing
     * both file and directory items.
     *
     * @param query - Search query string
     * @param options - Search options
     * @returns Mixed search results with files and directories interleaved by score
     *
     * @example
     * ```typescript
     * const result = finder.mixedSearch("main", { pageSize: 20 });
     * if (result.ok) {
     *   for (const entry of result.value.items) {
     *     if (entry.type === "file") {
     *       console.log(`File: ${entry.item.relativePath}`);
     *     } else {
     *       console.log(`Dir: ${entry.item.relativePath}`);
     *     }
     *   }
     * }
     * ```
     */
    mixedSearch(query: string, options?: SearchOptions): Result<MixedSearchResult>;
    /**
     * Search file contents (live grep).
     *
     * Searches through the contents of indexed files using the specified mode:
     * - `"plain"` (default): SIMD-accelerated literal text matching
     * - `"regex"`: Regular expression matching
     * - `"fuzzy"`: Smith-Waterman fuzzy matching per line
     *
     * Supports pagination for large result sets. The result includes a `nextCursor`
     * that can be passed back to fetch the next page.
     *
     * The query also supports constraint syntax:
     * - `*.ts pattern` - Only search in TypeScript files
     * - `src/ pattern` - Only search in the src directory
     *
     * @param query - Search query string
     * @param options - Grep options (mode, pagination, limits)
     * @returns Grep results with matched lines and file metadata
     *
     * @example
     * ```typescript
     * // First page
     * const result = finder.grep("TODO", { mode: "plain" });
     * if (result.ok) {
     *   for (const match of result.value.items) {
     *     console.log(`${match.relativePath}:${match.lineNumber}: ${match.lineContent}`);
     *   }
     *   // Fetch next page
     *   if (result.value.nextCursor) {
     *     const page2 = finder.grep("TODO", {
     *       cursor: result.value.nextCursor,
     *     });
     *   }
     * }
     * ```
     */
    grep(query: string, options?: GrepOptions): Result<GrepResult>;
    /**
     * Multi-pattern OR search using Aho-Corasick.
     *
     * Searches for lines matching ANY of the provided patterns using
     * SIMD-accelerated multi-needle matching. Faster than regex alternation
     * for literal text searches.
     *
     * Supports pagination. The result includes a `nextCursor` that can be
     * passed back to fetch the next page.
     *
     * @param options - Multi-grep options including patterns and optional constraints
     * @returns Grep results with matched lines and file metadata
     *
     * @example
     * ```typescript
     * const result = finder.multiGrep({
     *   patterns: ["VideoFrame", "video_frame", "PreloadedImage"],
     * });
     * if (result.ok) {
     *   for (const match of result.value.items) {
     *     console.log(`${match.relativePath}:${match.lineNumber}: ${match.lineContent}`);
     *   }
     * }
     * ```
     */
    multiGrep(options: MultiGrepOptions): Result<GrepResult>;
    /**
     * Trigger a rescan of the indexed directory.
     *
     * This is useful after major file system changes that the
     * background watcher might have missed.
     */
    scanFiles(): Result<void>;
    /**
     * Check if a scan is currently in progress.
     */
    isScanning(): boolean;
    /**
     * Get the base path of the file picker (the root directory being indexed).
     */
    getBasePath(): Result<string | null>;
    /**
     * Get the current scan progress.
     */
    getScanProgress(): Result<ScanProgress>;
    /**
     * Wait for the initial file scan to complete.
     * Non-blocking: polls `isScanning` and yields to the event loop between checks.
     *
     * @param timeoutMs - Maximum time to wait in milliseconds (default: 5000)
     * @returns true if scan completed, false if timed out
     *
     * @example
     * ```typescript
     * const finder = FileFinder.create({ basePath: "/path/to/project" });
     * if (finder.ok) {
     *   const completed = await finder.value.waitForScan(10000);
     *   if (!completed.ok || !completed.value) {
     *     console.warn("Scan did not complete in time");
     *   }
     * }
     * ```
     */
    waitForScan(timeoutMs?: number): Promise<Result<boolean>>;
    /**
     * Wait for the initial file scan to complete, blocking the calling thread.
     *
     * Backed by the native `fff_wait_for_scan` call. Prefer {@link waitForScan}
     * unless you specifically need synchronous blocking behaviour.
     *
     * @param timeoutMs - Maximum time to wait in milliseconds (default: 5000)
     * @returns true if scan completed, false if timed out
     */
    waitForScanBlocking(timeoutMs?: number): Result<boolean>;
    /**
     * Wait until the index is fully ready: the scan has finished and the warmup
     * (content indexing / bigram) phase has completed.
     *
     * Non-blocking: polls `getScanProgress` and yields to the event loop.
     *
     * @param timeoutMs - Maximum time to wait in milliseconds (default: 5000)
     * @returns true if the index became ready, false if timed out
     */
    waitForIndexReady(timeoutMs?: number): Promise<Result<boolean>>;
    /**
     * Change the indexed directory to a new path.
     *
     * This stops the current file watcher and starts indexing the new directory.
     *
     * @param newPath - New directory path to index
     */
    reindex(newPath: string): Result<void>;
    /**
     * Refresh the git status cache.
     *
     * @returns Number of files with updated git status
     */
    refreshGitStatus(): Result<number>;
    /**
     * Track query completion for smart suggestions.
     *
     * Call this when a user selects a file from search results.
     * This helps improve future search rankings for similar queries.
     *
     * @param query - The search query that was used
     * @param selectedFilePath - The file path that was selected
     */
    trackQuery(query: string, selectedFilePath: string): Result<boolean>;
    /**
     * Get a historical query by offset.
     *
     * @param offset - Offset from most recent (0 = most recent)
     * @returns The historical query string, or null if not found
     */
    getHistoricalQuery(offset: number): Result<string | null>;
    /**
     * Subscribe to filesystem changes matching `pattern`.
     *
     * Pattern semantics:
     * - Wildcards (`*.rs`, `src/**`, `./**\/*.ts`) — glob matched against the
     *   base-path-relative path. Absolute globs must be under the base path.
     * - No wildcards — resolved against the base path (must stay inside it):
     *   an existing directory subscribes to its whole subtree, anything else
     *   is an exact file path.
     * - Omitted — subscribes to the entire indexed tree: `watch(callback)`.
     *
     * Push-based: events are delivered by the native watcher through a single
     * process-wide callback trampoline (no polling, no idle wakeups). The
     * callback receives normalized batches of up to 128 events on the JS event
     * loop, with each path appearing at most once.
     *
     * Requires the instance to be created with watching enabled (default).
     *
     * @param pattern - Glob pattern, exact file path, or directory
     * @param callback - Invoked with each batch of events
     * @param options - Watch options
     * @returns Unsubscribe handle; call it to stop
     *
     * @example
     * ```typescript
     * const sub = finder.watch("**\/*.rs", (events) => {
     *   for (const e of events) console.log(e.kind, e.path);
     * });
     * if (sub.ok) sub.value(); // unsubscribe
     *
     * // no pattern: everything under the indexed base path
     * const all = finder.watch((events) => console.log(events.length));
     * ```
     */
    watch(callback: WatchBatchCallback, options?: WatchOptions): Result<WatchUnsubscribe>;
    watch(pattern: string, callback: WatchBatchCallback, options?: WatchOptions): Result<WatchUnsubscribe>;
    /**
     * Get health check information.
     *
     * Useful for debugging and verifying the file finder is working correctly.
     *
     * @param testPath - Optional path to test git repository detection
     */
    healthCheck(testPath?: string): Result<HealthCheck>;
    /**
     * Check if the native library is available.
     */
    static isAvailable(): boolean;
    /**
     * Ensure the native library is loaded.
     *
     * Loads the native library from the platform-specific npm package
     * or a local dev build. Throws if the binary is not found.
     */
    static ensureLoaded(): void;
    /**
     * Get a health check without requiring an instance.
     *
     * Returns limited info (version + git only, no picker/frecency/query data).
     *
     * @param testPath - Optional path to test git repository detection
     */
    static healthCheckStatic(testPath?: string): Result<HealthCheck>;
}
//# sourceMappingURL=finder.d.ts.map