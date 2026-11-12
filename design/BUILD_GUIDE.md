# Build guide: Facebook clone (base for Landing)

The goal is a faithful, working clone of desktop facebook.com (1440×900, light mode first, dark mode supported) built on fictional seed data. It is the base the Landing product will extend later. This guide covers the clone only; nothing Landing-specific goes in.

## Stack
- Vite + React 19 + TypeScript, TanStack Router with file routes in `src/routes` (the route tree generates automatically), Tailwind v4 (tokens in `src/styles.css`), Radix (`radix-ui`), and `lucide-react` for generic glyphs.
- Convex backend in `convex/`, cloud dev deployment. Use bun, never npm or yarn.
- Dev servers are already running. **Do not start or stop them.**
  - Vite: http://127.0.0.1:5173
  - `convex dev` auto-pushes every change in `convex/`. Its log is at `/tmp/claude-1000/-home-srinivasib--t3-worktrees-landing-t3-593f1235-993b08a3bec8d7b0/8c2d835f-2fb7-461c-9c77-b2f4b74da40f/scratchpad/convex.log`. Check its tail after Convex edits: a type error there blocks everyone's pushes, so fix it immediately.
- Checks: `bun run typecheck` and `bun run lint` (Biome; `bun run format` auto-fixes). Leave both clean for your files. Never use `any`.

## Conventions
- **Viewer identity.** Every app-facing Convex function uses `viewerQuery` / `viewerMutation` from `convex/lib/functions.ts`, which put `ctx.viewer` (the users doc) in scope. On the client, call them with `useQ(api.x.y, args | "skip")` and `useM(api.x.y)` from `src/app/viewer.tsx`, which inject `viewerId`. Use `useViewer()` for the current user. Personas are switched from the account menu (localStorage key `fb-clone:viewerId`).
- **User chips.** Return `userSummary(doc)` and `getSummaries(ctx, ids)` from `convex/lib/users.ts` instead of whole user docs. Friend helpers live there too.
- **Notifications.** Call `notify(ctx, {...})` from `convex/lib/notify.ts` whenever a real Facebook action would notify someone (reaction, comment, friend request, group post, event invite, Marketplace message).
- **Reactions.** Shared module `convex/reactions.ts`: `react` mutation and `reactionSummary(ctx, type, id, viewerId)` helper, for posts, comments and messages.
- **Schema.** `convex/schema.ts` and `convex/validators.ts` are shared. The `attachments` unions on posts and messages, `author`/`status` on messages, and `badges` on listings are extension points; keep them. If you need a schema change, make a minimal, additive Edit (re-read the file first, never rewrite it). Prefer optional fields.
- **Data is real.** Every Tier-1 surface reads from and writes to Convex, and updates in real time. Nothing on a page should be hardcoded except static chrome (labels, menus). Images are paths under `/seed/...` (public folder) or Convex storage URLs.
- **UI kit** (reuse it; don't fork it):
  - `src/ui/primitives.tsx`: Card, CardHeader, Divider, Button (primary, secondary, soft, ghost, floating, link), IconButton, Avatar (online dot, ring, square), VerifiedBadge, CountBadge, Spinner, Skeleton, NavRow, SectionTitle, EmptyState.
  - `src/ui/overlays.tsx`: Tooltip, PopoverPanel, Menu*, Modal.
  - `src/icons/index.tsx`: Facebook logo, nav icons, colorful bookmark icons. `src/layout/*` holds the TopNav and the left-rail shortcut list.
  - `src/lib/format.ts`: `cn`, `shortAge`, `postTime`, `fullTimestamp`, `compactCount`, `price`, `plural`.
  - Tailwind color names map to Facebook tokens: `bg-wash` (page), `bg-card`, `text-primary`, `text-secondary`, `bg-btn` (grey button), `bg-btn-primary`, `bg-btn-soft text-btn-soft-text`, `bg-hover`, `bg-comment`, `bg-input`, `text-link`, `bg-highlight`, `text-fb`/`bg-fb` (#0866FF), `border-divider`, `shadow-base`, `shadow-elevated`, `bg-online`.
  - Font sizes: text-xs 12, text-sm 13, text-base 15, text-md 17, text-lg 20, text-xl 24, text-2xl 32. Facebook body text is 15px; meta text is 13px.
- **Feature code** goes in `src/features/<area>/`, with the area's Convex functions in `convex/<area>.ts`. Route files in `src/routes` stay thin and import from features.
- **Layout.** The root layout renders the fixed 56px TopNav (`pt-14` on content) and the ChatDock. Each page owns its own rails and sidebars.
  - Home: left rail 360px, center feed column 680px wide (measured on 1440px viewport: rail 0–348, feed 380–1060), right rail 360px (Contacts etc.).
  - Marketplace, Groups, Events, Friends, Watch and Gaming: 360px fixed white left sidebar with a page title and nav rows.
  - Messenger full page: no rails.
- **Copy.** Use Facebook's real UI labels and copy. Seed content is fictional and set in Seattle; no real people's data.

## References
- `design/reference/*.png` are screenshots of real Facebook. The account has few friends or chats, so some views are empty states; populate them the way Facebook does for an active account. Some captures are 2× DPR.
- `design/reference/SPEC.md` (and any `spec-*.md` alongside it): measured sizes, colors and copy per surface.
- `design/reference/fb-tokens.json`: Facebook's raw CSS variables, light and dark.
- These files are gitignored and must stay local: they contain real people's data.

## Verify in the browser, always
After each meaningful change, open the app in your **own** preview tab and check it. Load the tools with ToolSearch: `select:mcp__t3-code__preview_open,mcp__t3-code__preview_navigate,mcp__t3-code__preview_snapshot,mcp__t3-code__preview_act,mcp__t3-code__preview_evaluate,mcp__t3-code__preview_resize,mcp__t3-code__t3_preview_close`.
- Open it with `preview_open` using `target: {kind: "environment-port", port: 5173, path: "/..."}`, `reuseExistingTab: false`, `open: false`. Resize to 1440×900, then use your returned `tabId` for every call.
- Look at the page (`preview_snapshot` with `includeImage: true`) and compare it against the reference screenshot (Read the PNG). Exercise the interactions for real: click, type, submit, switch persona (set localStorage, then reload), check that real-time updates arrive, and test dark mode (account menu → Display).
- Check the console for errors (`preview_snapshot` reports console entries).
- **Never interact with any facebook.com tab.** Only localhost:5173.
- Close your tab when done.

## Don'ts
- Don't commit or push; the coordinator does.
- Don't edit files owned by another area except to fix a clear break, and keep any such fix minimal.
- Don't add new dependencies without a strong reason (lucide, radix and convex-helpers are available).
