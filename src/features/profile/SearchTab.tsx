import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQ } from "@/app/viewer";
import { PostCard, PostSkeleton } from "@/features/posts";
import { api } from "../../../convex/_generated/api";
import { CardEmpty, ProfileCard } from "./cards";
import { possessive, useProfile } from "./context";

/** `/$username/search?q=`: the profile header's "Search" button lands here. */
export function SearchTab({ q }: { q: string }) {
  const { profile } = useProfile();
  const { user } = profile;
  const navigate = useNavigate();
  const [text, setText] = useState(q);
  const input = useRef<HTMLInputElement>(null);
  const results = useQ(api.profiles.search, q.trim() ? { userId: user._id, q } : "skip");

  useEffect(() => setText(q), [q]);
  useEffect(() => input.current?.focus({ preventScroll: true }), []);

  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-4">
      <ProfileCard title={`Search ${possessive(user.firstName)} profile`}>
        <form
          role="search"
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void navigate({
              to: "/$username/search",
              params: { username: user.username },
              search: { q: text.trim() },
              resetScroll: false,
            });
          }}
        >
          <label className="flex h-10 items-center gap-2 rounded-full bg-input px-3">
            <Search size={16} strokeWidth={2.4} className="shrink-0 text-secondary" />
            <input
              ref={input}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Search ${possessive(user.firstName)} posts`}
              aria-label={`Search ${possessive(user.name)} profile`}
              className="min-w-0 flex-1 bg-transparent text-[15px] text-primary outline-none placeholder:text-secondary"
            />
          </label>
        </form>
        {!q.trim() && (
          <p className="pt-3 text-[15px] text-secondary">
            Find posts {profile.isSelf ? "you've" : `${user.firstName} has`} shared.
          </p>
        )}
      </ProfileCard>
      {q.trim() &&
        (results === undefined ? (
          <PostSkeleton />
        ) : results.length === 0 ? (
          <ProfileCard>
            <CardEmpty>No results for "{q.trim()}"</CardEmpty>
          </ProfileCard>
        ) : (
          results.map((p) => <PostCard key={p._id} post={p} hideable={false} />)
        ))}
    </div>
  );
}
