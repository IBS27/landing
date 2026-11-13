"""Build static map images for seeded places: Positron-style vector maps.

One-time generator. Each map is rendered by MapLibre in headless Chrome
(render.mjs + render.html) from OpenFreeMap's vector tiles (OpenMapTiles schema,
OpenStreetMap data) in the light "positron" style and, for dark mode, the "dark"
style under public/seed/maps/dark/. Images are 2x density; this script then adds
the required "© OpenStreetMap contributors © OpenMapTiles" credit, saves them as
WebP and writes src/features/maps/catalog.ts.

Usage: python3 -I scripts/maps/build.py [--dry | --finish]
  needs Pillow, bun, Chrome and playwright-core resolvable from scripts/maps
  (e.g. `bun add --no-save playwright-core@1.48.2`, or NODE_PATH pointing at one).
Raw screenshots go to scripts/maps/raw/ (gitignored).
"""

import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
DRY = "--dry" in sys.argv
FINISH_ONLY = "--finish" in sys.argv  # re-run post-processing on existing raw renders
RAW = os.path.join(HERE, "raw")
OUT = os.path.join(ROOT, "public/seed/maps")
CATALOG = os.path.join(ROOT, "src/features/maps/catalog.ts")
FONT = "/usr/share/fonts/liberation-sans-fonts/LiberationSans-Regular.ttf"
SCALE = 2  # output pixel density
STYLES = {"positron": "", "dark": "dark/"}  # OpenFreeMap style -> output prefix
ATTRIBUTION = "© OpenStreetMap contributors © OpenMapTiles"

# Item page map tile (CSS px).
TILE_W, TILE_H = 324, 162

# Event venues: exact address string -> (key, lat, lng). Zoom 16, 432x324.
VENUES = {
    "22nd St & Tennessee St, Dogpatch": ("sutro-boulders", 37.75788, -122.38927),
    "Regent St & Parker St, Berkeley": ("regent-parker", 37.86337, -122.25763),
    "Hearst Ave & Le Roy Ave, UC Berkeley": ("soda-hall", 37.87533, -122.25832),
    "Valencia St & 18th St, Mission": ("valencia-18th", 37.76170, -122.42160),
    "Clement St & 6th Ave, Inner Richmond": ("clement-6th", 37.78295, -122.46444),
    "Valencia St & 16th St, Mission": ("valencia-16th", 37.76492, -122.42191),
    "Channing Way & Bowditch St, Berkeley": ("channing-bowditch", 37.86721, -122.25655),
    "Marina Blvd & Mason St, Marina": ("crissy-field", 37.80502, -122.44787),
    "4th St & Brannan St, SoMa": ("4th-brannan", 37.77834, -122.39655),
    "Mission St & 22nd St, Mission": ("mission-22nd", 37.75544, -122.41877),
    "2nd St & Townsend St, SoMa": ("2nd-townsend", 37.78062, -122.39054),
    "Telegraph Ave & Durant Ave, Berkeley": ("telegraph-durant", 37.86784, -122.25903),
    "Haight St & Cole St, Haight-Ashbury": ("haight-cole", 37.76956, -122.45048),
    "50 Stow Lake Dr E, Golden Gate Park": ("stow-lake-boathouse", 37.77060, -122.47710),
    "Tennessee Valley Rd, Mill Valley": ("tennessee-valley", 37.86050, -122.53630),
    "Dwight Way & Ellsworth St, Berkeley": ("dwight-ellsworth", 37.86454, -122.26300),
    "Great Highway & Lincoln Way, Outer Sunset": ("great-hwy-lincoln", 37.76409, -122.51019),
    "The Embarcadero & Washington St, Embarcadero": ("embarcadero-washington", 37.79670, -122.39544),
    "Clement St & 2nd Ave, Inner Richmond": ("clement-2nd", 37.78315, -122.46015),
    "Moffitt Library, UC Berkeley": ("moffitt-library", 37.87250, -122.26080),
    "Dolores St & 19th St, Mission": ("dolores-park", 37.75983, -122.42594),
    # Curated activity-seed meeting points, also used by the address generator.
    "2295 Harrison St, Mission": ("activity-mission-0", 37.7601, -122.4125),
    "3225 22nd St, Mission": ("activity-mission-1", 37.7553, -122.4195),
    "3861 24th St, Noe Valley": ("activity-noe-2", 37.75138, -122.42898),
    "451 Jersey St, Noe Valley": ("activity-noe-3", 37.75024, -122.43512),
    "Bernal Heights Blvd & Folsom St, Bernal Heights": ("activity-bernal-4", 37.7433, -122.4135),
    "500 Cortland Ave, Bernal Heights": ("activity-bernal-5", 37.73886, -122.41615),
    "2573 3rd St, Dogpatch": ("activity-potrero-6", 37.7576, -122.3883),
    "Illinois St & 18th St, Dogpatch": ("activity-potrero-7", 37.76255, -122.38711),
    "Folsom St & Columbia Square, SoMa": ("activity-soma-8", 37.77689, -122.40583),
    "365 11th St, SoMa": ("activity-soma-9", 37.7714, -122.4142),
    "424 Octavia St, Hayes Valley": ("activity-hayes-10", 37.7761, -122.4243),
    "Hayes St & Octavia St, Hayes Valley": ("activity-hayes-11", 37.77623, -122.42444),
    "351 9th Ave, Inner Richmond": ("activity-inner-richmond-13", 37.7811, -122.4676),
    "851 38th Ave, Outer Richmond": ("activity-outer-richmond-14", 37.7725, -122.4982),
    "Moraga St & 14th Ave, Inner Sunset": ("activity-inner-sunset-15", 37.7565, -122.4714),
    "1305 18th Ave, Inner Sunset": ("activity-inner-sunset-16", 37.7635, -122.4765),
    "Judah St & La Playa St, Outer Sunset": ("activity-outer-sunset-17", 37.7603, -122.5089),
    "Great Highway & Rivera St, Outer Sunset": ("activity-outer-sunset-18", 37.7465, -122.5076),
    "Marina Blvd & Scott St, Marina": ("activity-marina-19", 37.8058, -122.4394),
    "Baker St & Bay St, Marina": ("activity-marina-20", 37.80292, -122.4484),
    "Roosevelt Way & Museum Way, Castro": ("activity-castro-21", 37.7648, -122.4393),
    "401 Castro St, Castro": ("activity-castro-22", 37.7624, -122.4351),
    "1855 Haight St, Haight-Ashbury": ("activity-haight-23", 37.7698, -122.4522),
    "Haight St & Buena Vista Ave E, Haight-Ashbury": ("activity-haight-24", 37.7702, -122.4407),
    "Union St & Stockton St, North Beach": ("activity-north-beach-25", 37.80087, -122.4101),
    "850 Columbus Ave, North Beach": ("activity-north-beach-26", 37.80255, -122.41314),
    "Grove St & Divisadero St, NoPa": ("activity-western-addition-27", 37.7754, -122.4381),
    "Geary Blvd & Steiner St, Western Addition": ("activity-western-addition-28", 37.7829, -122.4348),
    "Chestnut St & Fillmore St, Marina": ("activity-marina-carpool-29", 37.8002, -122.4366),
    "100 Larkin St, Civic Center": ("activity-main-library-30", 37.7792, -122.4157),
}

