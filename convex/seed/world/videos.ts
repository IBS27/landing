import { daysAgo, hoursAgo, type TimeSpec } from "../lib/time";
import { isTallClip, type VideoClip } from "../lib/videos";
import type { CommentSeed, Handle, PostSeed, ReplySeed, StorySeed } from "../types";
import { pages } from "./pages";
import { MAIN } from "./people";

/**
 * Video posts: 16:9 clips for the feed and Watch, 9:16 clips that become
 * Reels (mostly from people and Pages Maya doesn't follow yet, so Reels can
 * offer "Follow"), one Sponsored video ad, and a few video stories. Clips live
 * in `../lib/videos`.
 */
const baseVideoPosts: readonly PostSeed[] = [
  // ── Feed / Watch videos (16:9) ─────────────────────────────────────────────
  {
    by: "emeraldledger",
    at: daysAgo(2, "08:15"),
    video: "seattle-viaduct-wide",
    privacy: "public",
    text: "Throwback: a drive along the Alaskan Way Viaduct, five years after it came down. Do you miss the view or do you miss the traffic? 🚗",
    reactions: 31,
    comments: [
      {
        by: "isaiah.thompson",
        text: "best view in the city and it was a highway. only in seattle",
      },
      { by: "will.foster", text: "I do not miss merging onto that thing at rush hour" },
      { by: "sophie.dubois", text: "the waterfront park is so much nicer now tbh" },
    ],
  },
  {
    by: "sophie.dubois",
    at: hoursAgo(5),
    video: "seattle-waterfront-wide",
    privacy: "public",
    place: "Elliott Bay Water Taxi",
    text: "water taxi back from west seattle and the skyline was showing off ☀️",
    reactions: 41,
    mood: "love",
    comments: [
      { by: "maya.chen", text: "okay this is gorgeous. take me next time" },
      { by: "sophie.dubois", text: "saturday? 🛥️", after: 12 },
    ],
  },
  {
    by: "owen.murphy",
    at: daysAgo(1, "07:40"),
    video: "puget-ferry-wide",
    privacy: "public",
    text: "commute views > traffic views. southworth ferry hitting different this morning ⛴️",
    reactions: 27,
    comments: [{ by: "jamal.wilson", text: "the ferry commute is undefeated" }],
  },
  {
    by: "grace.liu",
    at: daysAgo(3, "17:20"),
    video: "ship-canal-bridge-wide",
    privacy: "public",
    place: "Fremont, Seattle",
    text: "blue hour under the ship canal bridge. i will never get tired of this city",
    reactions: 58,
    mood: "love",
    likedBy: ["maya.chen"],
  },
  {
    by: "tara.singh",
    in: "pnw-hikers",
    at: hoursAgo(9),
    video: "rainier-timelapse-wide",
    privacy: "public",
    text: "Timelapse from Seward Park last night. The mountain was OUT 🏔️ Anyone heading up to Paradise this weekend before the road closes?",
    reactions: 26,
    comments: [
      { by: "arjun.mehta", text: "going saturday! carpool from cap hill if anyone wants in" },
      { by: "erin.mcallister", text: "this is my lock screen now" },
      { by: "maya.chen", text: "in for saturday 🙋‍♀️", after: 40 },
    ],
  },
  {
    by: "maddie.collins",
    at: daysAgo(6, "12:10"),
    video: "golden-gardens-wide",
    privacy: "public",
    place: "Golden Gardens Park",
    text: "practice run for the new year's plunge ❄️🌊 we are not okay. who's joining us Jan 1?",
    reactions: 33,
    mood: "haha",
    comments: [{ by: "ana.torres", text: "absolutely not but I'll hold the towels" }],
  },
  {
    by: "rainlineoutdoor",
    at: daysAgo(4, "11:00"),
    video: "mowich-rain-wide",
    privacy: "public",
    text: "Rainy day at Mowich Lake is still a good day at Mowich Lake. Tag the friend you're dragging out here before the road closes for the season.",
    reactions: 24,
  },
  {
    by: "kevin.tran",
    at: daysAgo(5, "15:30"),
    video: "ocean-shores-wide",
    privacy: "public",
    place: "Ocean Shores, Washington",
    text: "drove out to ocean shores for the day. the wind almost took my hat and my will to live",
    reactions: 19,
    mood: "haha",
  },
  {
    by: "nina.petrova",
    at: daysAgo(7, "19:05"),
    video: "kayak-sunset-wide",
    privacy: "public",
    text: "evening paddle 🛶 golden hour on the water, no notifications, no thoughts",
    reactions: 37,
    mood: "love",
  },
  {
    by: "arjun.mehta",
    at: daysAgo(8, "16:45"),
    video: "kayak-surf-wide",
    privacy: "public",
    text: "sup surfing a standing wave is harder than it looks (it looks hard)",
    reactions: 44,
    comments: [
      { by: "sofia.alvarez", text: "the balance!! teach me" },
      { by: "arjun.mehta", text: "step 1: fall in 40 times", after: 20 },
    ],
  },
  {
    by: "moonrisecoffee",
    at: hoursAgo(3),
    video: "espresso-routine-wide",
    privacy: "public",
    text: "Morning ritual ☕ Our Lantern espresso blend, pulled fresh at the Capitol Hill shop. First 20 people through the door today get a free cardamom bun.",
    reactions: 22,
    comments: [{ by: "jasmine.ortiz", text: "can confirm the buns are dangerous" }],
  },
  {
    by: "diego.morales",
    in: "seattle-foodies",
    at: daysAgo(2, "21:30"),
    video: "salmon-wide",
    privacy: "public",
    text: "staff meal tonight: pan-seared fish with lemon pepper and way too much butter. recipe in comments if anyone wants it",
    reactions: 52,
    comments: [
      { by: "camila.santos", text: "yes please drop it" },
      {
        by: "diego.morales",
        text: "salt, pepper, hot pan, don't touch it for 4 min. that's it",
        after: 15,
      },
    ],
  },
  {
    by: "malik.johnson",
    in: "seattle-concerts",
    at: daysAgo(1, "23:50"),
    video: "concert-wide",
    privacy: "public",
    text: "caught this set last weekend and I haven't stopped thinking about it 🎶 who else was there?",
    reactions: 61,
    comments: [
      { by: "harper.quinn", text: "I was in the back crying a little" },
      { by: "zoe.nguyen", text: "the lights!!" },
    ],
  },
  {
    by: "waxandneedle",
    at: daysAgo(3, "13:00"),
    video: "guitar-solo-wide",
    privacy: "public",
    text: "Friday shredding from our in-store session series 🎸 Next one is Nov 21, free entry, BYO earplugs.",
    reactions: 19,
  },
  {
    by: "jiho.choi",
    at: daysAgo(9, "15:10"),
    video: "skatepark-wide",
    privacy: "public",
    text: "afternoon at the bowl. still can't drop in but the vibes are immaculate 🛹",
    reactions: 22,
  },
  {
    by: "olivia.brooks",
    at: hoursAgo(14),
    video: "puppies-wide",
    privacy: "public",
    text: "two foster pups. one bed. zero chill 🐶",
    reactions: 30,
    mood: "love",
    likedBy: ["maya.chen"],
    comments: [
      { by: "hannah.lee", text: "I NEED them" },
      { by: "maya.chen", text: "the little one is plotting something" },
    ],
  },
  {
    by: "harper.quinn",
    at: daysAgo(4, "20:15"),
    video: "cat-straw-wide",
    privacy: "public",
    text: "Biscuit vs. the straw, round 47. The straw is winning.",
    reactions: 33,
    mood: "haha",
  },
  {
    by: "lena.fischer",
    at: daysAgo(10, "09:30"),
    video: "snowfall-wide",
    privacy: "public",
    text: "home for the week and it's already snowing ❄️ seattle could never",
    reactions: 29,
  },
  {
    by: "chris.adeyemi",
    at: daysAgo(6, "18:40"),
    video: "sunset-timelapse-wide",
    privacy: "public",
    text: "20 minutes of tonight's sunset compressed into 10 seconds. you're welcome",
    reactions: 31,
  },
  {
    by: "sofia.alvarez",
    in: "pnw-hikers",
    at: daysAgo(5, "19:00"),
    video: "waterfall-wide",
    privacy: "public",
    text: "Quick stop at the falls on the way back. Trail was a mud slide but so worth it. Bring poles!",
    reactions: 48,
    comments: [{ by: "tara.singh", text: "thanks for the trail report 🙏" }],
  },
  {
    by: "andre.silva",
    at: daysAgo(11, "14:00"),
    video: "dog-walk-wide",
    privacy: "public",
    text: "my neighbor's dog has more swagger than I ever will",
    reactions: 15,
  },

  // ── Reels (9:16) ───────────────────────────────────────────────────────────
  {
    by: "cascadeboulders",
    at: hoursAgo(2),
    video: "indoor-climbing-tall",
    privacy: "public",
    text: "New lead routes just went up on the north wall 🧗 Who's projecting this weekend? #climbing #seattle",
    reactions: 26,
  },
  {
    by: "tara.singh",
    at: hoursAgo(6),
    video: "myrtle-falls-tall",
    privacy: "public",
    text: "Myrtle Falls with the mountain peeking through 🏔️ 0.8 miles from the Paradise lot, no excuses #pnw #rainier",
    reactions: 34,
    likedBy: ["maya.chen"],
  },
  {
    by: "luis.hernandez",
    at: hoursAgo(11),
    video: "body-surf-tall",
    privacy: "public",
    text: "pov: the pacific in november is 52°F and you said yes anyway 🌊",
    reactions: 21,
    mood: "haha",
  },
  {
    by: "moonrisecoffee",
    at: hoursAgo(20),
    video: "espresso-macro-tall",
    privacy: "public",
    text: "Close-up of a perfect extraction. Tiger striping = happiness ☕✨",
    reactions: 27,
  },
  {
    by: "kumoramen",
    at: daysAgo(1, "17:00"),
    video: "noodles-tall",
    privacy: "public",
    text: "Noodles hitting the water at 5. Doors open at 5:30. You know what to do 🍜",
    reactions: 18,
  },
  {
    by: "sophie.dubois",
    at: daysAgo(1, "13:20"),
    video: "ocean-waves-tall",
    privacy: "public",
    text: "fieldwork today was just this for 3 hours and honestly no complaints 🌊 #oceanography",
    reactions: 28,
  },
  {
    by: "rainlineoutdoor",
    at: daysAgo(2, "10:30"),
    video: "mowich-rain-tall",
    privacy: "public",
    text: "Seattle forecast: this, but for six months. Gear up 🌧️ #pnw #rainseason",
    reactions: 16,
  },
  {
    by: "camila.santos",
    at: daysAgo(2, "19:45"),
    video: "puppies-tall",
    privacy: "public",
    text: "foster update: they've discovered the bed and they've chosen violence 🐶🐶",
    reactions: 38,
    mood: "love",
    likedBy: ["maya.chen"],
  },
  {
    by: "yuki.sato",
    at: daysAgo(3, "22:10"),
    video: "cat-straw-tall",
    privacy: "public",
    text: "she plays rough. the straw never stood a chance 🐱",
    reactions: 29,
    mood: "haha",
    likedBy: ["maya.chen"],
  },
  {
    by: "sam.rivera",
    at: daysAgo(3, "01:15"),
    video: "concert-tall",
    privacy: "public",
    text: "front row or nothing 🎶 this set was unreal, if you missed it I'm sorry",
    reactions: 14,
  },
  {
    by: "andre.silva",
    at: daysAgo(4, "23:30"),
    video: "guitar-solo-tall",
    privacy: "public",
    text: "practicing instead of sleeping, as one does 🎸 night shift brain",
    reactions: 64,
  },
  {
    by: "erin.mcallister",
    at: daysAgo(5, "16:00"),
    video: "kayak-surf-tall",
    privacy: "public",
    text: "standing wave season 🌊🏄 fell in 12 times, stood up once, worth it",
    reactions: 19,
  },
  {
    by: "mei.tanaka",
    at: daysAgo(6, "18:30"),
    video: "sunset-timelapse-tall",
    privacy: "public",
    text: "sunset speedrun 🌅 painting this later",
    reactions: 31,
  },
  {
    by: "leo.novak",
    at: daysAgo(7, "15:45"),
    video: "waterfall-tall",
    privacy: "public",
    text: "first PNW waterfall. i get it now. chicago could never 🌲",
    reactions: 17,
    comments: [{ by: "tara.singh", text: "welcome to the cult 🥾" }],
  },
  {
    by: "diego.morales",
    at: daysAgo(8, "22:00"),
    video: "salmon-tall",
    privacy: "public",
    text: "family meal in 10 seconds 🔥 #linecook #seattlefood",
    reactions: 22,
  },
  {
    by: "maddie.collins",
    at: daysAgo(9, "08:20"),
    video: "dog-walk-tall",
    privacy: "public",
    text: "Pickles' morning walk is 80% sniffing, 20% walking, 100% his decision 🐾",
    reactions: 15,
    mood: "love",
  },

  // ── Sponsored video ad (9:16, letterboxed in the feed) ─────────────────────
  {
    by: "rainlineoutdoor",
    at: hoursAgo(1),
    sponsored: true,
    video: "ridge-hike-tall",
    privacy: "public",
    text: "Built for the scramble. The Ridgeline Softshell stretches where you do, sheds snow and wind, and packs down to the size of a water bottle. Shop the winter collection → rainline.co",
    reactions: 64,
  },
];

