import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";

/** Stub: replaced by the Search feature (typeahead dropdown). */
export function SearchBox() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  return (
    <form
      className="flex h-10 w-[240px] items-center gap-2 rounded-full bg-input px-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim())
          void navigate({ to: "/search/$tab", params: { tab: "top" }, search: { q: q.trim() } });
      }}
    >
      <Search size={16} className="text-icon-secondary" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search Facebook"
        className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-placeholder"
      />
    </form>
  );
}
