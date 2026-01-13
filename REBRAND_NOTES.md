# Tellus Rebrand Notes

Changes
- Replaced user-visible strings referencing Bluesky/Bsky with Tellus across app UI and i18n (`src`, `src/locale/locales/*`), plus docs and templates.
- Updated brand assets (icons, splash, favicons, social cards) with Tellus placeholders in `assets` and `bskyweb/static`.
- Swapped web/app metadata and configs to Tellus in `app.config.js`, web templates, `bskyembed`, `bskyogcard`, Dockerfiles, scripts, and README/docs.
- Updated Tellus link domains where UI-facing (`tellus.app`, `tellus.social`, `tellus.app/download`) and left protocol/service URLs intact.
- Added a branding guard script at `scripts/branding-guard.js` with a `branding:guard` package script.

Exceptions kept (with justification)
- AT Protocol namespaces: `app.bsky.*`, `chat.bsky.*`, `com.atproto.*` (protocol identifiers).
- Service endpoints: `https://public.api.bsky.app`, `https://api.bsky.app`, `https://gifs.bsky.app`, `https://video.bsky.app`, `https://events.bsky.app`, `https://ip.bsky.app`, `https://cardyb.bsky.app`, `https://t.gifs.bsky.app` (infrastructure endpoints).
- Telemetry endpoint: `https://api-bsky.bitdrift.io` (vendor hostname).
- Bundle IDs and app groups: `xyz.blueskyweb.app*`, `group.app.bsky` (avoid breaking existing app IDs).
- Native module/extension names: `ExpoBluesky*`, `Share-with-Bluesky`, `BlueskyNSE`, `BlueskyClip`, `@haileyok/bluesky-video` (dependency/target identifiers).
- Env/header identifiers: `EXPO_PUBLIC_BLUESKY_PROXY_DID`, `X-Bsky-Topics` (backward-compatible identifiers).
- Upstream repo/module paths: `bluesky-social` in Go imports and `yarn.lock` (dependency provenance).
- `LICENSE` copyright line (legal requirement).
- Internal service/package identifiers: `bskyweb`, `bskyembed`, `bskyogcard`, `bskylink` (build/runtime paths).

TODO / placeholders
- Replace placeholder domains/links when available: `tellus.app`, `tellus.social`, `updates.tellus.app`, `status.tellus.app`, `tellusweb.zendesk.com`, app store URLs in `README.md`.
- Confirm share extension display name if you want a user-facing "Tellus" label in iOS share sheets.
