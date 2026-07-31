# PlotPickle managed Buzz runtime

PlotPickle uses the official Buzz relay container as an optional local writers' room. The normal PlotPickle installation remains fully usable without Buzz.

## Packaged material

- `compose.yml` is a PlotPickle-local derivative of the official Buzz v0.4.26 production Compose bundle.
- `manifest.json` pins the upstream repository, release revision, container tag, file checksums and licence record.
- `LICENSE.buzz.txt` preserves the upstream Apache-2.0 licence.

The Buzz relay, Postgres, Redis and MinIO images are downloaded only after the user selects **Install managed Buzz** in Settings. They are not embedded in the PlotPickle installer.

## Security boundary

- The relay port is bound to `127.0.0.1` by default.
- Generated service secrets are written under the current PlotPickle user data directory, not into the repository or a PPF project.
- Buzz user private keys are stored through PlotPickle's encrypted credential vault.
- Removing managed Buzz can remove the containers and volumes without deleting PlotPickle projects.

## Runtime requirements

Docker Desktop or Docker Engine with Compose v2 is required. PlotPickle validates the pinned manifest and Compose configuration before it downloads or starts anything.

The managed bundle is not considered release-ready merely because the controls or Compose file exist. Its validation gate requires checksum verification, licence verification, clean-machine startup, localhost reachability, shutdown, backup, restore, repair and complete removal evidence on the supported PlotPickle release platforms.

## Authority

Buzz discussions and signed events are source context. A user must deliberately convert a discussion into a PlotPickle proposal and approve that proposal before the PPF changes.
