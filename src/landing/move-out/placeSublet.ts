import { linkOptions } from "@tanstack/react-router";

/** The sublet form on Move out, filled in from the viewer's place (#141). */
export const toSubletMyPlace = () =>
  linkOptions({ to: "/landing/move-out", search: { sublet: "place" as const } });

/** A place's sublet, in a few words, by its listing's status. */
export function subletStateLabel(s: {
  status: "active" | "pending" | "sold";
  chats: number;
}): string {
  if (s.status === "sold") return "Subleased";
  if (s.status === "pending") return "Sublet pending";
  return `Sublet listed · ${s.chats} ${s.chats === 1 ? "chat" : "chats"}`;
}
