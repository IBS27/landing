import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useAction, useConvex } from "convex/react";
import { House } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useM, useQ, useViewer } from "@/app/viewer";
import { ApartmentStage } from "@/landing/apartment/ApartmentStage";
import { toCompare, toHome, toLandingPage, toNeighborhood, toRentalCheck } from "@/landing/links";
import { LandingMap } from "@/landing/map/LandingMap";
import { MapMarker } from "@/landing/map/MapMarker";
import { todayInSF } from "@/landing/place/placeParts";
import { cn } from "@/lib/format";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  CHAT_CARDS_MAX,
  CHAT_MESSAGE_MAX,
  CHAT_RECENT_MAX,
  type ChatAction,
  type ChatCommand,
  type ChatContext,
  type ChatNeighborhood,
  type ChatRental,
  type ChatRentalCard,
  type ChatReply,
  ruleReply,
} from "../../../convex/lib/homeChatRules";
import { CardIcon, type RentalActions } from "./ChatCards";
import { ChatDock, type FoundActions, type Pending } from "./ChatDock";
import {
  Breadcrumb,
  ChatHistory,
  ChatsButton,
  ExploreMenu,
  HomeTabs,
  type HomeView,
  LayerChips,
  PANEL_ID,
} from "./HomeChrome";
import { suggestions } from "./suggestions";
import { actionKey, type ChatSession, shownKeys, useChatLog } from "./useChatLog";
import { isMapCommand, useHomeMap } from "./useHomeMap";
import "./home.css";

const GREETING = "Tell me your budget and when you're moving, and I'll find places that fit.";

/** `/landing`'s search: which tab the stage shows. Map when absent. */
export type HomeSearch = { view?: "apartment" };
export type { HomeView };

/**
 * Landing Home (`/landing`): one chat with Muse over two views of the move.
 *
 * - **Map**: one map you travel into (globe → Bay Area → a neighborhood, in
 *   3D up close). Every answer moves it and shows real data: rentals ranked
 *   for the viewer (#10), neighborhood shapes (#15), Events and Groups (#56),
 *   Weekend Routes (#18), comparisons (#19), the Move-in Crew at neighborhood
 *   level (#30).
 * - **Apartment** (#150): the place they chose from a rental card, as a 3D
 *   model Muse furnishes from Marketplace for a vibe and a budget, or adds
 *   the things they name to (#153).
 *
 * Muse answers on the server (`api.homeChat.reply`). It looks things up
 * across Landing with tools (#154): rentals, Marketplace items, Events,
 * Groups, places, neighborhoods and the person's own move. What it finds
 * comes back as cards under the reply, pinned on the map when they have a
 * place there. It can also suggest doing something (RSVP, join a Group,
 * negotiate an item, approve a draft): each suggestion is a card, and nothing
 * changes until the person clicks it, when this page runs it as them
 * (`runAction`) with the mutation the rest of Landing uses. Opening a past
 * chat never runs anything. The person chooses a place and reviews what's
 * placed; nothing is sent or bought. "Explore" lists Landing's other pages.
 * When Muse can't answer, Landing's rules do, and say why; here in the browser
 * if the server can't be reached.
 */
