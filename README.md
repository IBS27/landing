# Landing: Facebook clone base

A working clone of desktop facebook.com, built as the base for Landing. It covers:
- Feed, posts, comments and reactions, and stories
- Profiles and Friends
- Groups
- Marketplace, including rentals
- Messenger, including calls
- Events
- Notifications and Search
- Reels, Video and Live
- Gaming, Pages, Settings, Saved and Memories

All data lives in Convex and updates in real time. The seed world is fictional and set in Seattle.

## Run it
```bash
bun install
bunx convex dev        # first run: log in and create or link a dev deployment (writes .env.local)
bun run seed           # wipe and rebuild the seed world (~5s)
bun run dev            # Vite on http://127.0.0.1:5173
```
To switch demo personas, use the account menu: top-right avatar, then "See all profiles".

## Checks
```bash
bun run typecheck
bun run lint           # Biome; `bun run format` auto-fixes
```

## Layout
- `src/routes/`: TanStack file routes. Keep them thin; they import from `src/features/<area>/`.
- `src/ui/`, `src/icons/`, `src/layout/`: shared UI kit, icons and app chrome. `src/styles.css` holds Facebook's design tokens.
- `convex/`: schema, functions per area, and `convex/seed/` (the deterministic seed world).
- `design/BUILD_GUIDE.md`: conventions. Read this before extending the app.

## Extension points for Landing
- `attachments` on posts and messages (typed `kind` unions).
- `author` (human or agent) and `status` (draft, pending approval, sent) on messages.
- `badges` on listings.
- `viewerQuery` / `viewerMutation`: switching to real auth only touches these builders.

## Notes
- Calls and live video are peer-to-peer WebRTC with Convex as the signalling channel. Viewers on strict networks need a TURN server, set through `VITE_ICE_SERVERS` (a JSON array of `RTCIceServer`).
- Media credits are in `public/seed/ATTRIBUTION.md`. Map tiles are © OpenStreetMap contributors © CARTO.
