# Map image attribution

The static maps in `public/seed/maps/` are rendered by `scripts/maps/build.py`: MapLibre GL draws
[OpenFreeMap](https://openfreemap.org/) vector tiles (OpenMapTiles schema) in headless Chrome, in
OpenFreeMap's light **Positron** style (derived from CARTO's Positron design, BSD/CC BY) and its
**Dark** style for dark mode (`dark/`). Images are 2x density WebP.

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the
[Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/). Vector tiles ©
[OpenMapTiles](https://openmaptiles.org/), served by [OpenFreeMap](https://openfreemap.org/). Positron
style © [CARTO](https://carto.com/attributions) / OpenMapTiles.
Every image carries the "© OpenStreetMap contributors © OpenMapTiles" credit in its bottom-left corner.

- `venues/*.webp`: zoom 16, 432x324, centred on each seeded event venue.
- `areas/<name>.webp`: zoom 12, 668x420 (Marketplace location dialog); `areas/<name>-tile.webp`: zoom 12,
  324x162 (item page map). Centred on each listing neighborhood or city.
- `regions/*.webp`: zoom 7, 520x220, centred on each Marketplace browse city (Change location dialog).
- `dark/**`: the same set in the dark style.

The tiles were fetched once at build time; the app never loads map tiles at runtime.
