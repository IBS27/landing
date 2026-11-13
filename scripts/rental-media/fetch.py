"""Refresh the reviewed, single-level SF reference units. No Convex writes.
Run: python3 scripts/rental-media/fetch.py
Photo/plan originals remain attributed to their publishing listing. Demo terms are fictional.
"""
import concurrent.futures
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / 'convex/seed/rentalMedia.json'
PREVIOUS = {m['url']: m['sourceUrl'] for u in json.loads(CATALOG.read_text()) for m in [*u['media']['photos'], u['media']['floorPlan']]} if CATALOG.exists() else {}


def request(url, data=None):
    return urllib.request.urlopen(urllib.request.Request(
        url, data=json.dumps(data).encode() if data else None,
        headers={'Content-Type': 'application/json', 'User-Agent': 'Landing listing evidence review'},
    ), timeout=60).read()


def collect(slug):
    listing = json.loads(request('https://backend.real.vision/v1/listing/get', {'tourName': slug}))
    assert not listing['offline'] and not listing.get('passcode')
    assert len(listing['floorplan']['floors']) == 1
    floor = listing['floorplan']['floors'][0]
    groups = []
    group = None
    for photo in listing['photos']:
        if photo['hidden']:
            continue
        if photo.get('caption') and re.search(r'fitness|party room|conference|pool', photo['caption'], re.I):
            break
        if photo.get('caption'):
            group = {'label': re.sub(r'\bBedrom\b', 'Bedroom', photo['caption'], flags=re.I), 'photos': []}
            groups.append(group)
        if group:
            group['photos'].append(photo)
    excluded = re.compile(r'exterior|entrance|stairs|lobby|mail|elevator|hallway|unit #|courtyard|fitness|party|conference|terrace|bbq|pool|garage|parking|charger|tennis|shared|view|backyard|deck|patio|balcony', re.I)
    groups = [g for g in groups if not excluded.search(g['label']) and not re.search(r'laundry', g['label'], re.I)]
    # All distinct rooms first, then alternate views. Never truncate away a bathroom/bedroom.
    counts = {}
    for g in groups:
        label = g['label']
        counts[label] = counts.get(label, 0) + 1
        if counts[label] > 1:
            g['label'] += f" {counts[label]}"
    groups.sort(key=lambda g: (0 if 'living' in g['label'].lower() else 1))
    if len(groups) > 18:
        raise ValueError(f'{slug}: too many rooms for complete coverage')
    selected = [(g, 0) for g in groups]
    for i in range(1, 5):
        selected += [(g, i) for g in groups if len(g['photos']) > i and len(selected) < 18]
        selected = selected[:18]
    media = []
    for n, (g, i) in enumerate(selected):
        original = g['photos'][i]['url'] + '&size=1800x1200'
        path = f'/seed/rentals/{slug}/{n+1:02}.jpg'
        media.append({'url': path, 'sourceUrl': original, 'label': g['label'] + (f' · view {i+1}' if i else '')})
    plan = {'url': f'/seed/rentals/{slug}/floor-plan.jpg',
            'sourceUrl': floor['imageUrl']['imperial'].replace(':443', ''),
            'label': 'Published floor plan'}
    address = listing['address']['street']
    if listing['address'].get('unit'):
        address += ' #' + listing['address']['unit']
    room_names = [re.sub(r'\s+', ' ', r['name']).strip() for r in floor['rooms']]
    bedrooms = sum('BEDROOM' in r and 'LIVING' not in r for r in room_names)
    bathrooms = (listing['stats'].get('bathroomsPrimary') or 1) + 0.5 * (listing['stats'].get('bathroomsSecondary') or 0)
    labeled = [p['label'] for p in media if 'view' not in p['label']]
    photographed_beds = sum(bool(re.search('bedroom', label, re.I)) and not re.search('living', label, re.I) for label in labeled)
    photographed_baths = sum(0.5 if re.search('powder', label, re.I) else 1 if re.search('bathroom|ensuite', label, re.I) else 0 for label in labeled)
    if photographed_beds != bedrooms or photographed_baths != bathrooms:
        raise ValueError(f'{slug}: incomplete room coverage; choose a complete gallery')
    return {'slug': slug, 'address': address, 'point': listing['location'],
            'bedrooms': bedrooms, 'bathrooms': bathrooms,
            'sqft': round(sum(a['sqFt'] for a in floor['area'] if not a['label'])),
            'rooms': room_names,
            'media': {'sourceUrl': 'https://real.vision/' + slug,
                      'sourceName': 'Realvision', 'retrievedOn': datetime.now(timezone.utc).date().isoformat(),
                      'photos': media, 'floorPlan': plan}}


def download(media):
    path = ROOT / ('public' + media['url'])
    previous = PREVIOUS.get(media['url'])
    if path.exists() and previous == media['sourceUrl']:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    data = request(media['sourceUrl'])
    assert data[:2] == b'\xff\xd8', media['sourceUrl']
    path.write_bytes(data)


def main():
    # Pin reviewed tour names. Refreshing never imports arbitrary new listings.
    slugs = [u['slug'] for u in json.loads(CATALOG.read_text())]
    units = [collect(s) for s in slugs]
    with concurrent.futures.ThreadPoolExecutor(6) as pool:
        list(pool.map(download, [m for u in units for m in [*u['media']['photos'], u['media']['floorPlan']]]))
    for unit in units:
        keep = {Path(m['url']).name for m in [*unit['media']['photos'], unit['media']['floorPlan']]}
        for old in (ROOT / 'public/seed/rentals' / unit['slug']).glob('*.jpg'):
            if old.name not in keep:
                old.unlink()
    CATALOG.write_text(json.dumps(units, indent=2) + '\n')
    print(f"Saved {len(units)} same-unit galleries and plans; {sum(len(u['media']['photos']) for u in units)} photos")

if __name__ == '__main__':
    main()
