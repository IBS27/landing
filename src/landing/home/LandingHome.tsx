import { useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowUp, History, X } from "lucide-react";
import type { Map as MlMap } from "maplibre-gl";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useM, useQ, useViewer } from "@/app/viewer";
import { toRentalCheck } from "@/landing/links";
import { LandingMap } from "@/landing/map/LandingMap";
import { MapMarker } from "@/landing/map/MapMarker";
import type { Bounds, MapFocus, MapLayer, PinKind, RouteStop } from "@/landing/map/types";
import { cn } from "@/lib/format";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  type ChatCommand,
  type ChatContext,
  type ChatNeighborhood,
  type ChatReply,
  ruleReply,
} from "./chatRules";
import { pointsBounds, shapeBounds, unionBounds } from "./places";
import { type ChatSession, useChatLog } from "./useChatLog";
import "./home.css";

const GLOBE = { center: { lat: 33, lng: -108 }, zoom: 0.95 } satisfies MapFocus;
const SF: Bounds = { west: -122.515, south: 37.706, east: -122.356, north: 37.812 };
const GREETING = "Ask me anything about your move, and the map will follow.";

/** Where a chip goes: a chat message, or something the page does itself. */
type Chip = { label: string; run?: () => void };

/**
 * Landing Home (`/landing`): one map you travel into, driven by a chat with
 * Muse. Every answer moves the map (globe → Bay Area → a neighborhood) and
 * shows real data: rentals ranked for the viewer (#10), neighborhood shapes
 * (#15), Events and Groups (#56), Weekend Routes (#18), comparisons (#19),
 * the Move-in Crew at neighborhood level (#30). Questions about other parts
 * of Landing open their pages. Muse only routes and explains; it creates and
 * sends nothing. With AI off, Landing's rules answer instead.
 */
