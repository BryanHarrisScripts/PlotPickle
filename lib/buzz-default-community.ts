export const BUZZ_IDENTITY_ONBOARDING_URL = "https://github.com/block/buzz/releases/latest";

export const PLOTPICKLE_BUZZ_COMMUNITY = Object.freeze({
  name: "PlotPickle Community BBS",
  displayName: "PlotPickle Playhouse",
  relayUrl: "wss://plotpickleplayhouse.communities.buzz.xyz",
  directoryUrl: "https://buzz.directory/communities/plotpickle-community-bbs-ad08e6622fce447297d2f893774d654d",
  greatHallName: "great-hall",
  requiredConnection: true,
  removableByHuman: false,
});

export const PLOTPICKLE_FEDERATION_POLICY = Object.freeze({
  rootCommunity: PLOTPICKLE_BUZZ_COMMUNITY,
  allowHumanOwnedCommunities: true,
  memberRequirement: "plotpickle-human-with-connected-buzz",
  socialAuthority: "buzz",
});

export const DEFAULT_HUMAN_LORE_GLYPH = "ᛉ";