// ── Comment threads on Reels and videos ─────────────────────────────────────

/** Compact comment builders: `c(by, text, replies?)`, `r(by, text, replies?)`. */
const c = (by: Handle, text: string, replies?: readonly ReplySeed[]): CommentSeed => ({
  by,
  text,
  replies,
});
const r = (by: Handle, text: string, replies?: readonly ReplySeed[]): ReplySeed => ({
  by,
  text,
  replies,
});

/**
 * Extra comments per clip, appended to that video post's own. Reels get 3–25
 * (replies included) so the Reels rail's comment counts read like Facebook's.
 */
const threads: Partial<Record<VideoClip, readonly CommentSeed[]>> = {
  // Reels
  "indoor-climbing-tall": [
    c("grace.liu", "the new orange 11b is SO sandbagged", [
      r("kai.nakamura", "it's a 12a in disguise and everyone knows it"),
      r("cascadeboulders", "we'll take another look at it this week 👀"),
    ]),
    c("arjun.mehta", "projecting saturday morning if anyone wants to belay swap"),
    c("sofia.alvarez", "the clip at the third bolt is spicy"),
    c("lena.fischer", "finally some new stuff on the north wall 🙌"),
    c("leo.novak", "how do people trust those little holds", [
      r("grace.liu", "you don't. you just commit and pray"),
    ]),
    c("theo.grant", "yall the auto belays are open again right?"),
    c("ben.carter", "setters cooked with this one"),
    c("andre.silva", "who's the climber? that flag at 0:06 was clean"),
    c("maya.chen", "ok I'm finally trying lead this month"),
    c("tara.singh", "need a rest day from looking at this"),
  ],
  "myrtle-falls-tall": [
    c("erin.mcallister", "PEAK pnw content"),
    c("arjun.mehta", "the mountain was out for you 🥹"),
    c("sofia.alvarez", "was the road to paradise icy at all?", [
      r("tara.singh", "dry until about the last mile, chains not needed yet"),
      r("sofia.alvarez", "perfect thank you!!"),
    ]),
    c("maya.chen", "adding to the list before the snow"),
    c("leo.novak", "this doesn't even look real"),
    c("kevin.tran", "0.8 miles i can do that"),
    c("ana.torres", "my lock screen now sorry"),
    c("lena.fischer", "best little hike in the park honestly"),
    c("will.foster", "went in august and it was packed, this is way nicer"),
    c("grace.liu", "the light!!!"),
    c("noah.williams", "we should do a group trip before it closes", [
      r("zoe.nguyen", "I'm in"),
      r("isaiah.thompson", "me too if there's a car"),
      r("noah.williams", "making a chat"),
    ]),
    c("hannah.lee", "how do you always find the perfect weather"),
    c("owen.murphy", "the rainier hype is real"),
    c("priya.raman", "so pretty"),
    c("theo.grant", "wildflowers must have been insane earlier"),
    c("rachel.goldberg", "saving for next summer"),
    c("mei.tanaka", "want to paint this so bad"),
  ],
  "body-surf-tall": [
    c("sophie.dubois", "52 is generous honestly"),
    c("will.foster", "the scream at the end 😂"),
    c("jamal.wilson", "no wetsuit?? you're built different", [
      r("luis.hernandez", "3mm wetsuit, still regretted it"),
    ]),
    c("erin.mcallister", "this is a cry for help"),
    c("owen.murphy", "westport?", [r("luis.hernandez", "yeah right by the jetty")]),
    c("ryan.oconnor", "my toes hurt watching this"),
  ],
  "espresso-macro-tall": [
    c("jasmine.ortiz", "the tiger striping 🤌"),
    c("nina.petrova", "what grinder are you using?", [
      r("moonrisecoffee", "Mazzer Super Jolly, dialed in fresh every morning ☕"),
    ]),
    c("tasha.okafor", "this is the most relaxing thing I've seen all week"),
    c("diego.morales", "pulling shots at 6am hits different"),
    c("maya.chen", "the cardamom bun + this combo is elite"),
    c("samir.khan", "I could watch this on loop"),
    c("chris.adeyemi", "how many grams in?", [r("moonrisecoffee", "18 in, 38 out, ~28 sec")]),
    c("harper.quinn", "coffee asmr"),
  ],
  "noodles-tall": [
    c("diego.morales", "the noodle pull 🔥"),
    c("camila.santos", "line was around the block last friday"),
    c("kevin.tran", "tonkotsu or spicy miso?", [
      r("kumoramen", "Spicy miso if you're new, tonkotsu if you're loyal 🍜"),
      r("kevin.tran", "both it is"),
    ]),
    c("malik.johnson", "I'm hungry now thanks"),
    c("jessica.huang", "we need to go back"),
    c("ethan.park", "best ramen on the hill not even close"),
  ],
  "ocean-waves-tall": [
    c("luis.hernandez", "best office ever"),
    c("nina.petrova", "jealous of your fieldwork"),
    c("sophie.dubois", "they pay me to look at water (sometimes)"),
    c("maya.chen", "so calming 🌊"),
  ],
  "mowich-rain-tall": [
    c("erin.mcallister", "accurate"),
    c("owen.murphy", "my rain jacket is from 2014 and it shows", [
      r("rainlineoutdoor", "Time for an upgrade 😉 Bring it in for 20% off a trade-in this month."),
    ]),
    c("noah.williams", "six months is optimistic"),
    c("lena.fischer", "this is my favorite weather tbh", [r("tara.singh", "same, no crowds")]),
    c("jordan.kim", "forecast: wet. forever."),
    c("chloe.wright", "I moved here for this and I don't regret it"),
    c("ryan.oconnor", "the drip off the trees 🌧️"),
    c("amara.diallo", "pnw rain hits different in the forest"),
  ],
  "puppies-tall": [
    c("olivia.brooks", "THEY'VE CHOSEN VIOLENCE 😭"),
    c("hannah.lee", "I need both. immediately."),
    c("maya.chen", "the little one with the ear flop!!!", [
      r("camila.santos", "that's Mochi, she's the instigator"),
      r("maya.chen", "of course she is"),
    ]),
    c("ana.torres", "are they up for adoption??", [
      r("camila.santos", "yes! through Seattle Humane, link in my bio"),
      r("ana.torres", "sending to my roommate rn"),
      r("hannah.lee", "do NOT tempt me"),
    ]),
    c("zoe.nguyen", "the bed is theirs now, you live there"),
    c("jasmine.ortiz", "obsessed"),
    c("tasha.okafor", "I would die for them"),
    c("amara.diallo", "the tail wags 😭😭"),
    c("emily.chen", "can we please get a dog", [r("kevin.tran", "no")]),
    c("isaiah.thompson", "this is the content I'm here for"),
    c("priya.raman", "omg"),
    c("chloe.wright", "fostering is on my list for next year"),
    c("ethan.park", "MOCHI"),
    c("will.foster", "bed has been fully claimed"),
    c("olivia.brooks", "my fosters say hi 🐶", [r("camila.santos", "puppy playdate???")]),
    c("lily.anderson", "cutest thing on my feed today"),
    c("rachel.goldberg", "need hourly updates"),
  ],
  "cat-straw-tall": [
    c("harper.quinn", "Biscuit would never lose like this"),
    c("yuki.sato", "she's undefeated 🏆", [r("harper.quinn", "rematch. 3pm. be there.")]),
    c("mei.tanaka", "the little butt wiggle before the pounce 😭"),
    c("jessica.huang", "cats with straws is an entire genre"),
    c("marco.rossi", "she plays rough indeed"),
    c("nora.kowalski", "what's her name?", [r("yuki.sato", "Tofu 🐱")]),
    c("aisha.rahman", "TOFU 😍"),
    c("daniel.reyes", "my cat ignores every toy I buy but loves straws, explain"),
    c("sam.rivera", "fighting for her life"),
    c("fatima.hassan", "this made my morning"),
    c("chloe.wright", "the straw had a family"),
    c("zoe.nguyen", "need more Tofu content"),
  ],
  "concert-tall": [
    c("malik.johnson", "this was the best set of the year"),
    c("harper.quinn", "I was like 3 people behind you!!", [
      r("sam.rivera", "no way, wish I saw you"),
    ]),
    c("zoe.nguyen", "the lights tho"),
    c("jamal.wilson", "still ringing from this"),
  ],
  "guitar-solo-tall": [
    c("malik.johnson", "this is so clean"),
    c("waxandneedle", "come play our in-store session 🎸", [
      r("andre.silva", "for real?? dm'd you"),
    ]),
    c("theo.grant", "night shift brain is the best practice brain"),
    c("sam.rivera", "what amp is that?", [
      r("andre.silva", "cheap little boss katana, does the job"),
    ]),
    c("chris.adeyemi", "neighbors must love you"),
    c("ben.carter", "slept through this? couldn't be me"),
    c("kai.nakamura", "the bends 🔥"),
    c("marco.rossi", "need the tab for this"),
    c("noah.williams", "lowkey sounds like a whole song"),
    c("ryan.oconnor", "please start a band", [
      r("andre.silva", "we need a drummer"),
      r("ryan.oconnor", "I have a cajon and no shame"),
    ]),
    c("jordan.kim", "goosebumps"),
    c("daniel.reyes", "so good man"),
  ],
  "kayak-surf-tall": [
    c("arjun.mehta", "12 to 1 is a great ratio honestly"),
    c("sofia.alvarez", "where is this??", [r("erin.mcallister", "skookumchuck, the narrows")]),
    c("nina.petrova", "I'll stick to flat water thanks"),
  ],
  "sunset-timelapse-tall": [
    c("chris.adeyemi", "that sky 😮‍💨"),
    c("mei.tanaka", "the pink right before it goes dark", [
      r("aisha.rahman", "post the painting!!"),
    ]),
    c("lily.anderson", "golden hour supremacy"),
    c("tyler.jensen", "where were you shooting from?"),
  ],
  "waterfall-tall": [
    c("grace.liu", "wait until you see snoqualmie in the spring"),
    c("leo.novak", "chicago has the bean, we have this. not fair"),
    c("sofia.alvarez", "which trail was this?", [
      r("leo.novak", "twin falls! super easy"),
      r("sofia.alvarez", "good pick for a first one"),
    ]),
    c("marcus.bell", "welcome to the pnw, you'll never leave"),
    c("arjun.mehta", "ok now do rainier"),
  ],
  "salmon-tall": [
    c("camila.santos", "that sear 😮‍💨"),
    c("diego.morales", "family meal is the real menu"),
    c("kumoramen", "Line cook energy 🔥"),
    c("malik.johnson", "recipe pls", [
      r("diego.morales", "salt pepper hot pan, don't touch it, butter baste at the end"),
      r("malik.johnson", "that's it??"),
      r("diego.morales", "that's it"),
    ]),
    c("jasmine.ortiz", "this is a whole vibe"),
    c("nora.kowalski", "I would eat this every day"),
  ],
  "dog-walk-tall": [
    c("maddie.collins", "he really runs the house"),
    c("olivia.brooks", "PICKLES 😭"),
    c("will.foster", "80% sniffing is generous"),
  ],
  // Feed / Watch videos
  "seattle-viaduct-wide": [c("marcus.bell", "the viaduct drive at sunset was elite though")],
  "puget-ferry-wide": [
    c("sophie.dubois", "the ferry snack bar is criminally underrated"),
    c("will.foster", "I would trade my bus for this in a second"),
  ],
  "ship-canal-bridge-wide": [
    c("maya.chen", "this is so pretty grace 😍"),
    c("lena.fischer", "fremont at blue hour never misses"),
    c("arjun.mehta", "send me the location of the shot"),
  ],
  "golden-gardens-wide": [
    c("will.foster", "I'm in. I'll regret it but I'm in"),
    c("olivia.brooks", "we did it last year and I still think about it"),
  ],
  "mowich-rain-wide": [
    c("tara.singh", "road closes next weekend, go now!"),
    c("lena.fischer", "rainy mowich is the best mowich"),
  ],
  "ocean-shores-wide": [
    c("emily.chen", "the hat 😭"),
    c("jessica.huang", "we used to go every summer as kids"),
  ],
  "kayak-sunset-wide": [
    c("chris.adeyemi", "no thoughts head empty paddle"),
    c("rachel.goldberg", "this looks so peaceful"),
  ],
  "guitar-solo-wide": [c("andre.silva", "putting this on my calendar")],
  "skatepark-wide": [c("zoe.nguyen", "you'll drop in by spring!! I believe")],
  "cat-straw-wide": [
    c("yuki.sato", "Tofu sends her regards", [r("harper.quinn", "Biscuit accepts the challenge")]),
  ],
  "snowfall-wide": [c("maya.chen", "so jealous!! enjoy home"), c("grace.liu", "SNOW ❄️")],
  "sunset-timelapse-wide": [c("nina.petrova", "how are your sunsets always better than mine")],
  "dog-walk-wide": [c("maddie.collins", "the swagger 😂"), c("marco.rossi", "main character")],
};

