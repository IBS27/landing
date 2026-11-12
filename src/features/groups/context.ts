import type { FunctionReturnType } from "convex/server";
import { createContext, useContext } from "react";
import type { api } from "../../../convex/_generated/api";

export type GroupView = NonNullable<FunctionReturnType<typeof api.groups.get>>;

export const GroupContext = createContext<GroupView | null>(null);

/** The group whose page is open (provided by the group layout route). */
export function useGroup(): GroupView {
  const g = useContext(GroupContext);
  if (!g) throw new Error("useGroup must be used inside the group page");
  return g;
}

export const isMember = (g: GroupView) => g.viewerRole !== null;
