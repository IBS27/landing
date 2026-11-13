/**
 * Owned items (#27) for the seeded personas, so shopping → 3D (#131) can be
 * shown: Maya bought Kai's crash pad on Marketplace (their seeded chat), and
 * her bookcase and floor lamp are things she owns and has listed for sale
 * before her move (#43). Photos come from the linked listing.
 */
export type OwnedItemSeed = {
  username: string;
  title: string;
  /** What they paid, whole dollars. */
  price: number;
  /** Days before seed time they got it. */
  daysAgo: number;
  /** A Marketplace purchase: the listing and the chat the deal was agreed in. */
  bought?: { listing: string; conversation: string };
  /** The persona's own listing selling it at move-out. */
  selling?: string;
};

export const ownedItemSeeds: OwnedItemSeed[] = [
  {
    username: "maya.chen",
    title: "Black Diamond Mondo crash pad",
    price: 150,
    daysAgo: 1,
    bought: { listing: "kai-crashpad", conversation: "mp-kai-crashpad" },
  },
  {
    username: "maya.chen",
    title: "IKEA Billy bookcase (white, tall)",
    price: 70,
    daysAgo: 700,
    selling: "maya-bookshelf",
  },
  {
    username: "maya.chen",
    title: "IKEA Hektar floor lamp",
    price: 50,
    daysAgo: 640,
    selling: "maya-lamp",
  },
];
