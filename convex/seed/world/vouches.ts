import type { VouchRelationship } from "../../validators";
import { daysAgo, type TimeSpec } from "../lib/time";
import type { Username } from "./people";

export type VouchSeed = {
  readonly voucher: Username;
  readonly subject: Username;
  readonly relationship: VouchRelationship;
  readonly note?: string;
  readonly at: TimeSpec;
};

/**
 * Network vouches for listers. Demo cases, seen as Maya:
 * - Derek (landlord, a friend of friends through Jordan): vouched by Jordan (her
 *   friend) and Lily (a friend of friends). Aisha's vouch is outside Maya's
 *   network, so only Derek sees it.
 * - Camila (Mission room, a friend of friends): vouched by Tasha, her friend.
 * - Tara (Sunset house): vouched by Kai, her friend.
 * - Aisha (Bernal 2BR): nobody in Maya's network knows her.
 */
export const vouches: readonly VouchSeed[] = [
  {
    voucher: "jordan.kim",
    subject: "derek.holloway",
    relationship: "rented_from",
    note: "Rented from Derek for two years in the Haight. Repairs were fast and he returned my full deposit.",
    at: daysAgo(40, "19:20"),
  },
  {
    voucher: "lily.anderson",
    subject: "derek.holloway",
    relationship: "rented_from",
    note: "Responsive landlord, the lease matched what he said at the showing.",
    at: daysAgo(12, "08:45"),
  },
  {
    voucher: "aisha.rahman",
    subject: "derek.holloway",
    relationship: "know_personally",
    at: daysAgo(6, "21:10"),
  },
  {
    voucher: "tasha.okafor",
    subject: "camila.santos",
    relationship: "lived_with",
    note: "We shared a flat on Valencia for a year. Clean, quiet on weeknights, always paid on time.",
    at: daysAgo(9, "18:30"),
  },
  {
    voucher: "kai.nakamura",
    subject: "tara.singh",
    relationship: "know_personally",
    at: daysAgo(21, "12:05"),
  },
];
