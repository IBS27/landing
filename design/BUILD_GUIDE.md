# Build guide: Facebook clone (base for Landing)

The goal is a faithful, working clone of desktop facebook.com (1440×900, light mode first, dark mode supported) built on fictional seed data. Landing features are built on top of it (see `PRODUCT_BRIEF.md` and `AGENTS.md`). The conventions below apply to all code, clone and Landing alike.

## Stack
- Vite + React 19 + TypeScript, TanStack Router with file routes in `src/routes` (the route tree generates automatically), Tailwind v4 (tokens in `src/styles.css`), Radix (`radix-ui`), and `lucide-react` for generic glyphs.
- Convex backend in `convex/`, cloud dev deployment. Use bun, never npm or yarn.
- Dev servers are already running. **Do not start or stop them.**
  - Vite: http://127.0.0.1:5173
  - `bunx convex dev` (`bun run dev:convex`) auto-pushes every change in `convex/`. Watch its output after Convex edits: a type error there blocks pushes for everyone sharing the deployment, so fix it immediately.
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
- **Feature code** goes in `src/features/<area>/`, with the area's Convex functions in `convex/<area>.ts`. Route files in `src/routes` stay thin and import from features. Landing feature code goes in `src/landing/<area>/` with routes under `src/routes/landing/` (see `AGENTS.md`).
- **Layout.** The root layout renders the fixed 56px TopNav (`pt-14` on content) and the ChatDock. Each page owns its own rails and sidebars.
  - Home: left rail 360px, center feed column 680px wide (measured on 1440px viewport: rail 0–348, feed 380–1060), right rail 360px (Contacts etc.).
  - Marketplace, Groups, Events, Friends, Watch and Gaming: 360px fixed white left sidebar with a page title and nav rows.
  - Messenger full page: no rails.
  - Landing (`/landing/*`): the same root layout as everything else, with Landing's 360px sidebar (`AppRail`, from `src/landing/shell/LandingLayout.tsx`) and the page beside it.
- **Copy.** Use Facebook's real UI labels and copy. Seed content is fictional and set in San Francisco; no real people's data.

## AI calls
- **Meta's Muse models only.** Landing uses Meta's Muse models and no others: Muse Spark for text, and Muse Image and the rest of the Muse family for media. Don't add other providers' models. When Meta ships a newer Muse model, upgrade to it. Today every agent (`muse`, `ember`, `spark`) runs on `muse-spark-1.3` through Meta's Model API ([docs](https://dev.meta.ai/docs)).
- **One entry point.** Call models only through `runAgent(ctx, task, { input, sources, shownTo })` from `convex/ai/agent.ts`, inside a Convex action. `convex/ai/model.ts` is the only file that talks to a model API: it holds the model ID, the client, retries and prices. Declare each task once with `defineTask` next to the feature: its agent (`muse`, `ember` or `spark`), instructions, output validator, `cites` extractor, optional `check` rules and a non-AI `fallback`.
- **Output is checked, not trusted.** The output must match the validator, every `v.id()` in it must appear in the input, every cited key must be one of the given sources, and `check` must pass. Rejected output goes back to the model for a retry. After that, the task's fallback is used.
- **Sources are citations.** Pass `sources` as `Source` refs (the type stored in `citations`) and `shownTo`: `"everyone"` for a result cached once for every viewer, or the user it's for. `runAgent` resolves the sources for that audience and drops the rest before the model sees them, so a shared result is built only from public sources. `result.cited` is `Citations` (or `null` when nothing is cited): store it after `assertCitable(ctx, cited, ...)` with the same audience.
- **Agents never write.** `runAgent` returns data and logs to `aiRuns`. Send anything that acts for a user through `propose()` (#6). Write scores, routes and other derived data with your feature's own computed-table mutation.
- **Fallbacks are real features.** AI is off when `MODEL_API_KEY` (the Meta Model API key) is unset or `AI_ENABLED` is `false` (Convex env vars; `bunx convex env set AI_ENABLED false` is the kill switch). Every flow must still work then. `api.ai.status.get` reports whether AI is on.
- **Shared results are cached.** Runs with the same task, input and sources reuse the stored result for `cacheTtlMs` (default 24h), so build inputs from shared data (a neighborhood's threads), not from the viewer, when the result is the same for everyone.
- **Long jobs** use `startJob` (from a mutation) and `runJob` (in the scheduled action) from `convex/ai/jobs.ts`. The UI subscribes to `api.ai.jobs.get` for status and progress.
- Never send protected traits to the model, and put only what the result's audience may see in `input` (`sources` are filtered for you).

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
- Don't commit or push outside the issue and PR workflow in `AGENTS.md`.
- Don't edit files owned by another area except to fix a clear break, and keep any such fix minimal.
- Don't add new dependencies without a strong reason (lucide, radix and convex-helpers are available).