/**
 * Reels and videos people re-shared to their own timelines (drives Share
 * counts). Shares of the newest reels come from people outside Maya's friends,
 * so they don't crowd the top of her Home feed.
 */
const shares: readonly { clip: VideoClip; by: Handle; at: TimeSpec; text?: string }[] = [
  {
    clip: "indoor-climbing-tall",
    by: "ben.carter",
    at: hoursAgo(1.5),
    text: "who's coming saturday 🧗",
  },
  { clip: "indoor-climbing-tall", by: "andre.silva", at: hoursAgo(1) },
  {
    clip: "myrtle-falls-tall",
    by: "erin.mcallister",
    at: hoursAgo(4),
    text: "adding this to the list",
  },
  { clip: "myrtle-falls-tall", by: "will.foster", at: hoursAgo(3) },
  { clip: "body-surf-tall", by: "jamal.wilson", at: hoursAgo(8), text: "luis you are not well" },
  {
    clip: "espresso-macro-tall",
    by: "jasmine.ortiz",
    at: hoursAgo(16),
    text: "best coffee on the hill, not up for debate ☕",
  },
  { clip: "noodles-tall", by: "kevin.tran", at: daysAgo(1, "19:30"), text: "dinner tonight? 🍜" },
  {
    clip: "puppies-tall",
    by: "olivia.brooks",
    at: daysAgo(2, "21:00"),
    text: "someone please adopt these babies 🐶",
  },
  { clip: "puppies-tall", by: "aisha.rahman", at: daysAgo(2, "22:30") },
  { clip: "puppies-tall", by: "lily.anderson", at: daysAgo(1, "12:00"), text: "MOCHI 😭" },
  { clip: "puppies-tall", by: "hannah.lee", at: daysAgo(1, "08:15") },
  {
    clip: "cat-straw-tall",
    by: "harper.quinn",
    at: daysAgo(2, "09:00"),
    text: "Biscuit has competition",
  },
  { clip: "cat-straw-tall", by: "nora.kowalski", at: daysAgo(2, "14:00") },
  {
    clip: "guitar-solo-tall",
    by: "malik.johnson",
    at: daysAgo(3, "12:40"),
    text: "this man needs a record deal",
  },
  { clip: "guitar-solo-tall", by: "sam.rivera", at: daysAgo(3, "10:00") },
  {
    clip: "mowich-rain-tall",
    by: "tara.singh",
    at: daysAgo(2, "12:00"),
    text: "gear check before you go",
  },
  { clip: "salmon-tall", by: "camila.santos", at: daysAgo(7, "13:00") },
  { clip: "puppies-wide", by: "ana.torres", at: hoursAgo(12.5), text: "the fosters!! 🥹" },
];

