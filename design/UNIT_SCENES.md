# Unit reconstruction and placement (#37)

A private unit model can start from a room scan, a rental listing, or uploaded media. Muse Wonder interprets the evidence into bounded JSON geometry, followed by a second pass for visible surface finishes and fixture assemblies. The application renders that geometry with Three.js and React Three Fiber; it never executes generated JavaScript.

## Behavior

Enter from the rental details page or Your room. Add floor-plan images, photos, or MP4/WebM walkthroughs using file uploads or direct HTTPS media URLs. Listing-page and YouTube-page scraping is deliberately outside the app; those pages are not media files. A source can be opened from its evidence card. Source uploads are limited to 25 MB and 20 items per unit.

Generation runs through `startJob`, `runJob`, and `runAgent` using `muse-wonder-1.0`. When a labeled floor plan is available, only plan media is used for geometry; photos/video supply appearance in the second pass. Without a plan, geometry uses all available media with explicit uncertainty. Both passes share an eight-minute deadline. Their output is a candidate, separate from the saved scene. A failed detail pass retains the valid layout. Applying it preserves furniture placements. Layout and source revisions protect against late results and stale saves. Item overlap warnings identify placements needing attention after regeneration.

The viewer supports an orbiting dollhouse, a cutaway option, a walkthrough with wall/door/fixture collision and room jumps, and an SVG floor plan with draggable furniture and shared corner handles. Numeric controls provide an alternative to dragging. The canvas loads lazily. Floor-plan editing remains usable when WebGL is unavailable.

Furniture uses dimensioned proxy shapes for sofa, bed, table and storage. Users can attach saved Marketplace listings, enter dimensions, rotate and move items. The proxy is not a reconstructed product mesh. All scene distances use meters; existing measured room sizes in feet are converted at import. Every model inference stores evidence keys and a measured/estimated/unknown basis. The interface does not claim furniture will fit from estimated dimensions.

Without AI, users can enter measured rectangular-room dimensions and place/save furniture. Failed reconstruction leaves the current model intact.

## Visual reconstruction

The reference is [Rumi](https://github.com/IBS27/rumi), particularly its separation of measured captured surfaces from a simulated editable room. This implementation follows the editable reconstruction approach with Muse rather than importing Rumi's LiDAR pipeline or other model providers.

The optional scene `appearance` stores shared materials, assignments to room floors/walls, and observed fixture assemblies with source keys and uncertainty notes. The renderer supports bounded boxes, cylinders and ellipsoids, physical texture repeat sizes, beveled edges, window framing, baseboards, a reflection environment and ambient occlusion. Material grain, tile grids and trim profiles are procedural approximations. There is no captured-surface mesh or photographic texture projection.

Validation checks IDs, evidence, physical bounds, total geometry/storage budgets, and doorway approaches. Walking and placement warnings use conservative fixture footprints. The viewer can hide the details and inspect the structural layout. Changing room corners clears the appearance layer to avoid stale placement; scale calibration transforms the unit and inferred fixtures together while keeping user-placed furniture dimensions unchanged. Saved geometry and calibration notes accompany regeneration as reference.

The real listing trial, generated outputs, costs, reproduction instructions and fidelity assessment are in [the experiment README](../scripts/unit-scenes/README.md). This is an estimated reconstruction, not a measured digital twin. Rumi's captured-surface fidelity would require calibrated overlapping imagery and recovered camera poses/geometry, or a scan package; a text model's scene descriptions cannot establish that accuracy.

## The Apartment tab (#150)

Landing Home (`/landing`) has two tabs over one chat with Muse: the map, and **Apartment** (`/landing?view=apartment`), the person's place as a full-bleed 3D model. The 3D editor above stays the place for changing the layout by hand.

**Choosing a place.** A reply in the chat can carry rental cards. "Choose this place" on a card asks for the move-in date, then calls `myPlace.takeListing` and `apartment.build`. `build` makes the place's unit if it has none and starts the 3D generation above when nothing has been built or tried, AI is on and Muse can read some of the listing's media. It is safe to call again and never fails for want of media: the tab then shows the starter room. `apartment.get` returns the place (with an approximate point for the map, never an address), the unit with its state (`starter`, `building`, `ready`, `partial`, `failed`), the placed items and what they cost.

**Furnishing.** "Make it cozy and warm under $1,500" becomes the chat command `furnish { vibe, budget? }`, and the client calls the `apartment.furnish` action. Muse (task `muse.furnish`) picks from Marketplace listings the viewer can see: the best vibe matches first, then furniture and household basics. Each pick is checked again before it is placed: still a visible, active listing that isn't the viewer's own or already placed, a valid size, and inside the budget that is left. The picks are laid out in the unit where there is room, and the vibe and budget are remembered on the unit, so "add a lamp" keeps the look. `apartment.addItem` places one listing the same way; `moveItem` and `removeItem` change what is there. A unit holds at most 80 items. The reply lists each pick with its price and reason, and the running total against the budget. Nothing is bought, messaged or sent: the items sit in a private model for the person to review. Over the rate limit (4 runs a minute, 20 an hour), with AI off, or when Muse's answer is rejected, Landing's rules pick instead.

**Item models.** Each placed listing gets its own 3D model: a bounded list of the same primitives unit fixtures use (`convex/lib/itemModel.ts`), never code, assets or URLs. One job per change builds them with Muse (task `muse.itemModel`), a few at a time under a shared deadline, reading up to three of the listing's photos for that owner only. Models are stored per owner and listing in `itemModels` and are private. Flat things (rugs, posters) show the listing's first photo on one face. Until a model is ready, when it fails, and whenever AI is off, the tab shows a stand-in shape of the right kind and size.

**Without AI** the whole flow still works: the starter room, Landing's rules for the picks, and stand-in shapes.

## Data and APIs

New table `unitScenes` stores ownerId, optional roomId/listingId, bounded scene data, source media references, placements, revision, optional job/candidate/run references, and timestamps. Indexes: `by_owner`, `by_owner_room`, `by_owner_listing`. Existing room/listing records are unchanged.

Public functions: `get`, `mine`, `create`, `save`, `uploadUrl`, `addSource`, `requestGeneration`, `acceptCandidate`. Internal functions: `load`, `generate`, `saveCandidate`. Viewer wrappers retain the project's demo-persona identity contract. Every unit read/write checks ownership; linked room ownership and listing visibility are rechecked. Uploaded media uses storage IDs and resolves URLs on read.

The shared model adapter now supports typed image/video content and task-level model choice. Existing text tasks retain their default. Media tasks require a private audience, and their cache key includes that audience and media. Model accounting follows the selected model, including failed requests.

## Verification and deployment

`bun run typecheck`, `bun run lint`, and `bun run test`. Tests cover geometry, door traversal, rotated furniture, source references, ownership, measured-room import, stale writes/results, preserved placements, real Muse fixtures and multimodal requests. The public experiment uses the production task, model adapter and editor without writing to a Convex deployment.

The new Convex module must be deployed by the deployment owner through the normal main-branch workflow. Agent worktrees do not run Convex CLI deployment/codegen commands. Production-backend browser verification remains pending that deployment; local registered-handler tests and the standalone editor are verified separately.