# Listing neighborhoods (match convex/lib/listings.ts NEIGHBORHOODS) plus the
# Marketplace browse cities. Zoom 12: a 668x420 dialog map and a 324x162 item tile.
HOODS = {
    "Mission": (37.7599, -122.4148),
    "Berkeley": (37.867, -122.2584),
    "Inner Richmond": (37.7786, -122.4642),
    "Haight-Ashbury": (37.77, -122.447),
    "Elmwood": (37.8578, -122.2539),
    "Pacific Heights": (37.7927, -122.4356),
    "Bernal Heights": (37.741, -122.4142),
    "Dogpatch": (37.7607, -122.3892),
    "Inner Sunset": (37.7615, -122.4676),
    "Rockridge": (37.8448, -122.2513),
    "SoMa": (37.7809, -122.401),
    "Outer Sunset": (37.7541, -122.5062),
    "Nob Hill": (37.793, -122.4161),
    "Marina": (37.803, -122.4375),
    "Castro": (37.7626, -122.4353),
    "North Beach": (37.8012, -122.409),
    "Hayes Valley": (37.7767, -122.4229),
    "Noe Valley": (37.7516, -122.4321),
    "Oakland": (37.8045, -122.2714),
    "Mountain View": (37.3894, -122.0832),
    "Daly City": (37.6905, -122.4727),
    "San Francisco": (37.7749, -122.4194),
}

# Marketplace browse cities (convex/lib/listings.ts PLACES): zoom 7, 520x220.
CITIES = {
    "San Francisco": (37.7749, -122.4194),
    "Oakland": (37.8045, -122.2714),
    "Berkeley": (37.8708, -122.2729),
    "Daly City": (37.6905, -122.4727),
    "San Mateo": (37.4969, -122.3331),
    "Mountain View": (37.3894, -122.0832),
    "San Jose": (37.3362, -121.8906),
    "Sacramento": (38.5811, -121.4939),
}


