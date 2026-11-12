import { createFileRoute } from "@tanstack/react-router";
import type { Folder } from "@/features/messenger/InboxMenu";
import { MessagesIndexPage } from "@/features/messenger/MessagesPage";

const FOLDERS: Folder[] = ["archived", "requests", "restricted"];

export const Route = createFileRoute("/messages/")({
  validateSearch: (s: Record<string, unknown>): { folder?: Folder } =>
    FOLDERS.includes(s.folder as Folder) ? { folder: s.folder as Folder } : {},
  component: function MessagesIndex() {
    const { folder } = Route.useSearch();
    return <MessagesIndexPage key={folder ?? "inbox"} folder={folder} />;
  },
});
