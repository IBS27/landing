# Landing

Landing is a standalone app at `/landing`, built on the Facebook clone's users and data. It has its own layout and navigation, and links out to Facebook's own pages for Groups, Events, people, listings and chats.

## Where things go

- **Routes:** `src/routes/landing/`. Keep route files thin and import from `src/landing/<area>/`. Sections live in `<section>/index.tsx`, so add sub-pages as siblings (`find/apartments.tsx`, `find/$neighborhood.tsx`).
- **Feature code:** `src/landing/<area>/` (folders below), with Convex functions in `convex/<area>.ts` as usual.
- **Shell:** `src/landing/shell/`
  - `LandingLayout.tsx`: header (logo, back to Facebook, the viewer's account menu) and section nav. `src/routes/__root.tsx` renders `/landing*` without Facebook's TopNav and ChatDock.
  - `sections.ts`: the nav. Add a section here.
  - `LandingPage.tsx`: `LandingPage` (title, description, actions, centered column) and the `ComingSoon` stub card.
  - `HomePage.tsx`: Landing Home (`/landing`).
  - `icons.tsx`: `BmLanding`, the app's mark.
- **Links to Facebook objects:** always use `src/landing/links.ts`: `<Link {...toGroup(group)}>`, `toEvent`, `toProfile`, `toListing`, `toConversation`.
- **Viewer:** `useViewer()`, `useQ` and `useM` from `src/app/viewer.tsx`, the same as the rest of the app. Persona switching and dark mode come from the account menu in the header.

## Sections

| Nav             | Path                |
| --------------- | ------------------- |
| Home            | `/landing`          |
| Find            | `/landing/find`     |
| My Place        | `/landing/place`    |
| Crew & Journeys | `/landing/crew`     |
| Move out        | `/landing/move-out` |
| City Profile    | `/landing/profile`  |
| Inbox           | `/landing/inbox`    |

`/landing/welcome` is the City Profile onboarding brief (#3).

## Area folders

Create a folder when you first add code to it.

| Folder           | What                                                               | Section         |
| ---------------- | ------------------------------------------------------------------ | --------------- |
| `profile/`       | City Profile, onboarding brief, what Muse knows                    | City Profile    |
| `inbox/`         | Muse approval queue for outgoing drafts                            | Inbox           |
| `search/`        | Apartment search, verified listings, vouching                      | Find            |
| `neighborhoods/` | Neighborhood pages, scores, Weekend Routes, "Try the neighborhood" | Find            |
| `map/`           | Shared SF map whose pins link to Groups, Events and listings       | Find            |
| `roommates/`     | Lifestyle answers, roommate candidates, compatibility              | My Place        |
| `move-in/`       | Room scan, vibe, matching Marketplace items, tracked items         | My Place        |
| `living/`        | House Group, bills, chores, shopping                               | My Place        |
| `journeys/`      | Move-in Crew, weekly routes, check-ins, levels                     | Crew & Journeys |
| `move-out/`      | Selling tracked items, sublease                                    | Move out        |
| `city-map/`      | Your City Map: pins, photos, memories                              | Later           |
