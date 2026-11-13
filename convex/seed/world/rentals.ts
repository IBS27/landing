import { daysFromNow } from "../lib/time";
import units from "../rentalMedia.json";
import type { ListingSeed, Neighborhood, Username } from "../types";

// Preserve natural keys used by conversations, saves and vouches. Sellers and terms are fictional.
const identities = [
  {
    key: "derek-mission-1br",
    listed: {
      kind: "clock",
      days: -5,
      hm: "09:30",
    },
    seller: "derek.holloway",
    unit: "1454-south-van-ness-avenue-1-1",
    listingType: "rent",
    privateRoom: false,
  },
  {
    key: "derek-elmwood-studio",
    listed: {
      kind: "clock",
      days: -6,
      hm: "10:15",
    },
    seller: "derek.holloway",
    unit: "525-leavenworth-street-18",
    listingType: "rent",
    privateRoom: false,
  },
  {
    key: "derek-haight-2br",
    listed: {
      kind: "clock",
      days: -10,
      hm: "11:00",
    },
    seller: "derek.holloway",
    unit: "1670-page-street-a",
    listingType: "rent",
    privateRoom: false,
  },
  {
    key: "derek-elmwood-duplex-2br",
    listed: {
      kind: "clock",
      days: -18,
      hm: "09:45",
    },
    seller: "derek.holloway",
    unit: "666-ofarrell-street-27",
    listingType: "rent",
    privateRoom: false,
  },
  {
    key: "derek-rockridge-1br",
    condo: true,
    listed: {
      kind: "clock",
      days: -1,
      hm: "10:30",
    },
    seller: "derek.holloway",
    unit: "2775-market-street-306",
    listingType: "rent",
    privateRoom: false,
  },
  {
    key: "derek-sunset-house",
    listed: {
      kind: "clock",
      days: -24,
      hm: "13:00",
    },
    seller: "derek.holloway",
    unit: "869-30th-avenue",
    listingType: "rent",
    privateRoom: false,
  },
  {
    key: "fatima-berkeley-sublet",
    listed: {
      kind: "clock",
      days: -6,
      hm: "20:30",
    },
    seller: "fatima.hassan",
    unit: "66-cleary-court-1104",
    listingType: "sublet",
    privateRoom: true,
    availableTo: {
      kind: "offset",
      ms: 25228800000,
    },
  },
  {
    key: "priya-elmwood-room",
    listed: {
      kind: "clock",
      days: -10,
      hm: "19:00",
    },
    seller: "priya.raman",
    unit: "80-blake-street-a",
    listingType: "sublet",
    privateRoom: true,
    availableTo: {
      kind: "offset",
      ms: 18576000000,
    },
  },
  {
    key: "samir-berkeley-room",
    listed: {
      kind: "clock",
      days: -7,
      hm: "21:00",
    },
    seller: "samir.khan",
    unit: "1540-newhall-street-lower-1",
    listingType: "rent",
    privateRoom: true,
  },
  {
    key: "sophie-elmwood-room",
    listed: {
      kind: "clock",
      days: -14,
      hm: "18:30",
    },
    seller: "sophie.dubois",
    unit: "169-fair-oaks-street-01",
    listingType: "rent",
    privateRoom: true,
  },
  {
    key: "lily-berkeley-room",
    listed: {
      kind: "clock",
      days: -3,
      hm: "17:45",
    },
    seller: "lily.anderson",
    unit: "764-natoma-street",
    listingType: "rent",
    privateRoom: true,
  },
  {
    key: "noah-rockridge-room",
    listed: {
      kind: "clock",
      days: -9,
      hm: "20:10",
    },
    seller: "noah.williams",
    unit: "350-24th-avenue-3",
    listingType: "rent",
    privateRoom: true,
    availableTo: {
      kind: "offset",
      ms: 22550400000,
    },
  },
  {
    key: "nina-mission-room",
    listed: {
      kind: "clock",
      days: -2,
      hm: "12:20",
    },
    seller: "nina.petrova",
    unit: "173-fair-oaks-street-173-02",
    listingType: "rent",
    privateRoom: true,
  },
  {
    key: "camila-mission-room",
    listed: {
      kind: "clock",
      days: -12,
      hm: "15:40",
    },
    seller: "camila.santos",
    unit: "942-divisadero-street-301",
    listingType: "rent",
    privateRoom: true,
  },
  {
    key: "malik-mission-room",
    listed: {
      kind: "clock",
      days: -20,
      hm: "16:00",
    },
    seller: "malik.johnson",
    unit: "173-fair-oaks-street-167-05",
    listingType: "rent",
    privateRoom: true,
  },
  {
    key: "kai-haight-room",
    listed: {
      kind: "clock",
      days: -8,
      hm: "09:20",
    },
    seller: "kai.nakamura",
    unit: "2170-fell-street",
    listingType: "rent",
    privateRoom: true,
  },
  {
    key: "erin-richmond-room",
    listed: {
      kind: "clock",
      days: -15,
      hm: "19:30",
    },
    seller: "erin.mcallister",
    unit: "747-16th-avenue-a",
    listingType: "rent",
    privateRoom: true,
  },
  {
    key: "arjun-oakland-room",
    listed: {
      kind: "clock",
      days: -11,
      hm: "08:40",
    },
    seller: "arjun.mehta",
    unit: "333-main-street-8g",
    listingType: "rent",
    privateRoom: true,
  },
  {
    key: "rohan-mountain-view-room",
    listed: {
      kind: "clock",
      days: -4,
      hm: "21:15",
    },
    seller: "rohan.iyer",
    unit: "208-north-lake-merced-hills-3a",
    listingType: "rent",
    privateRoom: true,
  },
  {
    key: "jiho-berkeley-studio",
    listed: {
      kind: "clock",
      days: -6,
      hm: "14:30",
    },
    seller: "jiho.choi",
    unit: "520-geary-street-509",
    listingType: "sublet",
    privateRoom: false,
    availableTo: {
      kind: "offset",
      ms: 19872000000,
    },
  },
  {
    key: "harper-mission-studio",
    listed: {
      kind: "clock",
      days: -1,
      hm: "18:40",
    },
    seller: "harper.quinn",
    unit: "970-post-street-11-1",
    listingType: "sublet",
    privateRoom: false,
    availableTo: {
      kind: "offset",
      ms: 9331200000,
    },
  },
  {
    key: "olivia-rockridge-studio",
    listed: {
      kind: "offset",
      ms: -64800000,
    },
    seller: "olivia.brooks",
    unit: "860-bush-street-603",
    listingType: "rent",
    privateRoom: false,
    availableTo: {
      kind: "offset",
      ms: 22550400000,
    },
  },
  {
    key: "grace-pacheights-1br",
    condo: true,
    listed: {
      kind: "clock",
      days: -16,
      hm: "12:00",
    },
    seller: "grace.liu",
    unit: "2345-jackson-street-1",
    listingType: "rent",
    privateRoom: false,
    availableTo: {
      kind: "offset",
      ms: 19872000000,
    },
  },
  {
    key: "ryan-pacheights-2br",
    condo: true,
    listed: {
      kind: "clock",
      days: -5,
      hm: "19:15",
    },
    seller: "ryan.oconnor",
    unit: "425-1st-street-3103",
    listingType: "rent",
    privateRoom: false,
  },
  {
    key: "aisha-bernal-2br",
    listed: {
      kind: "clock",
      days: -9,
      hm: "18:00",
    },
    seller: "aisha.rahman",
    unit: "926-esmeralda-avenue",
    listingType: "rent",
    privateRoom: false,
  },
  {
    key: "jamal-dogpatch-townhouse",
    listed: {
      kind: "clock",
      days: -21,
      hm: "10:45",
    },
    seller: "jamal.wilson",
    unit: "554a-natoma-street-a",
    listingType: "rent",
    privateRoom: false,
  },
  {
    key: "chris-mountain-view-2br",
    listed: {
      kind: "clock",
      days: -30,
      hm: "17:30",
    },
    seller: "chris.adeyemi",
    unit: "960-market-street-1109",
    listingType: "rent",
    privateRoom: false,
    availableTo: {
      kind: "offset",
      ms: 25228800000,
    },
  },
  {
    key: "tara-sunset-house",
    listed: {
      kind: "clock",
      days: -13,
      hm: "14:20",
    },
    seller: "tara.singh",
    unit: "565-page-street-6",
    listingType: "rent",
    privateRoom: false,
  },
  {
    key: "derek-bernal-townhouse-sale",
    listed: {
      kind: "clock",
      days: -4,
      hm: "11:00",
    },
    seller: "derek.holloway",
    unit: "484-alvarado-street",
    listingType: "sale",
    privateRoom: false,
  },
  {
    key: "erin-richmond-house-sale",
    listed: {
      kind: "clock",
      days: -9,
      hm: "16:30",
    },
    seller: "erin.mcallister",
    unit: "4639-18th-street",
    listingType: "sale",
    privateRoom: false,
  },
] as const;

