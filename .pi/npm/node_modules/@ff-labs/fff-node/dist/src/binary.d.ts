/**
 * Binary resolution utilities for fff-node
 *
 * Resolves the native library from:
 * 1. Platform-specific npm package (e.g. @ff-labs/fff-bin-darwin-arm64)
 * 2. Local dev build (target/release or target/debug)
 */
/**
 * Check if the binary exists in any known location
 */
export declare function binaryExists(): boolean;
/**
 * Find the native library binary.
 *
 * Resolution order:
 * - Dev workspace: local dev build first, then npm package
 * - Production: npm package first, then dev build
 *
 * @returns Absolute path to the library, or null if not found
 */
export declare function findBinary(): string | null;
//# sourceMappingURL=binary.d.ts.map