export function LandingHome({ view = "map" }: { view?: HomeView }) {
  const viewer = useViewer();
  const navigate = useNavigate();
  const router = useRouter();
  const convex = useConvex();
  const profile = useQ(api.cityProfile.get, {});
  const apartment = useQ(api.apartment.get, {});
  const waiting = useQ(api.proposals.pendingCount, {});
  const chat = useChatLog(viewer._id, GREETING);
  const ask = useAction(api.homeChat.reply);
  const furnish = useAction(api.apartment.furnish);
  const takeListing = useM(api.myPlace.takeListing);
  const buildApartment = useM(api.apartment.build);
  const m = useHomeMap();

  const [pending, setPending] = useState<Pending>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [focusItem, setFocusItem] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);

  const viewNow = useRef(view);
  viewNow.current = view;
  const setView = useCallback(
    (v: HomeView) => {
      if (v !== viewNow.current)
        void navigate({ ...toHome(v === "apartment" ? { view: v } : {}), replace: true });
    },
    [navigate],
  );

  const chatHoods = useMemo<ChatNeighborhood[]>(
    () => (m.hoods ?? []).map((h) => ({ slug: h.slug, name: h.label })),
    [m.hoods],
  );
  const place = apartment?.place ?? null;
  const unit = apartment?.unit ?? null;

  /* ── Furnishing: Muse picks, the apartment gets the pieces, the chat shows them ── */
  const furnishNow = useCallback(
    async (cmd: Extract<ChatCommand, { kind: "furnish" | "add_items" }>, sessionId: string) => {
      setPending("furnish");
      try {
        const r = await furnish({
          viewerId: viewer._id,
          // Named things (#153): only those kinds, and what the person said about them.
          ...(cmd.kind === "add_items"
            ? { vibe: cmd.want ?? "", only: cmd.items }
            : { vibe: cmd.vibe }),
          ...(cmd.budget === undefined ? {} : { budget: cmd.budget }),
        });
        chat.add(
          {
            who: "muse",
            text: r.text,
            sources: r.sources,
            via: r.via,
            ...(r.why && { why: r.why }),
            ...(r.items.length
              ? { items: r.items, tally: { total: r.total, spent: r.spent, budget: r.budget } }
              : {}),
          },
          sessionId,
        );
      } catch {
        chat.add(
          {
            who: "muse",
            via: "landing",
            text: "I couldn't pick pieces just now, and nothing in your apartment changed. Ask again in a moment.",
          },
          sessionId,
        );
      } finally {
        setPending(null);
      }
    },
    [chat.add, furnish, viewer._id],
  );

  /* ── Running a command from the chat ── */
  const run = useCallback(
    (cmd: ChatCommand, o: { sessionId: string; replay?: boolean }) => {
      if (isMapCommand(cmd)) {
        setView("map");
        m.apply(cmd);
        return;
      }
      // Opening a past chat shows where it left off: it never navigates away or furnishes again.
      switch (cmd.kind) {
        case "show_apartment":
          return setView("apartment");
        case "furnish":
        case "add_items":
          setView("apartment");
          if (!o.replay) void furnishNow(cmd, o.sessionId);
          return;
        case "open_listing":
          if (!o.replay) void navigate(toRentalCheck(cmd.listingId as Id<"listings">));
          return;
        case "open_page":
          if (!o.replay) void navigate(toLandingPage(cmd.page));
          return;
        case "open_neighborhood_page":
          if (!o.replay) void navigate(toNeighborhood(cmd.slug));
          return;
      }
    },
    [furnishNow, m.apply, navigate, setView],
  );

  /** Landing's rules in the browser, for when the server can't answer. */
  const localReply = useCallback(
    async (message: string, context: ChatContext): Promise<ChatReply> => {
      let rentals: ChatRental[] | undefined;
      let cards: ChatRentalCard[] | undefined;
      try {
        const ranked = await convex.query(api.rentals.search, {
          viewerId: viewer._id,
          filters: {},
        });
        rentals = ranked.results.map((r) => ({ id: r._id, title: r.title, price: r.price }));
        // The reasons' sources need the server to resolve; a card here links to the rental's own page, which cites them.
        cards = ranked.results.slice(0, CHAT_CARDS_MAX * 2).map((r) => ({
          id: r._id,
          title: r.title,
          price: r.price,
          photo: r.photo,
          neighborhood: r.area?.label ?? null,
          reasons: [],
          availableFrom:
            r.availableFrom && r.availableFrom > Date.now() ? todayInSF(r.availableFrom) : null,
        }));
      } catch {
        // Offline too: the rules still answer, without naming rentals.
      }
      return ruleReply(message, context, {
        neighborhoods: chatHoods,
        budgetMax: profile?.budget?.value.max ?? null,
        rentals,
        cards,
        today: todayInSF(),
        // Not loaded yet: the rules leave it to the Apartment tab.
        ...(apartment && { apartment: apartment.place ? { hasModel: !!apartment.unit } : null }),
      });
    },
    [convex, viewer._id, chatHoods, profile, apartment],
  );

  const send = useCallback(
    async (text: string) => {
      const message = text.trim().slice(0, CHAT_MESSAGE_MAX);
      if (!message || pending) return;
      const sessionId = chat.current.id;
      // Each turn goes with the keys of what it showed, so "the second one" means something.
      const recent = chat.current.messages.slice(-CHAT_RECENT_MAX).map((t) => {
        const shown = shownKeys(t);
        return { who: t.who, text: t.text, ...(shown.length && { shown }) };
      });
      chat.add({ who: "me", text: message });
      const context: ChatContext = {
        stage: m.stage,
        view,
        ...(m.selected ? { neighborhood: m.selected } : {}),
      };
      setPending("answer");
      let reply: ChatReply;
      let offline = false;
      try {
        reply = await ask({ viewerId: viewer._id, message, context, recent });
      } catch {
        // The chat never dead-ends: answer with the rules here.
        reply = await localReply(message, context);
        offline = true;
      } finally {
        setPending(null);
      }
      // "In my budget" means the City Profile's budget when no price was given.
      const budgetMax = profile?.budget?.value.max;
      const command: ChatCommand =
        reply.command.kind === "show_rentals" &&
        reply.command.maxPrice === undefined &&
        budgetMax &&
        /budget/i.test(message)
          ? { ...reply.command, maxPrice: budgetMax }
          : reply.command;
      chat.add(
        {
          who: "muse",
          text: reply.text,
          sources: reply.sources,
          via: reply.via,
          ...(offline ? { why: "offline" as const } : reply.why && { why: reply.why }),
          command,
          saved: reply.saved,
          rentals: reply.rentals,
          cards: reply.cards,
          actions: reply.actions,
        },
        sessionId,
      );
      // The person opened another chat meanwhile: file the answer there, but leave the stage alone.
      if (!chat.isCurrent(sessionId)) return;
      run(command, { sessionId });
      // An answer that leaves the map where it is, with places to show: frame them.
      // (A server from before #154 sends no cards.)
      const points = (reply.cards ?? []).flatMap((c) => c.point ?? []);
      if (command.kind === "none" && viewNow.current === "map" && points.length) m.frame(points);
    },
    [ask, chat, localReply, pending, profile, run, m.frame, m.selected, m.stage, view, viewer._id],
  );

  /** Where a chat left off on the stage: its last command that shows something here. */
  const stageCommand = (s: ChatSession) =>
    s.messages.findLast(
      (x) =>
        x.command &&
        (isMapCommand(x.command) ||
          x.command.kind === "show_apartment" ||
          x.command.kind === "furnish" ||
          x.command.kind === "add_items"),
    )?.command;

  const openSession = (s: ChatSession) => {
    chat.open(s);
    setHistoryOpen(false);
    const last = stageCommand(s);
    if (last) run(last, { sessionId: s.id, replay: true });
  };

  // After a reload the open chat comes back: put the map where it left off (the tab is in the URL).
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !chat.resumed || !m.hoods) return;
    restored.current = true;
    const last = chat.current.messages.findLast((x) => x.command && isMapCommand(x.command));
    if (last?.command && isMapCommand(last.command)) m.apply(last.command);
  }, [chat.resumed, chat.current, m.hoods, m.apply]);

  /* ── Choosing a place from a rental card ── */
  const choosePlace = useCallback(
    async (listingId: string, moveIn: string) => {
      // The chat it was chosen in: the person may open another while this runs.
      const sessionId = chat.current.id;
      await takeListing({ listingId: listingId as Id<"listings">, moveIn });
      let building = false;
      try {
        await buildApartment({});
        const now = await convex.query(api.apartment.get, { viewerId: viewer._id });
        building = now.unit?.state === "building";
      } catch {
        // The place is theirs either way; the Apartment tab sets up its model.
      }
      // Written here, not by Muse: it says so.
      chat.add(
        {
          who: "muse",
          via: "landing",
          text: building
            ? "That's your place. I'm building its 3D model on the Apartment tab."
            : "That's your place. It's on the Apartment tab as a starter room, ready to furnish.",
          command: { kind: "show_apartment" },
          sources: [{ label: "Your place", href: "/landing/place" }],
        },
        sessionId,
      );
      if (chat.isCurrent(sessionId)) setView("apartment");
    },
    [
      buildApartment,
      chat.add,
      chat.current.id,
      chat.isCurrent,
      convex,
      setView,
      takeListing,
      viewer._id,
    ],
  );

  const rentalActions = useMemo<RentalActions>(
    () => ({
      currentListingId: place?.listingId ?? null,
      replaces: place?.title ?? null,
      statedMoveIn: profile?.moveIn?.value ?? null,
      onChoose: (card, moveIn) => choosePlace(card.id, moveIn),
      onHover: m.setHighlight,
      locate: (id) => {
        const pin = m.rentalPins.get(id);
        return pin
          ? () => {
              setView("map");
              m.flyTo(pin.point);
            }
          : null;
      },
      onOpenApartment: () => setView("apartment"),
    }),
    [place, profile, choosePlace, m.setHighlight, m.rentalPins, m.flyTo, setView],
  );

  /* ── Doing what a card or a suggestion offers: only ever from the person's click ── */
  const runAction = useCallback(
    async (a: ChatAction): Promise<void> => {
      const viewerId = viewer._id;
      switch (a.kind) {
        case "rsvp":
          await convex.mutation(api.events.respond, {
            viewerId,
            eventId: a.eventId as Id<"events">,
            status: a.status,
          });
          return;
        case "join_group":
          await convex.mutation(api.groups.join, { viewerId, groupId: a.groupId as Id<"groups"> });
          return;
        case "save_listing": {
          // `saved.toggle` flips: only save what isn't saved yet.
          const ref = { viewerId, kind: "listing" as const, refId: a.listingId };
          if (!(await convex.query(api.saved.isSaved, ref)))
            await convex.mutation(api.saved.toggle, ref);
          return;
        }
        case "choose_place":
          return choosePlace(a.listingId, a.moveIn);
        case "negotiate":
          await convex.mutation(api.negotiations.start, {
            viewerId,
            listingId: a.listingId as Id<"listings">,
            maxPrice: a.maxPrice,
            ...(a.targetPrice !== undefined && { targetPrice: a.targetPrice }),
            ...(a.notes && { notes: a.notes }),
          });
          return;
        case "set_negotiation":
          await convex.mutation(api.negotiations.setStatus, {
            viewerId,
            negotiationId: a.negotiationId as Id<"negotiations">,
            status: a.status,
          });
          return;
        case "approve_draft":
          await convex.mutation(api.proposals.approve, {
            viewerId,
            proposalId: a.proposalId as Id<"proposals">,
          });
          return;
        case "discard_draft":
          await convex.mutation(api.proposals.discard, {
            viewerId,
            proposalId: a.proposalId as Id<"proposals">,
          });
          return;
        case "add_grocery":
          await convex.mutation(api.house.addGrocery, {
            viewerId,
            houseId: a.houseId as Id<"houses">,
            text: a.text,
          });
          return;
        case "add_chore":
          await convex.mutation(api.house.addChore, {
            viewerId,
            houseId: a.houseId as Id<"houses">,
            title: a.title,
            cadence: a.cadence,
          });
          return;
        case "add_bill":
          await convex.mutation(api.house.addBill, {
            viewerId,
            houseId: a.houseId as Id<"houses">,
            title: a.title,
            amountCents: Math.round(a.amount * 100),
            cadence: a.cadence,
            ...(a.dueDate && { dueDate: a.dueDate }),
          });
          return;
        case "ask_roommate": {
          // The intro is a draft like any other (#6); the card shows these exact words in full,
          // and clicking Send is its approval.
          const proposalId = await convex.mutation(api.roommates.askToConnect, {
            viewerId,
            userId: a.userId as Id<"users">,
            text: a.text,
          });
          await convex.mutation(api.proposals.approve, { viewerId, proposalId });
          return;
        }
      }
    },
    [choosePlace, convex, viewer._id],
  );

  /**
   * One run per action at a time: the same action can be on a card and on a
   * suggestion, and a second click joins the first run instead of repeating it.
   */
  const running = useRef(new Map<string, Promise<void>>());
  const runOnce = useCallback(
    (a: ChatAction) => {
      const key = actionKey(a);
      const started = running.current.get(key);
      if (started) return started;
      const run = runAction(a).finally(() => running.current.delete(key));
      running.current.set(key, run);
      return run;
    },
    [runAction],
  );

  const foundActions = useMemo<FoundActions>(
    () => ({
      locate: (point) => {
        setView("map");
        m.flyTo(point);
      },
      run: runOnce,
      onOutcome: chat.setOutcome,
    }),
    [chat.setOutcome, m.flyTo, runOnce, setView],
  );

  /**
   * What Muse found, on the map: the cards with a point from the latest reply
   * that put something on the stage (cards, rentals or a map command). A reply
   * that shows something else takes them away.
   */
  const pinned = useMemo(
    () =>
      chat.current.messages
        .findLast(
          (x) =>
            x.who === "muse" &&
            (x.cards?.length || x.rentals?.length || (x.command && isMapCommand(x.command))),
        )
        ?.cards?.flatMap((c) => (c.point ? [{ ...c, point: c.point }] : [])) ?? [],
    [chat.current.messages],
  );

  /* ── Suggestions follow the view, the person's place and the last answer ── */
  const point = place?.point;
  const chips = suggestions({
    view,
    apartment: apartment && {
      place: !!place,
      model: !!unit && unit.state !== "building",
      items: apartment.items.length,
    },
    last: chat.current.messages.findLast((x) => x.who === "muse")?.command,
    needsBrief: !!profile && !profile.briefCompletedAt,
    waiting: waiting ?? 0,
    name: (slug) => m.hoodBySlug.get(slug)?.label ?? slug,
    go: {
      apartment: () => setView("apartment"),
      // What's on around their place: the social layer, leaning in on its approximate area.
      nearPlace: point
        ? () => {
            setView("map");
            m.showSocial();
            m.flyTo(point);
          }
        : undefined,
      neighborhood: (slug) => void navigate(toNeighborhood(slug)),
      compare: (a, b) => void navigate(toCompare(a, b)),
      find: () => void navigate(toLandingPage("find")),
      brief: () => void navigate(toLandingPage("welcome")),
    },
  });

  const crumbs = [
    { label: "World", run: m.showWorld },
    ...(m.zoom >= 5 ? [{ label: "Bay Area", run: () => m.apply({ kind: "show_move" }) }] : []),
    ...(m.zoom >= 12.5 && m.selected
      ? [
          {
            label: m.hoodBySlug.get(m.selected)?.label ?? "",
            run: () => m.selected && m.fitHood(m.selected),
          },
        ]
      : []),
  ];

  const onMap = view === "map";
  const { map } = m;
  // A reply with cards stands taller over the map: keep what it shows above them.
  const lastMessage = chat.current.messages[chat.current.messages.length - 1];
  const tallDock = !!(
    lastMessage?.rentals?.length ||
    lastMessage?.items?.length ||
    lastMessage?.cards?.length ||
    lastMessage?.actions?.length
  );

  return (
    <div
      className={cn(
        "lh-stage",
        onMap && m.zoom < 5 && "lh-globe",
        historyOpen && "lh-history-open",
      )}
    >
      {/* Hidden, not unmounted, behind the Apartment tab: the camera and layers survive the switch. */}
      <div
        id={PANEL_ID.map}
        role="tabpanel"
        aria-label="Map"
        inert={!onMap}
        className={cn("absolute inset-0", !onMap && "invisible")}
      >
        <LandingMap
          world
          {...m.mapProps}
          padding={{
            // The layer chips sit under the top row once the map is on the city.
            top: m.inCity ? 100 : 56,
            bottom: tallDock ? 400 : 220,
            right: historyOpen ? 352 : 0,
          }}
          label="Your move on a map"
          className="absolute inset-0"
        >
          {map &&
            m.crewSpots.map((s) => (
              <MapMarker key={s.slug} map={map} lng={s.center.lng} lat={s.center.lat} z={6}>
                <Link
                  {...toLandingPage("crew")}
                  aria-label={`${s.names.length} from your Move-in Crew in ${s.label}`}
                  className="lh-glass lh-focus flex items-center gap-2 rounded-full py-1 pr-2.5 pl-1 shadow-base"
                >
                  <span className="flex">
                    {s.avatars.slice(0, 3).map((a) => (
                      <img
                        key={a}
                        src={a}
                        alt=""
                        className="-ml-2 h-7 w-7 rounded-full border-2 border-card object-cover first:ml-0"
                      />
                    ))}
                  </span>
                  <span className="font-semibold text-[12px] text-primary">
                    {s.names.length} from your crew
                  </span>
                </Link>
              </MapMarker>
            ))}
          {map &&
            m.inCity &&
            pinned.map((c) => (
              <MapMarker key={c.key} map={map} lng={c.point.lng} lat={c.point.lat} z={5}>
                <button
                  type="button"
                  onClick={() => m.flyTo(c.point)}
                  title={`${c.title} (approximate area)`}
                  className="lh-found lh-glass lh-focus"
                >
                  <span className="lh-found-dot">
                    <CardIcon kind={c.kind} size={12} />
                  </span>
                  <span className="truncate">{c.title}</span>
                </button>
              </MapMarker>
            ))}
          {map && m.inCity && place?.point && (
            <MapMarker map={map} lng={place.point.lng} lat={place.point.lat} z={7}>
              <button
                type="button"
                onClick={() => setView("apartment")}
                title="Your place (approximate area). Open it in 3D"
                className="lh-place lh-focus"
              >
                <span className="lh-place-dot">
                  <House size={14} strokeWidth={2.5} aria-hidden />
                </span>
                Your place
              </button>
            </MapMarker>
          )}
        </LandingMap>
      </div>

      <div
        id={PANEL_ID.apartment}
        role="tabpanel"
        aria-label="Apartment"
        inert={onMap}
        className={cn("absolute inset-0", onMap && "invisible")}
      >
        <ApartmentStage
          active={!onMap}
          focusItemId={focusItem}
          focusRequest={focusRequest}
          onAsk={(t) => void send(t)}
        />
      </div>

      {/* Along the top: where the map is, the two tabs, the rest of Landing and past chats */}
      <div className="lh-top">
        {onMap && <Breadcrumb crumbs={crumbs} />}
        <HomeTabs view={view} onChange={setView} building={unit?.state === "building"} />
        <div className="lh-top-right">
          <ExploreMenu />
          <ChatsButton open={historyOpen} onToggle={() => setHistoryOpen((o) => !o)} />
        </div>
      </div>
      {onMap && m.inCity && <LayerChips kinds={m.kinds} onToggle={m.toggleKind} crew={m.crew} />}

      <ChatDock
        messages={chat.current.messages}
        chips={chips}
        pending={pending}
        onSend={(t) => void send(t)}
        onSource={(href) => {
          // Code builds every source link; still, only ever follow one inside the app.
          if (href.startsWith("/") && !href.startsWith("//")) router.history.push(href);
        }}
        rentals={rentalActions}
        found={foundActions}
        focusedItem={focusItem}
        onFocusItem={(id) => {
          setFocusItem(id);
          setFocusRequest((n) => n + 1);
          setView("apartment");
        }}
      />

      <ChatHistory
        open={historyOpen}
        sessions={chat.sessions}
        currentId={chat.current.id}
        onOpen={openSession}
        onNew={() => {
          chat.reset();
          setHistoryOpen(false);
        }}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  );
}
