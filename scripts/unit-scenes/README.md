# Muse unit reconstruction experiment

The public [Great Heathmead listing](https://www.holroydhomes.co.uk/property/great-heathmead-haywards-heath-rh16/143312-000227/1) supplies a floor-plan image, interior/exterior photos and a [134-second walkthrough](https://www.youtube.com/watch?v=UHonGRH6n1o). The video title is “Pinfold House”; sampled rooms and finishes correspond to the linked listing media. The listing was already marked let agreed when inspected on 2026-11-13.

Live runs through the production `runAgent` / Muse Wonder adapter produced the committed geometry and appearances. No room coordinates were corrected by hand.

- `heathmead.result.json`: floor plan + 12 photos. First attempt accepted, 8 spaces, 25 wall segments. Reported cost $0.362780.
- `heathmead-video.result.json`: the same inputs + the full MP4 walkthrough. First attempt accepted, 8 spaces, 29 wall segments. Reported cost $0.376848, elapsed 68 seconds. Notes cite video timestamps and explain uncertain geometry.

- `heathmead-detailed-initial.result.json`: appearance pass on the video layout. 18 fixtures / 131 parts, two attempts, $1.239464, 171 seconds. The initial bounds validator accepted its corrected output, but subsequent navigation checks found obstructed kitchen and bathroom-store approaches. This intermediate fixture is retained as failure evidence, not used as the default preview.
- `heathmead-detailed.result.json`: revised appearance with clearance feedback. 19 assemblies / 130 parts, three attempts, $1.5315696, 210 seconds. The validator rejected incorrect part bounds, oversized prose, and a remaining obstructed doorway before accepting the final output. Geometry coordinates remained unchanged; Muse adjusted fixture placements and split the lounge curtains.

The two layouts and final detailed output pass the current schema and geometry checks. A 10 cm navigation grid with an 18 cm walker radius reaches all eight room centers from the hall through modeled doorways, including fixture collisions in the final detailed output. This checks traversability, not similarity to reality.

## Fidelity assessment

The main room arrangement matches the plan: lounge on the left, two bedrooms across the top, kitchen below the lounge, an L-shaped hall, and bathroom below it. Both outputs retain the stepped bedroom boundary. They simplify the small kitchen cupboards and classify the unlabeled bathroom-side compartment as storage. That classification and its opening need human confirmation.

The photo and video runs disagree about which lounge wall contains the sliding door. The video-assisted result records that conflict rather than presenting it as measured fact. The walkthrough supports recognizing the glazed doors and finishes, but it does not settle orientation automatically. The photo/video baselines are architectural shells. The detailed result adds recognizable kitchen and bathroom fixtures, radiators, curtains, source-derived colors, and procedural finishes. The viewer adds beveled edges, physical texture scale, trim, reflections, shadows, and a cutaway option.

The detailed result remains an approximate simulation. In the rendered kitchen, wall cupboards overlap the modeled window area; the layout and appearance disagree there. Bathroom patterning is replaced by an averaged color and generic tile grid. Hidden surfaces and precise orientations are inferred. These are documented fidelity failures, not recovered photographic detail. Navigation validity does not establish visual or dimensional accuracy.

[Rumi](https://github.com/IBS27/rumi) was used as the implementation reference. Its captured-surface pipeline has measured meshes and calibrated camera poses. This experiment has neither, and does not claim equivalent scan fidelity.

The floor plan contains no printed dimensions. Absolute size is estimated in both results. These runs cannot establish dimensional error or furniture-fit accuracy. A dimensioned plan or a supplied measurement is needed to evaluate that next.

## Reproduce

The first run requires a Meta Model API key in the process environment. Never commit it.

```sh
bun scripts/unit-scenes/reconstruct.ts scripts/unit-scenes/heathmead.sources.json /tmp/unit-result.json
```

For the video run, download the listing's linked tour for local analysis, then copy the source manifest to a temporary file and append a source with `key: "video-tour"`, `kind: "video"`, a descriptive `label`, and `localFile` pointing to that MP4. The script sends it as inline video bytes. Source media is not committed.

```sh
bun scripts/unit-scenes/reconstruct.ts /tmp/with-video.sources.json /tmp/unit-video-result.json
```

To add visible finishes and fixtures to a layout:

```sh
bun scripts/unit-scenes/appearance.ts /tmp/with-video.sources.json scripts/unit-scenes/heathmead-video.result.json /tmp/unit-detailed.json
```

To reproduce the correction stage, use `heathmead-detailed-initial.result.json` as the layout input. The script supplies the previous appearance and current validation failures to Muse. Outputs vary between runs. The four recorded runs cost $3.5106616 in total, including rejected attempts.

The offline action context supplies the existing agent's source/cache/log calls locally. Actual inference uses Meta's API through the production adapter. No Convex commands or deployment writes occur. Output records include the model, attempt count, usage, elapsed time and validation result.

Open `/scripts/unit-scenes/preview.html` on this checkout's Vite server. It uses the production editor and allows switching between the photo layout, video layout, and corrected detailed reconstruction. Edits on this review page stay in browser storage. The app route `/landing/place/unit` uses private Convex records instead.

For UI verification against that running preview:

```sh
CHROMIUM_PATH=/path/to/chrome bun scripts/unit-scenes/verify-browser.ts http://host:port/scripts/unit-scenes/preview.html
```

This tests rendering, mode switches, keyboard turning, furniture editing, overlap warnings, save/reload, shared-corner editing and mobile overflow. It saves screenshots under `/tmp/landing-unit-evidence/`.
