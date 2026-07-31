import collaborationCopy from "@/config/collaboration-copy.json";

/**
 * Writer-facing collaboration copy shared by Dashboard, Collab, Settings,
 * Story Proposals, synchronization and recovery surfaces.
 *
 * Provider identifiers, routes and persisted Git field names remain unchanged.
 */
export const COLLABORATION_SURFACE_COPY = collaborationCopy.surfaces;

export type CollaborationSurfaceCopy = typeof COLLABORATION_SURFACE_COPY;