const hoodByUnit: Record<string, Neighborhood> = {
  "1454-south-van-ness-avenue-1-1": "Mission",
  "525-leavenworth-street-18": "Tenderloin",
  "1670-page-street-a": "Haight-Ashbury",
  "666-ofarrell-street-27": "Tenderloin",
  "2775-market-street-306": "Castro",
  "869-30th-avenue": "Outer Richmond",
  "66-cleary-court-1104": "Western Addition",
  "80-blake-street-a": "Presidio Heights",
  "1540-newhall-street-lower-1": "Bayview Hunters Point",
  "169-fair-oaks-street-01": "Mission",
  "764-natoma-street": "SoMa",
  "350-24th-avenue-3": "Outer Richmond",
  "173-fair-oaks-street-173-02": "Mission",
  "942-divisadero-street-301": "Western Addition",
  "173-fair-oaks-street-167-05": "Mission",
  "2170-fell-street": "Lone Mountain/USF",
  "747-16th-avenue-a": "Outer Richmond",
  "333-main-street-8g": "Financial District/South Beach",
  "208-north-lake-merced-hills-3a": "Lakeshore",
  "520-geary-street-509": "Tenderloin",
  "970-post-street-11-1": "Nob Hill",
  "860-bush-street-603": "Nob Hill",
  "2345-jackson-street-1": "Pacific Heights",
  "425-1st-street-3103": "Financial District/South Beach",
  "926-esmeralda-avenue": "Bernal Heights",
  "554a-natoma-street-a": "SoMa",
  "960-market-street-1109": "Tenderloin",
  "565-page-street-6": "Hayes Valley",
  "484-alvarado-street": "Noe Valley",
  "4639-18th-street": "Castro",
};

