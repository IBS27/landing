# SF rental evidence

The 30 normal seed listings now use real, single-level SF units. Each reference has a dimensioned published floor-plan image and labeled photos of every bedroom, full bathroom and powder room, plus kitchen, living spaces and connecting rooms. The catalog records the source listing, original image URLs and retrieval date. Display copies are local under `public/seed/rentals/`.

Sellers, prices and availability are fictional demo terms. Private-room offers show the whole apartment's evidence and explicitly ask the renter to confirm which bedroom is offered. Natural seed keys remain stable for conversations, saves and vouches. The four intentionally suspicious trust-demo listings remain separate warning examples and do not claim complete reconstruction evidence.

`convex/seed/rentalMedia.json` is the reviewed catalog. `python3 scripts/rental-media/fetch.py` refreshes only those pinned units and local images. It rejects multi-level or incomplete galleries, excludes common areas and shared laundry, and keeps distinct rooms before alternate views. No Convex writes occur. The listing seed uses the source point and room counts instead of combining unrelated stock photos and guessed plans.

Both Landing and Marketplace use the same gallery. Floor plans have a direct button, uncropped display and a full-size link. `unitScenes.create` imports the floor plan as `floorplan` and uses public originals for Muse, while the browser loads local images. Gallery edits or unit-detail changes clear the reference metadata so stale evidence cannot silently follow another unit.

## Verification

Run `bun run typecheck`, `bun run lint`, and `bun test`. The focused `tests/rentalMedia.test.ts` checks every bedroom and bathroom, all local files and public source URLs, exact coordinates, preserved room/sublet flows and real scene creation against the in-memory DB.

Open `/scripts/rental-media/preview.html` on this checkout's Vite server to review the production gallery and saved Muse results. This development page has no shared backend writes.

The `reconstruction/` fixtures exercise the existing production `runAgent` and Muse Wonder adapter, with the floor plan determining topology. Room geometry is unedited model output. Reproduce a layout with:

```sh
bun scripts/unit-scenes/reconstruct.ts scripts/rental-media/reconstruction/666-ofarrell-street-27.sources.json /tmp/sf-layout.json
```

The command requires `MODEL_API_KEY` in the process environment. `scripts/unit-scenes/appearance.ts` runs the separate photo-based finishes/fixtures pass. Rejected detail passes keep the validated layout; the saved logs preserve validator errors and actual model usage.

Deploying and reseeding is the deployment owner's step after merge. No Convex deployment, codegen, seed reset or database writes were run from this worktree.

## Observed model results

| Unit | Layout | Appearance |
| --- | --- | --- |
| 525 Leavenworth #18, studio | 6 spaces, 19 walls; valid, 1 attempt | Not run |
| 2775 Market #306, 1BR | 8 spaces, 21 walls; valid, 2 attempts | Rejected after 3 attempts; object bounds and closet-door clearance |
| 666 O'Farrell #27, 2BR | 11 spaces, 35 walls; valid, 2 attempts | Rejected after 3 attempts; object bounds and doorway clearance |

Spaces include closets and halls. All three layouts rendered in the production editor's review page. Layout inference cost $1.3080296 total; the two rejected detail passes cost $2.385212 total. These are actual logged API costs. No geometry or fixture coordinates were edited by hand. The detail-placement limitation is tracked in [#125](https://github.com/IBS27/landing/issues/125); clear input evidence does not guarantee correct fixture placement.
