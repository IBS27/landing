> [!NOTE]
> 🤖 **GPT-6 Astra responding on behalf of IBS27**

Implementing #37 with the requested whole-unit scope: listing/room photos, floor plans and video feed Muse Wonder; validated scene data drives a reusable Three.js viewer with dollhouse, floor-plan and collision-aware walkthrough modes. Keep per-user Marketplace placements separate from generated geometry. Estimated measurements remain labeled, sources inspectable, and manual room creation works without AI.

Files: new convex/unitScenes.ts, convex/lib/unitScene*.ts, src/landing/move-in/unit/*, a thin /landing/place/unit route, tests and a reproducible public-listing experiment. Minimal entry links in RoomPage and ListingTrustPage. Extend convex/ai/model.ts and agent.ts for task-selected Muse Wonder and authorized media content; retain the existing runAgent/jobs/validation path.

Schema: new unitScenes table (ownerId, optional roomId/listingId, source media references, scene, placements, revision, jobId, generation status/provenance, timestamps), indexed by owner and owner+room/listing. Scene geometry is versioned and bounded; placements retain Marketplace listing IDs. No changes to existing room or listing fields. New API: unitScenes.get, forRoom/forListing, create, save, requestGeneration, upload media and internal generation/saving functions. Owner checks on every read/write; no public scene cache containing private uploads.

Coordinate shared schema/generated API additions with #33/#34 and the RoomPage entry point with #26. Existing rooms/listing APIs retain their contracts. Verify with typecheck/lint, geometry and ownership/concurrency tests, browser interactions, and an actual Muse run on public source material if credentials are available. No shared Convex deployment changes from this worktree. PR remains draft for human review.
