/** Seattle-area neighborhoods used for Marketplace locations, with approximate centers. */
export const neighborhoods = {
  "Capitol Hill": { city: "Seattle, WA", lat: 47.6253, lng: -122.3222 },
  "U District": { city: "Seattle, WA", lat: 47.6615, lng: -122.3138 },
  Ballard: { city: "Seattle, WA", lat: 47.6687, lng: -122.3847 },
  Fremont: { city: "Seattle, WA", lat: 47.6505, lng: -122.3509 },
  Wallingford: { city: "Seattle, WA", lat: 47.6615, lng: -122.3346 },
  "Queen Anne": { city: "Seattle, WA", lat: 47.6374, lng: -122.3571 },
  "Beacon Hill": { city: "Seattle, WA", lat: 47.5668, lng: -122.3087 },
  "Columbia City": { city: "Seattle, WA", lat: 47.5597, lng: -122.2868 },
  Greenwood: { city: "Seattle, WA", lat: 47.6908, lng: -122.3553 },
  Roosevelt: { city: "Seattle, WA", lat: 47.6786, lng: -122.3176 },
  "South Lake Union": { city: "Seattle, WA", lat: 47.6256, lng: -122.3344 },
  "West Seattle": { city: "Seattle, WA", lat: 47.5707, lng: -122.3866 },
  "First Hill": { city: "Seattle, WA", lat: 47.6087, lng: -122.3245 },
  Northgate: { city: "Seattle, WA", lat: 47.7062, lng: -122.3251 },
  Bellevue: { city: "Bellevue, WA", lat: 47.6101, lng: -122.2015 },
  Redmond: { city: "Redmond, WA", lat: 47.674, lng: -122.1215 },
  Kirkland: { city: "Kirkland, WA", lat: 47.6769, lng: -122.206 },
} as const;

export type Neighborhood = keyof typeof neighborhoods;