def slug(s):
    return "".join(c if c.isalnum() else "-" for c in s.lower()).strip("-")


def finish(style, raw, w, h, out):
    img = Image.open(raw).convert("RGB")
    if style == "dark":
        # Lift the near-black style to Facebook's dark surface tone (#242526 cards).
        img = img.point(lambda v: round(22 + v * 0.95))
    k = SCALE
    # Required attribution, small, bottom-left (the "i" badge sits bottom-right).
    draw = ImageDraw.Draw(img, "RGBA")
    font = ImageFont.truetype(FONT, 8 * k)
    l, t, r, b = draw.textbbox((0, 0), ATTRIBUTION, font=font)
    pad = 2 * k
    bw, bh = r - l + pad * 2, b - t + pad * 2
    H = h * k
    if style == "positron":
        box, ink = (255, 255, 255, 170), (110, 110, 110, 255)
    else:
        box, ink = (0, 0, 0, 120), (160, 160, 160, 255)
    draw.rectangle((0, H - bh, bw, H), fill=box)
    draw.text((pad - l, H - bh + pad - t), ATTRIBUTION, font=font, fill=ink)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    img.save(out, "WEBP", quality=85, method=6)


def jobs():
    for _addr, (key, lat, lng) in VENUES.items():
        yield lat, lng, 16, 432, 324, f"venues/{key}.webp"
    for name, (lat, lng) in HOODS.items():
        yield lat, lng, 12, 668, 420, f"areas/{slug(name)}.webp"
        yield lat, lng, 12, TILE_W, TILE_H, f"areas/{slug(name)}-tile.webp"
    for name, (lat, lng) in CITIES.items():
        yield lat, lng, 7, 520, 220, f"regions/{slug(name)}.webp"


def main():
    work = []
    for style, prefix in STYLES.items():
        for lat, lng, z, w, h, out in jobs():
            raw = os.path.join(RAW, style, out) + ".png"
            os.makedirs(os.path.dirname(raw), exist_ok=True)
            work.append(dict(style=style, lat=lat, lng=lng, z=z, w=w, h=h, out=raw, final=os.path.join(OUT, prefix + out)))
    print(f"{len(work)} maps")
    if DRY:
        return
    spec = os.path.join(RAW, "jobs.json")
    with open(spec, "w") as f:
        json.dump(work, f)
    if not FINISH_ONLY:
        subprocess.run(["bun", os.path.join(HERE, "render.mjs"), spec], check=True)
    for j in work:
        finish(j["style"], j["out"], j["w"], j["h"], j["final"])
    write_catalog()


def write_catalog():
    venues = {addr: f"/seed/maps/venues/{key}.webp" for addr, (key, _, _) in VENUES.items()}
    areas = {
        name: {
            "map": f"/seed/maps/areas/{slug(name)}.webp",
            "tile": f"/seed/maps/areas/{slug(name)}-tile.webp",
            "lat": lat,
            "lng": lng,
        }
        for name, (lat, lng) in HOODS.items()
    }
    regions = {name: f"/seed/maps/regions/{slug(name)}.webp" for name in CITIES}
    body = (
        "// Generated by scripts/maps/build.py (OpenFreeMap vector tiles, OpenStreetMap data, see\n"
        "// public/seed/maps/ATTRIBUTION.md). Do not edit by hand. Images are 2x density; every\n"
        "// path has a Dark Matter twin under /seed/maps/dark/ (see mapSources).\n\n"
        "/** Event venue maps (zoom 16, 432x324), keyed by the seeded address. */\n"
        f"export const VENUE_MAPS: Record<string, string> = {json.dumps(venues, indent=2)};\n\n"
        f"/** Neighborhood/city maps (zoom 12): a 668x420 dialog map and a {TILE_W}x{TILE_H} item tile. */\n"
        "export const AREA_MAPS: Record<string, { map: string; tile: string; lat: number; lng: number }> = "
        f"{json.dumps(areas, indent=2)};\n\n"
        "/** Marketplace browse-location maps (zoom 7, 520x220, ~0.97 km per px at 37.8N). */\n"
        f"export const REGION_MAPS: Record<string, string> = {json.dumps(regions, indent=2)};\n"
    )
    os.makedirs(os.path.dirname(CATALOG), exist_ok=True)
    with open(CATALOG, "w") as f:
        f.write(body)


main()
