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
    "N 35th St & Evanston Ave N, Fremont": ("cascade-boulders", 47.65034, -122.35131),
    "NE 54th St & 20th Ave NE, Ravenna": ("ravenna-54th-20th", 47.66805, -122.30595),
    "185 E Stevens Way NE, University of Washington": ("uw-allen-center", 47.65345, -122.30585),
    "E Pike St & 12th Ave, Capitol Hill": ("pike-12th", 47.61405, -122.31684),
    "NW Market St & 22nd Ave NW, Ballard": ("market-22nd", 47.66862, -122.38458),
    "E Pine St & 10th Ave, Capitol Hill": ("pine-10th", 47.61540, -122.31952),
    "NE 47th St & 17th Ave NE, U District": ("ne47th-17th", 47.66305, -122.30964),
    "2101 N Northlake Way, Wallingford": ("gas-works-park", 47.64560, -122.33440),
    "Westlake Ave N & Valley St, South Lake Union": ("westlake-valley", 47.62593, -122.33848),
    "E Olive Way & Summit Ave E, Capitol Hill": ("olive-summit", 47.61847, -122.32575),
    "Westlake Ave N & Mercer St, South Lake Union": ("westlake-mercer", 47.62460, -122.33853),
    "University Way NE & NE 45th St, U District": ("ave-45th", 47.66130, -122.31317),
    "Fremont Ave N & N 36th St, Fremont": ("fremont-36th", 47.65150, -122.35000),
    "W Green Lake Dr N & N 72nd St, Green Lake": ("green-lake-72nd", 47.68167, -122.34328),
    "Cedar Falls Rd SE, North Bend": ("rattlesnake-ledge", 47.43460, -121.76870),
    "NE 50th St & Brooklyn Ave NE, U District": ("ne50th-brooklyn", 47.66493, -122.31415),
    "Lake Washington Blvd S & S Genesee St, Seward Park": ("lwb-genesee", 47.56326, -122.26835),
    "Western Ave & Union St, Downtown": ("western-union", 47.60742, -122.34031),
    "Ballard Ave NW & Vernon Pl NW, Ballard": ("ballard-vernon", 47.66719, -122.38403),
    "4060 George Washington Ln NE, University of Washington": ("uw-odegaard", 47.65650, -122.31040),
    "1635 11th Ave, Capitol Hill": ("cal-anderson", 47.61720, -122.31920),
}

# Listing neighborhoods (match convex/lib/listings.ts NEIGHBORHOODS) plus the
# Marketplace browse cities. Zoom 12: a 668x420 dialog map and a 324x162 item tile.
HOODS = {
    "Capitol Hill": (47.6253, -122.3222),
    "U District": (47.6615, -122.3138),
    "Ballard": (47.6687, -122.3847),
    "Fremont": (47.6505, -122.3509),
    "Wallingford": (47.6615, -122.3346),
    "Queen Anne": (47.6374, -122.3571),
    "Beacon Hill": (47.5668, -122.3087),
    "Columbia City": (47.5597, -122.2868),
    "Greenwood": (47.6908, -122.3553),
    "Roosevelt": (47.6786, -122.3176),
    "South Lake Union": (47.6256, -122.3344),
    "West Seattle": (47.5707, -122.3866),
    "First Hill": (47.6087, -122.3245),
    "Northgate": (47.7062, -122.3251),
    "Bellevue": (47.6101, -122.2015),
    "Redmond": (47.674, -122.1215),
    "Kirkland": (47.6769, -122.206),
    "Seattle": (47.6062, -122.3321),
}

# Marketplace browse cities (convex/lib/listings.ts PLACES): zoom 7, 520x220.
CITIES = {
    "Seattle": (47.6062, -122.3321),
    "Bellevue": (47.6101, -122.2015),
    "Redmond": (47.674, -122.1215),
    "Kirkland": (47.6769, -122.206),
    "Renton": (47.4829, -122.2171),
    "Tacoma": (47.2529, -122.4443),
    "Everett": (47.979, -122.2021),
    "Portland": (45.5152, -122.6784),
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
        "/** Marketplace browse-location maps (zoom 7, 520x220, ~0.82 km per px at 47.6N). */\n"
        f"export const REGION_MAPS: Record<string, string> = {json.dumps(regions, indent=2)};\n"
    )
    os.makedirs(os.path.dirname(CATALOG), exist_ok=True)
    with open(CATALOG, "w") as f:
        f.write(body)


main()
