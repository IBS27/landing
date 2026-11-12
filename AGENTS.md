# Agent guide

Four people build Landing, each working with coding agents. GitHub Issues is the task board and pull requests are how work lands. Agents coordinate through issues and PRs, so read them before writing code.

Read first:
- `design/PRODUCT_BRIEF.md`: what we're building.
- `design/ROADMAP.md`: build order. Pick tasks from the earliest open wave, and skip the "not a priority" list.
- `design/BUILD_GUIDE.md`: stack, code conventions and browser verification.

## Task board
- Each task is one issue, sized to one PR. Epics (label `epic`) group tasks by brief section as sub-issues.
- `area:*` labels say which part of the product a task belongs to. The `schema` label means the task changes `convex/schema.ts` or `convex/validators.ts`.
- Status:

  | State | Meaning |
  |---|---|
  | Open, no assignee | Available |
  | Assigned | Claimed |
  | Open PR with `Closes #N` | In progress |
  | Closed | Merged |

## Workflow
1. **Pick a task.** Use the issue your human gave you, or find one from the earliest open wave in `design/ROADMAP.md`: `gh issue list --no-assignee --label area:<x>`. Check its "Depends on" issues are closed.
2. **Check for overlap.** Run `gh issue list --assignee "*"` and `gh pr list`. Read the plan comments on claimed issues in the same area or with the `schema` label. If another task touches the same files or tables, comment on that issue before you start.
3. **Claim it:** `gh issue edit <N> --add-assignee @me`. Never take an issue assigned to someone else.
4. **Post a plan comment** on the issue: approach, files you'll touch, and exact schema or API changes (tables, fields, Convex functions). This is how other agents learn what you're doing. Edit it if the plan changes.
5. **Branch from the latest `main`:** `git fetch origin && git switch -c <N>-short-name origin/main`.
6. **Open a draft PR early** (`gh pr create --draft`), with `Closes #<N>` in the body and the template filled in.
7. **Blocked?** Comment `Blocked by #M` on the issue and tell your human.
8. **Before marking the PR ready:** rebase on `origin/main`, run `bun run typecheck` and `bun run lint`, verify in the browser, and finish the PR template. Your human reviews the change before it is marked ready. Squash-merge.
9. **Found new work?** Open an issue (`gh issue create --template task.md`) with the right `area:*` label instead of growing the PR.

## Rules
- One owner per issue. To change something in another open issue's scope, comment on that issue.
- Landing is standalone: its UI lives under `src/routes/landing/` and `src/landing/<area>/`, not inside Facebook surfaces like Marketplace or Groups. Link to Groups, Events, people, listings and chats with the helpers in `src/landing/links.ts`.
- Schema changes are additive, with optional fields where possible (see the build guide). Declare them in the plan comment and add the `schema` label. A large shared schema change gets its own `area:core` issue that other tasks depend on.
- Don't edit files another in-progress task owns, except for a minimal fix to a clear break. Call it out in the PR.
- The brief's principles are hard requirements: never use protected traits for matching, no live location, the user approves before Muse sends anything, every score and recommendation cites its sources, and core flows work without AI.
- Each person uses their own Convex dev deployment (`bunx convex dev`).
