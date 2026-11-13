/** Add the apartment catalog through existing app APIs, without a seed reset or backend deploy.
 * Run with an explicit CONVEX_URL: bun scripts/add-apartment-goods.ts
 * Safe to rerun: existing titles belonging to each seller are left alone.
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { apartmentGoods } from "../convex/seed/world/apartmentGoods";

const url = process.env.CONVEX_URL;
if (!url) throw new Error("Set CONVEX_URL to the intended demo deployment");
const client = new ConvexHttpClient(url);
let added = 0;
for (const item of apartmentGoods) {
  const seller = await client.query(api.users.byUsername, { username: item.seller });
  if (!seller) throw new Error(`Missing seller ${item.seller}`);
  const existing = await client.query(api.listings.mine, { viewerId: seller._id });
  if (existing.items.some((listing) => listing.title === item.title)) {
    console.log(`Already present: ${item.title}`);
    continue;
  }
  const slots = typeof item.photos === "string" ? [item.photos] : item.photos;
  const photos = slots.map((slot) => {
    if (!/^listings\/[\w-]+\.jpg$/.test(slot)) {
      throw new Error(`Expected an explicit listing photo for ${item.key}`);
    }
    return { url: `/seed/${slot}` };
  });
  await client.mutation(api.listings.create, {
    viewerId: seller._id,
    title: item.title,
    price: item.price,
    category: item.category,
    condition: item.condition,
    description: item.description,
    neighborhood: item.hood,
    meetup: item.meetup ? [...item.meetup] : undefined,
    photos,
  });
  added++;
  console.log(`Added: ${item.title}`);
}
console.log(`Added ${added} apartment listings`);