/** A stable 0–1 fraction per string (FNV-1a), so seeded view counts vary but never change. */
function unit(key: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
  return (h >>> 0) / 0x1_0000_0000;
}

const pageFollowers = new Map<Handle, number>(pages.map((p) => [p.username, p.followers]));

/**
 * Views a video had before the seeded history (recorded ≥3s plays add to
 * it). Reach follows popularity: a person's clip reaches some friends
 * (a few hundred to a couple thousand), a Page's reaches a share of its
 * followers, and Reels travel far beyond either.
 */
function viewBaseline(p: PostSeed, reel: boolean, reactions: number) {
  const u = unit(`${p.by}:${p.video}`);
  const followers = pageFollowers.get(p.by);
  const views = reel
    ? (followers ?? 2000) * (0.3 + 0.9 * u) + reactions * (120 + 900 * u)
    : followers
      ? followers * (0.08 + 0.35 * u) + reactions * 40
      : 120 + reactions * (8 + 22 * u);
  return Math.round(Math.min(250_000, Math.max(300, views)));
}

/** Every video post, plus friends' shares of the popular ones. */
export const videoPosts: readonly PostSeed[] = [
  ...baseVideoPosts.map((p) => {
    const extra = p.video ? threads[p.video] : undefined;
    const shared = p.video && shares.some((s) => s.clip === p.video);
    // Reels travel further than feed posts: more people react to them. Maya
    // has reacted to only the few Reels marked `likedBy` (about one in five).
    const reel = !!p.video && !p.sponsored && isTallClip(p.video);
    const reactions =
      reel && p.reactions ? Math.min(120, Math.round(p.reactions * 2.5)) : p.reactions;
    return {
      ...p,
      notLikedBy: reel && !p.likedBy?.includes(MAIN) ? [MAIN] : p.notLikedBy,
      key: p.key ?? (shared ? `video-${p.video}` : undefined),
      reactions,
      comments: extra ? [...(p.comments ?? []), ...extra] : p.comments,
      views: p.video ? viewBaseline(p, reel, reactions ?? 20) : undefined,
    };
  }),
  ...shares.map((s) => ({
    by: s.by,
    at: s.at,
    share: `video-${s.clip}`,
    text: s.text,
    privacy: "public" as const,
  })),
];

/** Video stories (last 24h) from Maya's friends. */
export const videoStories: readonly StorySeed[] = [
  { by: "lena.fischer", video: "snowfall-tall", text: "first snow ❄️", at: hoursAgo(1.6) },
  { by: "ana.torres", video: "rain-sonoma-tall", text: "it's giving november", at: hoursAgo(3) },
  { by: "zoe.nguyen", video: "skatepark-tall", text: "skate date 🛹", at: hoursAgo(8) },
  { by: "maddie.collins", video: "dog-walk-tall", text: "pickles on patrol", at: hoursAgo(13) },
];