export function LandingHome() {
  const viewer = useViewer();
  const navigate = useNavigate();
  const router = useRouter();
  const profile = useQ(api.cityProfile.get, {});
  const hoods = useQ(api.neighborhoods.boundaries, {});
  const crew = useQ(api.crews.myCrew, {});
  const chat = useChatLog(viewer._id, GREETING);

  const [map, setMap] = useState<MlMap | null>(null);
  const [focus, setFocus] = useState<MapFocus>(GLOBE);
  const [zoom, setZoom] = useState(GLOBE.zoom);
  const [area, setArea] = useState<Bounds | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [compare, setCompare] = useState<[string, string] | null>(null);
  const [rentalMax, setRentalMax] = useState<number | null | undefined>(undefined); // undefined = hidden
  const [pinKinds, setPinKinds] = useState<PinKind[]>([]);
  const [routeSlug, setRouteSlug] = useState<string | null>(null);
  const [showCrew, setShowCrew] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const hoodBySlug = useMemo(() => new Map((hoods ?? []).map((h) => [h.slug, h])), [hoods]);
  const chatHoods = useMemo<ChatNeighborhood[]>(
    () => (hoods ?? []).map((h) => ({ slug: h.slug, name: h.label })),
    [hoods],
  );

  /* ── Data for what's on the map ── */
  const rentals = useQ(
    api.rentals.search,
    rentalMax === undefined ? "skip" : { filters: rentalMax ? { maxPrice: rentalMax } : {} },
  );
  // The full ranked list (same as Find), so the chat's rules can answer about rentals.
  const ranked = useQ(api.rentals.search, { filters: {} });
  const pins = useQ(
    api.map.inBounds,
    area && pinKinds.length ? { bounds: snap(area), kinds: pinKinds } : "skip",
  );
  const routeHood = routeSlug ? hoodBySlug.get(routeSlug) : undefined;
  const route = useQ(
    api.weekendRoutes.get,
    routeHood ? { neighborhoodId: routeHood._id as Id<"neighborhoods"> } : "skip",
  );
  // No route yet (or a stale one): start a build, as the neighborhood page does (#18).
  const requestRoute = useM(api.weekendRoutes.request);
  const routeId = routeHood?._id as Id<"neighborhoods"> | undefined;
  useEffect(() => {
    if (routeId && route && !route.route && !route.building && !route.failed)
      void requestRoute({ neighborhoodId: routeId }).catch(() => undefined);
  }, [routeId, route, requestRoute]);
  // Pinned stops only, as on the neighborhood page (#18).
  const stops = useMemo<RouteStop[] | undefined>(
    () =>
      route?.route?.stops.flatMap((s) =>
        s.point
          ? [
              {
                key: s.key,
                name: s.name,
                point: s.point,
                note: s.why,
                sources: s.sources,
                ...(s.eventId && { link: { kind: "event" as const, _id: s.eventId } }),
              },
            ]
          : [],
      ),
    [route],
  );

  const layers = useMemo<MapLayer[]>(() => {
    const all = hoods ?? [];
    const shown = compare ? all.filter((h) => compare.includes(h.slug)) : zoom > 8 ? all : [];
    const out: MapLayer[] = [
      {
        kind: "neighborhoods",
        items: shown,
        selected: compare ?? selected ?? undefined,
        onSelect: (n) => setSelected(n.slug),
      },
    ];
    const homes = rentals?.results.flatMap((r) => (r.pin ? [r.pin] : [])) ?? [];
    if (homes.length) out.push({ kind: "listings", items: homes });
    if (pins) {
      out.push({ kind: "events", items: pins.events }, { kind: "groups", items: pins.groups });
      if (pinKinds.includes("homes") || pinKinds.includes("items"))
        out.push({ kind: "listings", items: pins.listings });
    }
    if (stops?.length) out.push({ kind: "route", stops });
    return out;
  }, [hoods, compare, zoom, selected, rentals, pins, pinKinds, stops]);

  // When a Weekend Route arrives, frame it.
  useEffect(() => {
    if (!stops?.length) return;
    const b = pointsBounds(
      stops.map((s) => s.point),
      0.004,
    );
    if (b) setFocus({ bounds: b });
  }, [stops]);

  const onMapReady = useCallback((m: MlMap) => {
    // A softer, label-free globe; normal detail once zoomed in.
    for (const l of m.getStyle().layers ?? []) {
      try {
        if (l.type === "symbol")
          m.setPaintProperty(l.id, "text-opacity", [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            0,
            7,
            1,
          ]);
      } catch {
        // A layer without text.
      }
    }
    // Switching to the globe can reset the camera; start over the Americas.
    if (m.getZoom() < 3)
      m.jumpTo({
        center: [GLOBE.center.lng, GLOBE.center.lat],
        zoom: GLOBE.zoom,
        // Keep the globe above the chat.
        padding: { top: 40, bottom: 170, left: 0, right: 0 },
      });
    setMap(m);
  }, []);

  /* ── Running a command from the chat ── */
  const fitHood = useCallback(
    (slug: string) => {
      const h = hoodBySlug.get(slug);
      if (!h) return;
      setSelected(slug);
      setFocus({ bounds: shapeBounds(h) });
    },
    [hoodBySlug],
  );

  const run = useCallback(
    (cmd: ChatCommand) => {
      switch (cmd.kind) {
        case "show_move":
          setCompare(null);
          setSelected(null);
          setFocus({ bounds: SF });
          return;
        case "fly_neighborhood":
          setCompare(null);
          return fitHood(cmd.slug);
        case "compare": {
          const a = hoodBySlug.get(cmd.a);
          const b = hoodBySlug.get(cmd.b);
          if (!a || !b) return;
          setCompare([cmd.a, cmd.b]);
          setSelected(cmd.a);
          setFocus({ bounds: unionBounds([shapeBounds(a), shapeBounds(b)]) ?? SF });
          return;
        }
        case "weekend_route":
          setCompare(null);
          setSelected(cmd.slug);
          setRouteSlug(cmd.slug);
          return fitHood(cmd.slug);
        case "show_rentals":
          setRentalMax(cmd.maxPrice ?? null);
          setFocus({ bounds: SF });
          return;
        case "open_listing":
          navigate(toRentalCheck(cmd.listingId as Id<"listings">));
          return;
        case "show_pins":
          setRentalMax(undefined);
          setPinKinds([cmd.layer]);
          if (cmd.slug) fitHood(cmd.slug);
          else if (zoom < 11) setFocus({ bounds: SF });
          return;
        case "show_crew":
          setShowCrew(true);
          setFocus({ bounds: SF });
          return;
        case "open_page":
          navigate({ to: PAGE_PATHS[cmd.page] });
          return;
        case "open_neighborhood_page":
          navigate({ to: "/landing/find/neighborhoods/$slug", params: { slug: cmd.slug } });
          return;
        case "none":
          return;
      }
    },
    [fitHood, hoodBySlug, navigate, zoom],
  );

  const stage: ChatContext["stage"] = zoom < 5 ? "globe" : zoom < 12.5 ? "city" : "hood";

  const send = useCallback(
    (text: string) => {
      const message = text.trim();
      if (!message) return;
      chat.add({ who: "me", text: message });
      const context: ChatContext = { stage, ...(selected ? { neighborhood: selected } : {}) };
      // UI-only for now: Landing's rules answer in the browser, from the viewer's own data.
      // (A Muse-backed server answer can replace this later without changing the UI.)
      const reply: ChatReply = ruleReply(message, context, {
        neighborhoods: chatHoods,
        budgetMax: profile?.budget?.value.max ?? null,
        rentals: (ranked?.results ?? []).map((r) => ({
          id: r._id,
          title: r.title,
          price: r.price,
        })),
      });
      chat.add({
        who: "muse",
        text: reply.text,
        sources: reply.sources,
        via: reply.via,
        command: reply.command,
      });
      // "In my budget" means the City Profile's budget when no price was given.
      const budgetMax = profile?.budget?.value.max;
      if (
        reply.command.kind === "show_rentals" &&
        reply.command.maxPrice === undefined &&
        budgetMax &&
        /budget/i.test(message)
      )
        run({ ...reply.command, maxPrice: budgetMax });
      else run(reply.command);
    },
    [chat, chatHoods, profile, ranked, run, selected, stage],
  );

  const openSession = (s: ChatSession) => {
    chat.open(s);
    setHistoryOpen(false);
    const last = [...s.messages].reverse().find((m) => m.command && m.command.kind !== "none");
    if (last?.command) run(last.command);
  };

  /* ── Suggestions follow the last answer ── */
  const lastCommand = [...chat.current.messages].reverse().find((m) => m.who === "muse")?.command;
  const chips = useMemo<Chip[]>(() => {
    const name = (slug: string) => hoodBySlug.get(slug)?.label ?? slug;
    switch (lastCommand?.kind) {
      case "fly_neighborhood":
        return [
          { label: `Weekend route in ${name(lastCommand.slug)}` },
          { label: `Events in ${name(lastCommand.slug)}` },
          {
            label: `Open ${name(lastCommand.slug)}`,
            run: () => run({ kind: "open_neighborhood_page", slug: lastCommand.slug }),
          },
        ];
      case "compare":
        return [
          {
            label: "Open the full comparison",
            run: () =>
              navigate({
                to: "/landing/find/neighborhoods/compare",
                search: { a: lastCommand.a, b: lastCommand.b } as never,
              }),
          },
        ];
      case "show_rentals":
        return [
          { label: "Open Find", run: () => run({ kind: "open_page", page: "find" }) },
          { label: "Who's in my crew?" },
        ];
      case "show_move":
        return [{ label: "Rooms in my budget" }, { label: "Events this week" }];
      default:
        if (profile && !profile.briefCompletedAt)
          return [
            { label: "Set up my City Profile", run: () => navigate({ to: "/landing/welcome" }) },
            { label: "Show me the move" },
          ];
        return [
          { label: "Show me the move" },
          { label: "Rooms in my budget" },
          { label: "What's waiting for approval?" },
        ];
    }
  }, [lastCommand, hoodBySlug, navigate, run, profile]);

  /* ── Crew faces, at neighborhood level only ── */
  const crewSpots = useMemo(() => {
    if (!showCrew || !crew) return [];
    const bySlug = new Map<string, { avatars: string[]; names: string[] }>();
    for (const m of crew.members) {
      const anchor = m.anchors.find((a) => a.kind === "neighborhood");
      const slug = anchor?.kind === "neighborhood" ? anchor.slugs[0] : undefined;
      if (!slug || !hoodBySlug.has(slug)) continue;
      const spot = bySlug.get(slug) ?? { avatars: [], names: [] };
      if (m.user.avatar) spot.avatars.push(m.user.avatar);
      spot.names.push(m.user.firstName ?? m.user.name);
      bySlug.set(slug, spot);
    }
    return [...bySlug].map(([slug, s]) => ({ slug, ...s, center: hoodBySlug.get(slug)?.center }));
  }, [showCrew, crew, hoodBySlug]);

  const crumbs = [
    { label: "World", run: () => setFocus(GLOBE) },
    ...(zoom >= 5 ? [{ label: "Bay Area", run: () => run({ kind: "show_move" }) }] : []),
    ...(zoom >= 12.5 && selected
      ? [{ label: hoodBySlug.get(selected)?.label ?? "", run: () => fitHood(selected) }]
      : []),
  ];

  return (
    <div className={cn("lh-stage", zoom < 5 && "lh-globe", historyOpen && "lh-history-open")}>
      <LandingMap
        world
        layers={layers}
        focus={focus}
        onMapReady={onMapReady}
        onBoundsChange={(b, z) => {
          setArea(b);
          setZoom(z);
        }}
        padding={{ top: 56, bottom: 220, right: historyOpen ? 352 : 0 }}
        label="Your move on a map"
        className="absolute inset-0"
      >
        {map &&
          crewSpots.map((s) =>
            s.center ? (
              <MapMarker key={s.slug} map={map} lng={s.center.lng} lat={s.center.lat} z={2}>
                <span className="lh-glass flex items-center gap-2 rounded-full py-1 pr-2.5 pl-1 shadow-base">
                  <span className="flex">
                    {s.avatars.slice(0, 3).map((a) => (
                      <img
                        key={a}
                        src={a}
                        alt=""
                        className="-ml-2 h-7 w-7 rounded-full border-2 border-white object-cover first:ml-0"
                      />
                    ))}
                  </span>
                  <span className="font-semibold text-[12px] text-primary">
                    {s.names.length} from your crew
                  </span>
                </span>
              </MapMarker>
            ) : null,
          )}
      </LandingMap>

      {/* Breadcrumb and past chats */}
      <nav className="lh-glass absolute top-3 left-3 z-[5] flex items-center gap-1 rounded-full px-2 py-1 text-[13px]">
        {crumbs.map((c, i) => (
          <button
            key={c.label}
            type="button"
            onClick={c.run}
            className={cn(
              "px-1",
              i === crumbs.length - 1 ? "font-semibold text-primary" : "text-secondary",
            )}
          >
            {i > 0 && <span className="mr-1.5 text-disabled">/</span>}
            {c.label}
          </button>
        ))}
      </nav>
      <button
        type="button"
        onClick={() => setHistoryOpen((o) => !o)}
        className={cn(
          "absolute top-3 right-3 z-[8] flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold text-[13px] shadow-base",
          historyOpen ? "bg-primary-button text-white" : "lh-glass text-primary",
        )}
      >
        <History size={16} /> Chats
      </button>

      {/* Hero over the globe */}
      <ChatDock
        messages={chat.current.messages}
        chips={chips}
        onSend={send}
        onSource={(href) => router.history.push(href)}
      />

      <aside className="lh-history lh-glass flex flex-col gap-2.5 p-3.5" aria-hidden={!historyOpen}>
        <div className="flex items-center gap-2">
          <b className="flex-1 text-[18px] text-primary">Chats</b>
          <button
            type="button"
            onClick={() => {
              chat.reset();
              setHistoryOpen(false);
            }}
            className="rounded-full bg-btn px-3 py-1.5 font-semibold text-[13px] text-btn-text"
          >
            New chat
          </button>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setHistoryOpen(false)}
            className="rounded-full bg-btn p-1.5"
          >
            <X size={16} />
          </button>
        </div>
        <div className="-mx-1.5 flex-1 overflow-y-auto">
          {chat.sessions.length === 0 && (
            <p className="px-2 text-[13px] text-secondary">
              Your chats show up here once you ask something.
            </p>
          )}
          {chat.sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => openSession(s)}
              className={cn(
                "block w-full rounded-xl px-2 py-2 text-left hover:bg-hover",
                s.id === chat.current.id && "bg-highlight",
              )}
            >
              <span className="block truncate font-semibold text-[14px] text-primary">
                {s.title}
              </span>
              <span className="block text-[12px] text-secondary">
                {new Date(s.updatedAt).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
                {" · "}
                {s.messages.length} messages
              </span>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}

const PAGE_PATHS = {
  find: "/landing/find",
  place: "/landing/place",
  crew: "/landing/crew",
  journeys: "/landing/crew/journeys",
  moveout: "/landing/move-out",
  profile: "/landing/profile",
  inbox: "/landing/inbox",
} as const;

/** Map queries snap outward to a grid, so small pans reuse the last result. */
function snap(b: Bounds): Bounds {
  const g = 0.02;
  const r = (v: number) => Math.round(v * 1000) / 1000;
  return {
    west: r(Math.floor(b.west / g) * g),
    south: r(Math.floor(b.south / g) * g),
    east: r(Math.ceil(b.east / g) * g),
    north: r(Math.ceil(b.north / g) * g),
  };
}

/**
 * The chat dock: the last two messages as glass bubbles over the map (scroll
 * over them for older ones; the map never scrolls from here), suggestions and
 * the "Ask Muse" input.
 */
function ChatDock({
  messages,
  chips,
  onSend,
  onSource,
}: {
  messages: {
    id: string;
    who: "me" | "muse";
    text: string;
    sources?: { label: string; href?: string }[];
    via?: "muse" | "rules";
  }[];
  chips: Chip[];
  onSend: (text: string) => void;
  onSource: (href: string) => void;
}) {
  const log = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [more, setMore] = useState(false);

  // The log is exactly as tall as its last two items, scrolled to the newest.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when messages change.
  useLayoutEffect(() => {
    const el = log.current;
    if (!el) return;
    const items = [...el.children].slice(-2) as HTMLElement[];
    const h = items.reduce((sum, c) => sum + c.offsetHeight, 0) + (items.length > 1 ? 8 : 0) + 8;
    el.style.maxHeight = `${h}px`;
    el.scrollTop = el.scrollHeight;
    setMore(el.scrollTop > 2);
  }, [messages]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSend(text);
    setText("");
  };

  return (
    <div className="lh-dock">
      <div
        ref={log}
        className={cn("lh-log", more && "lh-more")}
        onScroll={(e) => setMore(e.currentTarget.scrollTop > 2)}
        onWheel={(e) => e.stopPropagation()}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn("lh-msg", m.who === "me" ? "lh-me" : "lh-muse lh-glass text-primary")}
          >
            {m.text}
            {m.who === "muse" && (m.sources?.length || m.via === "rules") ? (
              <div className="mt-1.5 flex flex-wrap gap-x-1.5 text-[11px] text-secondary">
                {m.sources?.map((s) =>
                  s.href ? (
                    <button
                      key={s.label}
                      type="button"
                      className="hover:underline"
                      onClick={() => onSource(s.href as string)}
                    >
                      {s.label}
                    </button>
                  ) : (
                    <span key={s.label}>{s.label}</span>
                  ),
                )}
                {m.via === "rules" && <span>· Answered by Landing's rules (AI off)</span>}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {chips.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => (c.run ? c.run() : onSend(c.label))}
            className="lh-glass rounded-full px-3 py-1.5 text-[13px] text-primary shadow-base hover:brightness-95"
          >
            {c.label}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="lh-input lh-glass bg-card">
        <span className="bg-gradient-to-r from-[#0866ff] via-[#8b3dff] to-[#ff4f8b] bg-clip-text text-[16px] text-transparent">
          ✦
        </span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask Muse"
          aria-label="Ask Muse"
          className="min-w-0 flex-1 bg-transparent px-1.5 text-[16px] text-primary outline-none placeholder:text-secondary"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!text.trim()}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[#0b0c0f] text-white disabled:opacity-40 dark:bg-white dark:text-black"
        >
          <ArrowUp size={16} strokeWidth={2.4} />
        </button>
      </form>
    </div>
  );
}
