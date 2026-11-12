"""Build static map images for seeded places from OpenStreetMap raster tiles.

One-time generator: fetches only the tiles that intersect each crop (cached on
disk, sequential, generic UA, polite delay), stitches them with Pillow and
renders the required "© OpenStreetMap contributors" attribution.

Usage: python3 -I scripts/maps/build.py [--dry]   (needs Pillow)
Tiles are cached in scripts/maps/tiles/ (gitignored); MAP_TILE_CACHE overrides it.
"""

import json
import math
import os
import sys
import time
import urllib.request

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
DRY = "--dry" in sys.argv
CACHE = os.environ.get("MAP_TILE_CACHE", os.path.join(HERE, "tiles"))
OUT = os.path.join(ROOT, "public/seed/maps")
CATALOG = os.path.join(ROOT, "src/features/maps/catalog.ts")
UA = "seed-fetch/1.0"
FONT = "/usr/share/fonts/liberation-sans-fonts/LiberationSans-Regular.ttf"

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
# Marketplace browse cities. Zoom 12: a 668x420 dialog map and a 323x51 strip.
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


def world(lat, lng, z):
    """Global pixel coordinates at zoom z (256px tiles)."""
    n = 256 * 2**z
    x = (lng + 180) / 360 * n
    s = math.sin(math.radians(lat))
    y = (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * n
    return x, y


def tiles_for(lat, lng, z, w, h):
    cx, cy = world(lat, lng, z)
    x0, y0 = cx - w / 2, cy - h / 2
    tx = range(int(x0 // 256), int((x0 + w - 1) // 256) + 1)
    ty = range(int(y0 // 256), int((y0 + h - 1) // 256) + 1)
    return x0, y0, [(z, x, y) for x in tx for y in ty]


def fetch(z, x, y):
    path = os.path.join(CACHE, str(z), str(x), f"{y}.png")
    if os.path.exists(path):
        return path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    req = urllib.request.Request(
        f"https://tile.openstreetmap.org/{z}/{x}/{y}.png", headers={"User-Agent": UA}
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    with open(path, "wb") as f:
        f.write(data)
    time.sleep(0.6)
    return path


def render(lat, lng, z, w, h, out):
    x0, y0, tiles = tiles_for(lat, lng, z, w, h)
    img = Image.new("RGB", (w, h), "#f2efe9")
    for tz, tx, ty in tiles:
        tile = Image.open(fetch(tz, tx, ty)).convert("RGB")
        img.paste(tile, (int(round(tx * 256 - x0)), int(round(ty * 256 - y0))))
    # Required attribution, small, bottom-left (the "i" badge sits bottom-right).
    draw = ImageDraw.Draw(img, "RGBA")
    font = ImageFont.truetype(FONT, 9)
    text = "© OpenStreetMap contributors"
    l, t, r, b = draw.textbbox((0, 0), text, font=font)
    pad = 2
    bw, bh = r - l + pad * 2, b - t + pad * 2
    draw.rectangle((0, h - bh, bw, h), fill=(255, 255, 255, 190))
    draw.text((pad - l, h - bh + pad - t), text, font=font, fill=(60, 60, 60, 255))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    img.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(out, "PNG", optimize=True)


def jobs():
    for _addr, (key, lat, lng) in VENUES.items():
        yield lat, lng, 16, 432, 324, f"venues/{key}.png"
    for name, (lat, lng) in HOODS.items():
        yield lat, lng, 12, 668, 420, f"areas/{slug(name)}.png"
        yield lat, lng, 12, 323, 51, f"areas/{slug(name)}-strip.png"
    for name, (lat, lng) in CITIES.items():
        yield lat, lng, 7, 520, 220, f"regions/{slug(name)}.png"


def main():
    needed = set()
    for lat, lng, z, w, h, _ in jobs():
        needed.update(tiles_for(lat, lng, z, w, h)[2])
    cached = sum(
        os.path.exists(os.path.join(CACHE, str(z), str(x), f"{y}.png")) for z, x, y in needed
    )
    print(f"{len(needed)} distinct tiles ({cached} cached)")
    if DRY:
        by_z = {}
        for z, _, _ in needed:
            by_z[z] = by_z.get(z, 0) + 1
        print(by_z)
        return
    for lat, lng, z, w, h, out in jobs():
        render(lat, lng, z, w, h, os.path.join(OUT, out))
    write_catalog()


def write_catalog():
    venues = {addr: f"/seed/maps/venues/{key}.png" for addr, (key, _, _) in VENUES.items()}
    areas = {
        name: {
            "map": f"/seed/maps/areas/{slug(name)}.png",
            "strip": f"/seed/maps/areas/{slug(name)}-strip.png",
            "lat": lat,
            "lng": lng,
        }
        for name, (lat, lng) in HOODS.items()
    }
    regions = {name: f"/seed/maps/regions/{slug(name)}.png" for name in CITIES}
    body = (
        "// Generated by scripts/maps/build.py (OpenStreetMap tiles, see public/seed/maps/ATTRIBUTION.md).\n"
        "// Do not edit by hand.\n\n"
        "/** Event venue maps (zoom 16, 432x324), keyed by the seeded address. */\n"
        f"export const VENUE_MAPS: Record<string, string> = {json.dumps(venues, indent=2)};\n\n"
        "/** Neighborhood/city maps (zoom 12): a 668x420 dialog map and a 323x51 strip. */\n"
        "export const AREA_MAPS: Record<string, { map: string; strip: string; lat: number; lng: number }> = "
        f"{json.dumps(areas, indent=2)};\n\n"
        "/** Marketplace browse-location maps (zoom 7, 520x220, ~0.82 km per px at 47.6N). */\n"
        f"export const REGION_MAPS: Record<string, string> = {json.dumps(regions, indent=2)};\n"
    )
    os.makedirs(os.path.dirname(CATALOG), exist_ok=True)
    with open(CATALOG, "w") as f:
        f.write(body)


main()
