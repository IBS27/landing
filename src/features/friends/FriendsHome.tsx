import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQ } from "@/app/viewer";
import { Skeleton } from "@/ui/primitives";
import { api } from "../../../convex/_generated/api";
import { CardButton, PersonGridCard } from "./cards";
import { FriendsHomeRail } from "./FriendsRail";
import {
  type Outcome,
  useFriendActions,
  useOutcomes,
  useRemovedSuggestions,
  useSticky,
} from "./hooks";
import { PeopleIllustration } from "./icons";

/** `/friends`: Friend requests and People you may know as 5-up card grids. */
export function FriendsHome() {
  const requests = useQ(api.friends.requests, {});
  const suggestions = useQ(api.friends.suggestions, {});
  const { removed, remove } = useRemovedSuggestions();
  const actions = useFriendActions();
  const [outcomes, setOutcome] = useOutcomes();
  const keep = useMemo(() => new Set(Object.keys(outcomes)), [outcomes]);

  const reqs = useSticky(requests, keep);
  const visibleSuggestions = useMemo(
    () => suggestions?.filter((s) => !removed.has(s._id)),
    [suggestions, removed],
  );
  const pymk = useSticky(visibleSuggestions, keep);

  const act = (id: string, o: Outcome, fn: () => Promise<unknown>) => {
    setOutcome(id, o);
    fn().catch(() => setOutcome(id, null));
  };

  const loading = reqs === undefined || pymk === undefined;
  const empty = !loading && reqs.length === 0 && pymk.length === 0;

  return (
    <div className="flex min-h-[calc(100vh-56px)]">
      <FriendsHomeRail />
      <main className="min-w-0 flex-1 px-5 pt-5 pb-10">
        <div className="mx-auto w-full max-w-[1040px] px-4">
          {loading && <GridSkeleton />}
          {empty && (
            <EmptyPane text="When you have friend requests or suggestions, you'll see them here." />
          )}
          {reqs && reqs.length > 0 && (
            <section aria-label="Friend requests" className="mb-4">
              <SectionHeader
                title="Friend requests"
                link={{
                  to: "/friends/requests",
                  label: "See all",
                  aria: "See all friend requests",
                }}
              />
              <ul className="-mx-1 grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
                {reqs.map((p) => {
                  const o = outcomes[p._id];
                  return (
                    <PersonGridCard
                      key={p._id}
                      person={p}
                      note={
                        o === "accepted" ? (
                          <span>Request accepted</span>
                        ) : o === "deleted" ? (
                          <span>Request removed</span>
                        ) : undefined
                      }
                    >
                      {o ? (
                        <div className="h-[78px]" />
                      ) : (
                        <>
                          <CardButton
                            variant="primary"
                            onClick={() => act(p._id, "accepted", () => actions.confirm(p._id))}
                          >
                            Confirm
                          </CardButton>
                          <CardButton
                            variant="secondary"
                            onClick={() => act(p._id, "deleted", () => actions.decline(p._id))}
                          >
                            Delete
                          </CardButton>
                        </>
                      )}
                    </PersonGridCard>
                  );
                })}
              </ul>
              <div className="mx-0 mt-5 h-px bg-divider" />
            </section>
          )}
          {pymk && pymk.length > 0 && (
            <section aria-label="People you may know">
              <SectionHeader
                title="People you may know"
                link={{ to: "/friends/suggestions", label: "See all", aria: "See all suggestions" }}
              />
              <ul className="-mx-1 grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
                {pymk.map((p) => {
                  const sent = outcomes[p._id] === "sent";
                  return (
                    <PersonGridCard
                      key={p._id}
                      person={p}
                      note={sent ? <span>Request sent</span> : undefined}
                    >
                      {sent ? (
                        <>
                          <div className="h-9" />
                          <CardButton
                            variant="secondary"
                            onClick={() => {
                              setOutcome(p._id, null);
                              void actions.cancel(p._id);
                            }}
                          >
                            Cancel
                          </CardButton>
                        </>
                      ) : (
                        <>
                          <CardButton
                            variant="soft"
                            onClick={() => act(p._id, "sent", () => actions.add(p._id))}
                          >
                            Add friend
                          </CardButton>
                          <CardButton variant="secondary" onClick={() => remove(p._id)}>
                            Remove
                          </CardButton>
                        </>
                      )}
                    </PersonGridCard>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

function SectionHeader({
  title,
  link,
}: {
  title: string;
  link: { to: "/friends/requests" | "/friends/suggestions"; label: string; aria: string };
}) {
  return (
    <div className="flex items-center justify-between pt-[15px] pb-[11px]">
      <h2 className="font-bold text-[20px] text-primary leading-6">{title}</h2>
      <Link
        to={link.to}
        aria-label={link.aria}
        className="rounded-md px-2 py-1 text-[17px] text-link hover:bg-hover"
      >
        {link.label}
      </Link>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="pt-4">
      <Skeleton className="mb-4 h-6 w-56" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="h-[350px] rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/** Grey centered illustration + message on an empty right pane. */
export function EmptyPane({ text }: { text: string }) {
  return (
    <div className="flex min-h-[calc(100vh-56px-40px)] flex-col items-center justify-center px-6 text-center">
      <PeopleIllustration />
      <h2 className="mt-5 max-w-[700px] font-bold text-[20px] text-secondary leading-6">{text}</h2>
    </div>
  );
}
