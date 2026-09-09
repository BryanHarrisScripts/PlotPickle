"use client";

import { useState } from "react";
import CommunityWorkspace from "./community-workspace";

/**
 * #1757 compatibility host: canonical target is the Community Experience capability.
 * Consumer: SkinV1Client. Remove when Community's room/identity view models are
 * available through Experience; the existing workspace retains BUZZ authority.
 */
export default function CommunitySkinHost() {
  const [showSetup, setShowSetup] = useState(false);
  return (
    <div className="pp-skin-v1-community">
      {showSetup ? (
        <section className="pp-skin-v1-community-setup" aria-label="Community identity setup" role="status">
          <p>BUZZ identity setup is available in the existing Profile screen. Return to Skin V1 after connecting, then reopen Community to refresh.</p>
          <a href="/?skin=legacy&workspace=community">Open existing Profile setup</a>
          <button type="button" onClick={() => setShowSetup(false)}>Dismiss</button>
        </section>
      ) : null}
      <CommunityWorkspace onOpenSettings={() => setShowSetup(true)} />
    </div>
  );
}
