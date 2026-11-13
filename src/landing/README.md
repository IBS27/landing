# Landing

Landing is part of the Facebook clone: a section at `/landing`, like Marketplace or Gaming, built on the clone's users and data. Its pages keep Facebook's TopNav and ChatDock and add Landing's left sidebar, and they link to Facebook's own pages for Groups, Events, people, listings and chats.

## Where things go

- **Routes:** `src/routes/landing/`. Keep route files thin and import from `src/landing/<area>/`. Sections live in `<section>/index.tsx`, so add sub-pages as siblings (`find/apartments.tsx`, `find/$neighborhood.tsx`).
- **Feature code:** `src/landing/<area>/` (folders below), with Convex functions in `convex/<area>.ts` as usual.
- **Shell:** `src/landing/shell/`
  - `LandingLayout.tsx`: Landing's 360px sidebar (the clone's `AppRail`) with the page beside it. Facebook's TopNav and ChatDock come from the root layout, as on every other page.
  - `sections.ts`: the nav. Add a section here.
  - `LandingPage.tsx`: `LandingPage` (title, description, actions, centered column) and the `ComingSoon` stub card.
  - `HomePage.tsx`: an earlier Home stub, no longer used. Landing Home is `home/LandingHome.tsx`.
  - `icons.tsx`: `BmLanding`, the app's mark.
- **Links to Facebook objects:** always use `src/landing/links.ts`: `<Link {...toGroup(group)}>`, `toEvent`, `toProfile`, `toListing`, `toConversation`. It also has links between Landing's own pages: `toHome({ view: "apartment" })`, `toLandingPage("inbox")`, `toRentalCheck`, `toNeighborhood`, `toUnit`.
- **Viewer:** `useViewer()`, `useQ` and `useM` from `src/app/viewer.tsx`, the same as the rest of the app. Persona switching and dark mode come from the account menu in Facebook's TopNav.

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

## Home

Home (`/landing`) is `home/LandingHome.tsx`: one chat with Muse over two tabs.

- **Map** (the default): a map you travel into, from the globe to a neighborhood with 3D buildings. From city level in it shows Events and Groups by default, the Move-in Crew at neighborhood level and "Your place" at an approximate point. Layer chips (Homes, Events, Groups, Marketplace, Crew) turn layers on and off, and chat commands set them.
- **Apartment** (`/landing?view=apartment`): the person's place in 3D (`apartment/ApartmentStage.tsx`), furnished from the same chat. See "The Apartment tab" in `design/UNIT_SCENES.md`.

The chat dock (`home/ChatDock.tsx`) is shared by both tabs. A reply can carry cards (`home/ChatCards.tsx`): rentals to choose from, and the items Muse placed. The chat log lives in the browser (`home/useChatLog.ts`), and the map's state in `home/useHomeMap.ts`. "Explore" (`home/HomeChrome.tsx`) lists every Landing page, so nothing depends on asking with the right phrase.

## Area folders

Create a folder when you first add code to it.

| Folder           | What                                                               | Section         |
| ---------------- | ------------------------------------------------------------------ | --------------- |
| `home/`          | Landing Home: the Muse chat over the Map and Apartment tabs        | Home            |
| `apartment/`     | Home's Apartment tab: the place in 3D, furnished from the chat     | Home            |
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
