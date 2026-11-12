import type { FunctionReturnType } from "convex/server";
import { createContext, useContext } from "react";
import type { api } from "../../../convex/_generated/api";

export type ProfileData = NonNullable<FunctionReturnType<typeof api.profiles.get>>;
export type ProfileUser = ProfileData["user"];

type Ctx = {
  profile: ProfileData;
  /** Rendered inside the Friends page preview pane (tabs link to the full profile). */
  embedded: boolean;
};

export const ProfileContext = createContext<Ctx | null>(null);

/** Horizontal gutter for the 1186px content column (always padded inside the preview pane). */
export function columnPad(embedded: boolean) {
  return embedded ? "px-4" : "px-4 min-[1218px]:px-0";
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used inside a profile");
  return ctx;
}

/** "Seattle, Washington" → "Seattle, WA"-style short form is not used by FB; keep the full city. */
export function possessive(name: string) {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

const monthFmt = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const dayFmt = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" });

export function joinedLabel(ts: number) {
  return `Joined ${monthFmt.format(new Date(ts))}`;
}

/** "04-18" → "April 18". */
export function birthdayLabel(mmdd: string) {
  const [m, d] = mmdd.split("-").map(Number);
  return dayFmt.format(new Date(2000, m - 1, d));
}
