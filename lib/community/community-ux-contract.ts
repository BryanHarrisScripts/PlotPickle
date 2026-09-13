export const COMMUNITY_STORY_ROOM_UX = Object.freeze({
  storySource: "project-library",
  storyCollectionLabel: "My Stories",
  createActionLabel: "Create Private Story Room",
  openActionLabel: "Open Private Story Room",
  preCreationSections: ["story", "create"] as const,
  managementSections: ["room", "visibility", "people-with-access", "pending-requests"] as const,
  privateVisibilityLabel: "Private / Hidden",
  listedVisibilityLabel: "Listed / Request Access",
  openAdmissionReady: false,
  normalHumanRole: "member",
  knownPersonSourceRequiresGreatHallMembership: false,
  directInviteIdentityAuthority: "buzz-public-key",
  directInvitePublicLabel: "BUZZ ID (public)",
  directInviteAcceptsSecretCredentials: false,
  ownerRemovableThroughNormalUi: false,
} as const);

export const COMMUNITY_PRESENCE_UX = Object.freeze({
  canonicalSurface: "governed-community",
  legacyStandaloneRoute: "/community-presence",
  exposeLegacyStandaloneRouteInNormalNavigation: false,
  availability: ["online", "away", "busy", "offline"] as const,
  visibility: ["public", "contacts", "invisible"] as const,
} as const);

export const CONNECTED_STUDIOS_UX = Object.freeze({
  subject: "other-studios",
  compactEmptyState: true,
  allowedHumanActions: ["open-studio", "visit-great-hall", "add-contact", "remove-contact", "block", "report"] as const,
} as const);