/** Real, same-unit evidence with published plans. Never advertise source availability as live. */
export const rentals: readonly ListingSeed[] = identities.map((identity, i) => {
  const unit = units.find((u) => u.slug === identity.unit);
  if (!unit) throw new Error(`Missing rental evidence for ${identity.unit}`);
  const name = unit.bedrooms ? `${unit.bedrooms}BR` : "Studio";
  const price = identity.privateRoom
    ? 1300 + (i % 5) * 100
    : identity.listingType === "sale"
      ? 425000 + unit.bedrooms * 275000
      : 2350 + unit.bedrooms * 850 + (i % 4) * 100;
  return {
    key: identity.key,
    seller: identity.seller as Username,
    title: `${identity.privateRoom ? `Private room in a ${name} apartment` : name} · ${unit.address}`,
    price,
    category: identity.listingType === "sale" ? "homesales" : "propertyrentals",
    description: `${identity.privateRoom ? "Demo private-room offer. The photos and plan cover the whole apartment; confirm which bedroom is offered before arranging a tour. " : ""}Demo listing using a real San Francisco unit at ${unit.address}. The room photos and published floor plan all describe this unit. ${unit.bedrooms ? `${unit.bedrooms} bedrooms` : "Studio"}, ${unit.bathrooms} bathroom${unit.bathrooms === 1 ? "" : "s"}, approximately ${unit.sqft} sq ft.

Photos include the kitchen, every bedroom and bathroom, and the connecting spaces shown in the source gallery. The publisher's floor plan is approximate; confirm dimensions before buying furniture.

The seller, price and availability shown in Landing are fictional demo terms. This is not an offer from the original agent. Source media: ${unit.media.sourceUrl}, retrieved ${unit.media.retrievedOn}.`,
    photos: [], // The seed plan uses the explicit same-unit media, never the topic image picker.
    rentalMedia: unit.media,
    hood: hoodByUnit[unit.slug],
    point: unit.point,
    listed: identity.listed,
    views: 180 + i * 37,
    rental: {
      propertyType: identity.privateRoom
        ? "room"
        : identity.listingType === "sale" || "condo" in identity
          ? "condo"
          : unit.bedrooms
            ? "apartment"
            : "studio",
      listingType: identity.listingType,
      availableTo: "availableTo" in identity ? identity.availableTo : undefined,
      bedrooms: unit.bedrooms,
      bathrooms: unit.bathrooms,
      sqft: unit.sqft,
      availableFrom: daysFromNow(19),
      address: unit.address,
    },
  };
});
