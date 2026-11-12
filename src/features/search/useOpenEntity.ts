import { useNavigate } from "@tanstack/react-router";
import type { Id } from "../../../convex/_generated/dataModel";

export type EntityRef = { kind: "person" | "page" | "group" | "event"; key: string };

/** Navigate to a person, Page, group or event picked from search. */
export function useOpenEntity() {
  const navigate = useNavigate();
  return (e: EntityRef) => {
    if (e.kind === "group")
      return void navigate({ to: "/groups/$groupId", params: { groupId: e.key } });
    if (e.kind === "event")
      return void navigate({
        to: "/events/$eventId",
        params: { eventId: e.key as Id<"events"> },
      });
    return void navigate({ to: "/$username", params: { username: e.key } });
  };
}
