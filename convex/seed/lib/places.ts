/** San Francisco and East Bay / Peninsula neighborhoods used for Marketplace locations, with approximate centers. */
export const neighborhoods = {
  Mission: { city: "San Francisco, CA", lat: 37.7599, lng: -122.4148 },
  Berkeley: { city: "Berkeley, CA", lat: 37.867, lng: -122.2584 },
  "Inner Richmond": { city: "San Francisco, CA", lat: 37.7786, lng: -122.4642 },
  "Haight-Ashbury": { city: "San Francisco, CA", lat: 37.77, lng: -122.447 },
  Elmwood: { city: "Berkeley, CA", lat: 37.8578, lng: -122.2539 },
  "Pacific Heights": { city: "San Francisco, CA", lat: 37.7927, lng: -122.4356 },
  "Bernal Heights": { city: "San Francisco, CA", lat: 37.741, lng: -122.4142 },
  Dogpatch: { city: "San Francisco, CA", lat: 37.7607, lng: -122.3892 },
  "Inner Sunset": { city: "San Francisco, CA", lat: 37.7615, lng: -122.4676 },
  Rockridge: { city: "Oakland, CA", lat: 37.8448, lng: -122.2513 },
  SoMa: { city: "San Francisco, CA", lat: 37.7809, lng: -122.401 },
  "Outer Sunset": { city: "San Francisco, CA", lat: 37.7541, lng: -122.5062 },
  "Nob Hill": { city: "San Francisco, CA", lat: 37.793, lng: -122.4161 },
  Marina: { city: "San Francisco, CA", lat: 37.803, lng: -122.4375 },
  Castro: { city: "San Francisco, CA", lat: 37.7626, lng: -122.4353 },
  "North Beach": { city: "San Francisco, CA", lat: 37.8012, lng: -122.409 },
  "Hayes Valley": { city: "San Francisco, CA", lat: 37.7767, lng: -122.4229 },
  "Noe Valley": { city: "San Francisco, CA", lat: 37.7516, lng: -122.4321 },
  Oakland: { city: "Oakland, CA", lat: 37.8045, lng: -122.2714 },
  "Mountain View": { city: "Mountain View, CA", lat: 37.3894, lng: -122.0832 },
  "Daly City": { city: "Daly City, CA", lat: 37.6905, lng: -122.4727 },
} as const;

export type Neighborhood = keyof typeof neighborhoods;
