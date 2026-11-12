# Map image attribution

The static maps in `public/seed/maps/` are rendered from OpenStreetMap's standard raster tiles
(`tile.openstreetmap.org`), stitched and cropped by `scripts/maps/build.py`.

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the
[Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/). Map tiles rendered by the
OpenStreetMap Foundation's tile servers, licensed [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/).
Every image carries the "© OpenStreetMap contributors" credit in its bottom-left corner.

- `venues/*.png`: zoom 16, 432x324, centred on each seeded event venue.
- `areas/<name>.png`: zoom 12, 668x420 (Marketplace location dialog); `areas/<name>-strip.png`: zoom 12,
  323x51 (item page strip). Centred on each listing neighborhood or city.
- `regions/*.png`: zoom 7, 520x220, centred on each Marketplace browse city (Change location dialog).

The tiles were fetched once (122 tiles, cached, sequential with a delay) under the
[OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/); the app never loads OSM tiles at runtime.
