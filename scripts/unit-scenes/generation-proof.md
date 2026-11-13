# Progressive unit generation proof

Run `bun scripts/unit-scenes/serve-generation.ts 127.0.0.1 5173`, then open
`/scripts/unit-scenes/generation.html`. This development-only page uses the production
`UnitWorkspace`, editor, scene renderer and registered `unitScenes`/job handlers.
Its database and scheduler are isolated in memory; Meta replies replay committed,
real Muse scene fixtures. It never contacts a Convex deployment. Reloading the page
retains the server's saved scene; restarting this proof server resets its fixture.

Browser verification on Fedora, 2026-11-13:

- A first Generate shows the plan/progress, then eight rooms before finishes arrive.
  No Review/Apply step; the saved scene is visible after reload.
- Layout failure shows Retry generation and the source plan, with no example cube.
  Switching the fixture to success and retrying makes a fresh model request.
- Details failure retains rooms and offers Retry missing details. Retrying enriches
  the existing viewer. After walking/turning, camera position and quaternion were
  identical before and after the appearance update.
- Adding furniture disables generation while unsaved. Saving and regenerating
  displays a candidate while retaining the manually edited layout and placements.
  Accepting the candidate and reloading retains the furniture.
- Saving furniture on the unchanged starter rectangle and reloading opens the saved editor.
  Generated previews keep furniture read-only until accepted.
- No new runtime exceptions during these flows. The browser log contained connection
  errors from restarting the isolated proof server, plus existing Three.js deprecation
  warnings; these were distinct from the app interactions.

The handler tests additionally cover duplicate requests, edits during generation,
source refresh while an old job runs, superseded jobs, preserving private uploads, saving
after imported evidence is removed, and detail retries preserving existing fixtures/materials.

## Real Muse appearance calls

The production `appearance.ts` adapter was run against both previously failing SF
fixtures with Muse Wonder 1.0, high effort, on 2026-11-13. Each used one model attempt.
Existing validation remained enabled; the final scenes had zero validation errors.

- 666 O'Farrell #27: 8 retained assemblies / 50 parts; 5 omitted details, with reasons;
  144,934 ms; reported estimated API cost $0.385748.
- 2775 Market #306: 7 retained assemblies / 24 parts; 9 omitted details, with reasons;
  147,587 ms; reported estimated API cost $0.3857368.

Raw outputs were inspected locally at `/tmp/landing-666-ofarrell-street-27-partial-proof.json`
and `/tmp/landing-2775-market-street-306-partial-proof.json`. They are not application
fixtures and are not committed. To repeat with an authorized MODEL_API_KEY:

```sh
bun scripts/unit-scenes/appearance.ts \
  scripts/rental-media/reconstruction/666-ofarrell-street-27.sources.json \
  scripts/rental-media/reconstruction/666-ofarrell-street-27.result.json \
  /tmp/appearance-proof.json
```

This verifies usable partial detail, not complete or photorealistic reconstruction.
Shared Convex was not deployed from the worktree. Its owner must deploy the merged
backend normally before using the new workflow against that deployment.
