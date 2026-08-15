/**
 * Platform detection utilities for downloading the correct binary
 */
/**
 * Get the platform triple (e.g., "x86_64-unknown-linux-gnu")
 */
export declare function getTriple(): string;
/**
 * Get the library file extension for the current platform
 */
export declare function getLibExtension(): "dylib" | "so" | "dll";
/**
 * Get the library filename prefix (empty on Windows)
 */
export declare function getLibPrefix(): string;
/**
 * Get the full library filename for the current platform
 */
export declare function getLibFilename(): string;
/**
 * Get the npm package name for the current platform's native binary.
 *
 * @returns Package name like "@ff-labs/fff-bin-darwin-arm64"
 * @throws If the current platform is not supported
 */
export declare function getNpmPackageName(): string;
//# sourceMappingURL=platform.d.ts.map