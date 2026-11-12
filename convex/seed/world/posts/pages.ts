import { daysAgo, hoursAgo } from "../../lib/time";
import type { PostSeed } from "../../types";

/** Posts by the 8 fictional Pages. Exactly 4 are sponsored (3 Fogline, 1 Kumo). */
export const pagePosts: readonly PostSeed[] = [
  // ── The Fog City Ledger ──────────────────────────────────────────────────
  {
    key: "ledger-rent-report",
    by: "fogcityledger",
    at: daysAgo(8, "08:15"),
    text: "Median rent for a San Francisco one-bedroom is now $3,350, up 7% from last fall. The Mission and SoMa saw the biggest jumps. Renters under 30 are now spending an average of 41% of income on housing.",
    link: {
      url: "https://fogcityledger.news/housing/2026/11/sf-rents-fall-report",
      title: "SF rents climb 7% in a year, with the Mission leading the way",
      domain: "fogcityledger.news",
      description:
        "Our twice-yearly rent survey of 3,400 Bay Area listings finds one-bedrooms up sharply in the Mission, SoMa and the Inner Richmond, while studios near the Berkeley campus flattened for the first time since 2021.",
      image: "covers/castro-01.jpg",
    },
    reactions: 55,
    mood: "sad",
    likedBy: ["maya.chen", "jordan.kim"],
    comments: [
      {
        by: "maya.chen",
        text: "cool cool cool I'm apartment hunting in the mission rn so this is great news for me",
        likes: 14,
        replies: [
          { by: "harper.quinn", text: "lmk if you need a neighbor reference, I'll lie for you" },
        ],
      },
      {
        by: "derek.holloway",
        text: "Not defending everything here but people don't see the other side. Insurance on my duplex went up 40% this year and half the carriers won't even write new policies. That has to go somewhere.",
        likes: 6,
        replies: [
          {
            by: "jordan.kim",
            text: "Both things are true. Costs are up for small landlords AND the supply problem is the real driver. We zoned most of the west side for single family homes and then acted surprised.",
            likes: 9,
          },
          {
            by: "derek.holloway",
            text: "Jordan Kim no argument from me on the zoning part. Let me build a backyard cottage without 14 months of permits and I will",
          },
        ],
      },
      {
        by: "marcus.bell",
        text: "paid $3,400 for my 1br in september. guess I'm just ahead of the curve 🙃",
      },
      {
        by: "camila.santos",
        text: "41% is generous. I'm at like 55 and I bartend 5 nights a week",
      },
      {
        by: "sophie.dubois",
        text: "grad stipend went up 3% this year. rent went up 7%. the math is not mathing",
        likes: 8,
      },
      {
        by: "kevin.tran",
        text: "the richmond up that much?? I thought it was supposed to be the cheaper option",
      },
      {
        by: "priya.raman",
        text: "this is why I'm subletting my elmwood room while I'm abroad instead of giving it up. never getting that rent again",
      },
      {
        by: "nora.kowalski",
        text: "would love to see this broken down by neighborhood. is the Berkeley number real??",
        replies: [
          {
            by: "fogcityledger",
            text: "Nora Kowalski the full neighborhood table is at the bottom of the article. We only counted listings that actually rented, not asking prices.",
            likes: 4,
          },
        ],
      },
    ],
  },
  {
    by: "fogcityledger",
    at: daysAgo(5, "10:30"),
    text: "Starting Dec 5, BART will run trains until 2am on Fridays and Saturdays as a one-year pilot.",
    link: {
      url: "https://fogcityledger.news/transit/2026/11/bart-late-night-pilot",
      title: "BART adds late-night service on weekends",
      domain: "fogcityledger.news",
      description:
        "Trains will run every 20 minutes between midnight and 2am on Friday and Saturday nights through next December.",
      image: "light rail",
    },
    reactions: 48,
    mood: "love",
    comments: [
      { by: "malik.johnson", text: "FINALLY. no more $40 uber from the owl to fruitvale" },
      {
        by: "isaiah.thompson",
        text: "bart at 1am on a saturday is gonna be wild. ok bart i see you",
      },
    ],
  },
  {
    by: "fogcityledger",
    at: daysAgo(3, "13:00"),
    text: "The Lucky Gull Diner in Berkeley's Elmwood will close Nov 29 after 22 years. The owners say their lease renewal came with a 60% rent increase.",
    link: {
      url: "https://fogcityledger.news/food/2026/11/lucky-gull-diner-closing",
      title: "Lucky Gull Diner to close after 22 years on College Ave",
      domain: "fogcityledger.news",
      description:
        "The 24-seat diner, known for its olallieberry pancakes and the hand-painted gull over the door, will serve its last breakfast the Sunday after Thanksgiving.",
      image: "diner breakfast",
    },
    reactions: 52,
    mood: "sad",
    comments: [
      {
        by: "hannah.lee",
        text: "nooo the olallieberry pancakes 😭 we went there after every single finals week",
      },
      {
        by: "ana.torres",
        text: "Maya Chen we're going before it closes. this weekend. not up for discussion",
      },
      { by: "diego.morales", text: "60% is insane. that's not a lease that's an eviction notice" },
    ],
  },
  {
    by: "fogcityledger",
    at: hoursAgo(20),
    text: "An atmospheric river is headed for the Bay Area this weekend. Expect 2 to 4 inches of rain in San Francisco and possible flooding on the Embarcadero and the Great Highway Saturday night.",
    link: {
      url: "https://fogcityledger.news/weather/2026/11/atmospheric-river-weekend",
      title: "Atmospheric river could bring 4 inches of rain to SF this weekend",
      domain: "fogcityledger.news",
      image: "city bus",
    },
    reactions: 24,
    mood: "wow",
    comments: [
      { by: "daniel.reyes", text: "saturday run club is still on. we are not made of sugar" },
      {
        by: "sofia.alvarez",
        text: "the ER thanks you in advance for not driving through standing water",
      },
    ],
  },
  {
    by: "fogcityledger",
    at: daysAgo(12, "09:00"),
    text: "The empty lot at Page and Shrader that's been fenced off since 2019 is officially a park now. Opening day is Saturday.",
    link: {
      url: "https://fogcityledger.news/neighborhoods/2026/10/haight-pocket-park-opens",
      title: "The Haight's newest pocket park opens on a former parking lot",
      domain: "fogcityledger.news",
      description: "Benches, a small dog run, native plants and a covered bike corral.",
      image: "city park",
    },
    reactions: 33,
    mood: "love",
    comments: [
      {
        by: "lena.fischer",
        text: "a dog run 2 blocks from my clinic. my lunch breaks are about to get so much better",
      },
    ],
  },
  {
    by: "fogcityledger",
    at: daysAgo(22, "07:45"),
    text: "Muni is extending the red transit lanes on Geary out to 34th Ave for the 38R. Construction starts in January.",
    link: {
      url: "https://fogcityledger.news/transit/2026/10/geary-red-lanes",
      title: "The 38 Geary gets red lanes through the Richmond",
      domain: "fogcityledger.news",
      image: "city bus",
    },
    reactions: 19,
    comments: [
      {
        by: "theo.grant",
        text: "the 38 taking 50 minutes to go 4 miles is the true sf experience",
      },
    ],
  },

  // ── Sather Gate Campus Life ──────────────────────────────────────────────
  {
    by: "sathergatecampuslife",
    at: hoursAgo(5),
    text: "🍕 FREE FOOD ALERT 🍕 leftover catering from the EECS career fair, Soda Hall lobby. Sandwich trays, cookies, a suspicious amount of hummus. Go go go",
    reactions: 41,
    mood: "haha",
    comments: [
      {
        by: "noah.williams",
        text: "can confirm. the turkey ones are gone, the hummus is infinite",
      },
      { by: "isaiah.thompson", text: "sprinting from evans rn" },
      {
        by: "sathergatecampuslife",
        text: "update: cookies are gone. hummus remains. it will outlive us all",
        likes: 12,
      },
    ],
  },
  {
    by: "sathergatecampuslife",
    at: daysAgo(2, "12:00"),
    text: "Finals week library hours are out! Moffitt goes 24 hours starting Sunday Dec 6 through Friday Dec 11. Doe stays open until midnight. The MLK Student Union will have free coffee 8 to 10am Monday through Wednesday.",
    photos: ["library"],
    reactions: 37,
    comments: [
      {
        by: "amara.diallo",
        text: "group study night in moffitt on the 6th, details in the class of 2027 group 📚",
      },
      { by: "hannah.lee", text: "the free coffee is the only thing getting me through" },
    ],
  },
  {
    by: "sathergatecampuslife",
    at: daysAgo(4, "16:00"),
    text: "Golden Bear Hacks is less than two weeks out and we still have spots! 24 hours, free food, prizes, and the designers-are-welcome track is back. Teams of up to 4, solo signups get matched at check-in.",
    event: "golden-bear-hacks",
    reactions: 29,
    comments: [
      {
        by: "noah.williams",
        text: "Maya Chen this is your sign. we need a designer and you know it",
        replies: [{ by: "maya.chen", text: "I have 2 finals the week after... but also hmm" }],
      },
      {
        by: "jiho.choi",
        text: "is it ok to come if it's my first hackathon?",
        replies: [
          {
            by: "sathergatecampuslife",
            text: "100%! about a third of people every year are first timers",
          },
        ],
      },
    ],
  },
  {
    by: "sathergatecampuslife",
    at: daysAgo(9, "08:10"),
    text: "frost on memorial glade this morning. coldest day of the semester so far. stay warm out there",
    photos: ["berkeley campus", "berkeley campus"],
    reactions: 46,
    mood: "love",
    comments: [
      { by: "zoe.nguyen", text: "the light was so good today, shot a whole roll walking to class" },
    ],
  },
  {
    by: "sathergatecampuslife",
    at: daysAgo(16, "11:00"),
    text: "Reminder: spring semester Phase 2 enrollment opens Monday at 6am. Set an alarm. Check your holds in CalCentral now, not Sunday night.",
    reactions: 22,
    comments: [
      {
        by: "daniel.reyes",
        text: "every semester I say I'll check my holds early and every semester I don't",
      },
    ],
  },

  // ── Moonrise Coffee Co. ──────────────────────────────────────────────────
  {
    key: "moonrise-holiday-menu",
    by: "moonrisecoffee",
    at: daysAgo(2, "09:30"),
    text: "Holiday menu is here ☕ Gingerbread oat latte, a smoked maple cortado, cardamom buns (weekends only, they sell out by 10), and the return of the peppermint mocha nobody admits to ordering.",
    photos: ["latte", "cardamom buns", "coffee shop"],
    reactions: 53,
    mood: "love",
    likedBy: ["maya.chen", "tasha.okafor"],
    comments: [
      { by: "maya.chen", text: "smoked maple cortado?? I'll be there in 20" },
      {
        by: "jasmine.ortiz",
        text: "I've made like 400 of these this week and I'm still not sick of them",
      },
      {
        by: "ana.torres",
        text: "the cardamom buns are dangerous. I work there and I still buy them",
      },
      {
        by: "leo.novak",
        text: "is the gingerbread one sweet? I don't do super sweet drinks",
        replies: [
          {
            by: "moonrisecoffee",
            text: "Leo Novak it's on the spicier side! ask for half syrup if you're worried",
            after: 40,
          },
        ],
      },
    ],
  },
  {
    by: "moonrisecoffee",
    at: daysAgo(1, "15:00"),
    text: "Board game night is every Thursday at 7 in our back room. Bring a friend, bring a game, or just bring yourself and someone will teach you something.",
    event: "board-game-night",
    reactions: 21,
    comments: [
      { by: "tyler.jensen", text: "wingspan teach next week, I'm bringing the european expansion" },
    ],
  },
  {
    by: "moonrisecoffee",
    at: daysAgo(8, "14:00"),
    text: "Latte art throwdown is back Dec 4! 16 baristas, one bracket, $300 to the winner. Jasmine is defending her title and she's been practicing on all of you.",
    event: "latte-art-throwdown",
    photos: ["latte art"],
    reactions: 38,
    comments: [
      { by: "jasmine.ortiz", text: "the swan is ready. the swan has always been ready" },
      { by: "harper.quinn", text: "front row with a sign" },
    ],
  },
  {
    by: "moonrisecoffee",
    at: daysAgo(6, "07:05"),
    text: "Day 9 of Karl the Fog parked over Valencia. Drip coffee is $1 off until the sun comes out. We fully understand this may never happen.",
    bg: "night",
    reactions: 44,
    mood: "haha",
    comments: [{ by: "marcus.bell", text: "so free coffee forever basically" }],
  },

  // ── Sutro Boulders ───────────────────────────────────────────────────────
  {
    key: "sutro-new-set",
    by: "sutroboulders",
    at: daysAgo(3, "18:00"),
    text: 'Fresh set on the slab and the comp wall is open! 22 new problems, V0 to V9. Kai says the orange V6 is "totally fair" which means it absolutely is not.',
    photos: ["bouldering gym", "climbing holds", "bouldering gym"],
    reactions: 47,
    likedBy: ["maya.chen", "sofia.alvarez"],
    comments: [
      {
        by: "sofia.alvarez",
        text: "the orange v6 has a dyno. I'm not dynoing on a slab Kai",
        replies: [
          { by: "kai.nakamura", text: "there's a static beta. I promise. probably", likes: 9 },
        ],
      },
      { by: "maya.chen", text: "the pink v3 on the comp wall is SO fun. did it like 6 times" },
      { by: "arjun.mehta", text: "going tomorrow after work, who's in" },
      {
        by: "lena.fischer",
        text: "reminder to warm up your fingers before the crimpy blue one. I'm begging you",
      },
    ],
  },
  {
    by: "sutroboulders",
    at: daysAgo(5, "17:00"),
    text: "Bay Area Climbers group night is Wednesday the 18th and they'll be some of the first on the new overhang set. Non-members get the $15 group rate at the desk.",
    event: "climbing-night",
    reactions: 26,
    comments: [
      {
        by: "leo.novak",
        text: "I've been bouldering exactly twice, is this ok for me?",
        replies: [
          {
            by: "sutroboulders",
            text: "Leo Novak absolutely! there are groups for every level, come at 6:15 for the intro",
          },
        ],
      },
    ],
  },
  {
    by: "sutroboulders",
    at: daysAgo(17, "16:30"),
    text: "Thank you to all 150 climbers who came out for the fall comp! Results are up at the front desk. Congrats to Andre Silva for taking the open men's category and to everyone who sent the cursed purple V2.",
    photos: ["posts/bouldering-gym-03.jpg", "bouldering gym"],
    reactions: 39,
    comments: [
      { by: "andre.silva", text: "still can't feel my forearms" },
      { by: "sofia.alvarez", text: "ANDRE!!! told you that heel hook was it" },
    ],
  },

  // ── Wax & Needle Records ─────────────────────────────────────────────────
  {
    by: "waxandneedle",
    at: daysAgo(5, "21:30"),
    text: "Thank you to everyone who squeezed in for Marigold Static on Friday. We counted 74 people in a room that fits 50 and nobody knocked over the dollar bins. A miracle.",
    photos: ["concert"],
    reactions: 31,
    comments: [
      {
        by: "marco.rossi",
        text: "got some good shots from behind the counter, sending them your way",
      },
      { by: "camila.santos", text: "best in-store of the year easy" },
    ],
  },
  {
    by: "waxandneedle",
    at: daysAgo(1, "12:30"),
    text: "New arrivals wall is restocked. Big haul of 70s Japanese city pop, a pile of Lookout! Records first pressings from a collection out of Stockton, and more jazz reissues than we have room for.",
    photos: ["vinyl records", "vinyl records"],
    reactions: 27,
    comments: [
      {
        by: "malik.johnson",
        text: "hold the city pop for me I'm coming after my shift",
        replies: [
          {
            by: "waxandneedle",
            text: "Malik Johnson we can hold til 6, after that it's a free for all",
          },
        ],
      },
      { by: "zoe.nguyen", text: "the album art on that second one 😍" },
    ],
  },
  {
    by: "waxandneedle",
    at: daysAgo(14, "11:00"),
    text: "Save the date: Winter Record Fair, Dec 12. 25 dealers, DJs all day, and 3,000 records that have never seen the floor.",
    event: "record-fair",
    reactions: 24,
    comments: [{ by: "will.foster", text: "I'll bring the truck to haul my bad decisions home" }],
  },

  // ── Paper Lantern Books ──────────────────────────────────────────────────
  {
    by: "paperlanternbooks",
    at: daysAgo(4, "11:00"),
    text: 'November staff picks are on the front table. Sam\'s pick this month is a 600 page Icelandic mystery that they keep describing as "cozy" which is concerning.',
    photos: ["bookstore", "stack of books"],
    reactions: 34,
    comments: [
      { by: "sam.rivera", text: "it IS cozy. there's a lot of soup. also a lot of murder" },
      { by: "sophie.dubois", text: "I need a foggy day book for the ferry, adding it to the list" },
    ],
  },
  {
    by: "paperlanternbooks",
    at: daysAgo(7, "10:00"),
    text: "We're hosting June Okada for the launch of The Ferry Year on Friday the 20th. Reading, Q&A with our own Sam Rivera, and signing. Free, but please RSVP so we have enough chairs!",
    event: "paper-lantern-author-night",
    reactions: 28,
    comments: [
      {
        by: "maya.chen",
        text: "Zoe Nguyen we should go, she's the one who wrote that essay we read in 300",
      },
    ],
  },
  {
    by: "paperlanternbooks",
    at: daysAgo(19, "15:30"),
    text: "Moby has claimed the poetry section for the afternoon. Please browse around him.",
    photos: ["cat"],
    reactions: 55,
    mood: "love",
    comments: [
      { by: "hannah.lee", text: "moby supremacy" },
      {
        by: "maddie.collins",
        text: "I would also like to nap in the poetry section",
        replies: [{ by: "paperlanternbooks", text: "he says no" }],
      },
    ],
  },

  // ── Kumo Ramen Bar ───────────────────────────────────────────────────────
  {
    by: "kumoramen",
    at: daysAgo(6, "11:30"),
    text: "New on the menu: black garlic tantanmen. Sesame broth, spicy pork, bok choy, and a black garlic oil we've been working on since August. Both shops starting today.",
    photos: ["ramen", "ramen"],
    reactions: 49,
    comments: [
      {
        by: "diego.morales",
        text: "I've eaten this for staff meal 11 days straight and I regret nothing",
      },
      { by: "chloe.wright", text: "ok this is going on the list for this weekend" },
      {
        by: "fatima.hassan",
        text: "is the spice level adjustable?",
        replies: [
          { by: "kumoramen", text: 'yep! mild, regular, or "Diego\'s level" (not recommended)' },
        ],
      },
    ],
  },
  {
    by: "kumoramen",
    at: daysAgo(2, "17:00"),
    text: "We turn 9 next Friday. $9 bowls all day at both locations. That's it, that's the post.",
    event: "kumo-anniversary",
    reactions: 45,
    mood: "love",
    comments: [
      { by: "kevin.tran", text: "taking a long lunch. my manager doesn't need to know" },
      { by: "emily.chen", text: "Maya Chen you're taking me right" },
    ],
  },
  {
    by: "kumoramen",
    at: daysAgo(1, "11:00"),
    sponsored: true,
    text: "Fog rolling in? Stay in. Kumo delivers to Berkeley, the Mission, Bernal and the Castro, and your first order through our site gets free chashu.",
    photos: ["ramen"],
    reactions: 18,
  },

  // ── Fogline Outdoor Co. ──────────────────────────────────────────────────
  {
    by: "foglineoutdoor",
    at: daysAgo(3, "10:00"),
    sponsored: true,
    text: "The Drizzle Shell is back in 6 new colors. 3-layer waterproof, pit zips, and a hood that actually fits over a climbing helmet. Tested in Karl the Fog and every Sierra storm we could find.",
    link: {
      url: "https://fogline.co/products/drizzle-shell",
      title: "Drizzle Shell 3L Rain Jacket",
      domain: "fogline.co",
      description: "Packable, fully seam-taped, 2-year warranty. Free shipping in California.",
      image: "rain jacket",
    },
    reactions: 22,
    comments: [
      {
        by: "ben.carter",
        text: "biased since I work there but the pit zips are clutch on Yosemite approaches",
      },
    ],
  },
  {
    by: "foglineoutdoor",
    at: daysAgo(8, "10:00"),
    sponsored: true,
    text: "Cold mornings at the trailhead, meet the Ridgeline Puffy. 800-fill down, water-resistant shell, stuffs into its own pocket.",
    link: {
      url: "https://fogline.co/products/ridgeline-puffy",
      title: "Ridgeline Insulated Jacket",
      domain: "fogline.co",
      image: "puffy jacket",
    },
    reactions: 16,
  },
  {
    by: "foglineoutdoor",
    at: daysAgo(1, "09:00"),
    sponsored: true,
    text: "Early holiday sale: 25% off shells, puffies and packs through Sunday. Members get free returns until January.",
    link: {
      url: "https://fogline.co/sale/holiday",
      title: "Holiday Sale: 25% Off Outerwear",
      domain: "fogline.co",
      description: "Shells, insulation, packs and base layers. Ends Sunday.",
      image: "gear store",
    },
    reactions: 31,
    comments: [{ by: "arjun.mehta", text: "Grace Liu the pack you wanted is on sale" }],
  },
  {
    // Not a product page, so its CTA reads "Learn more" (the ad Facebook leads into the Reels shelf with).
    by: "foglineoutdoor",
    at: daysAgo(2, "17:00"),
    sponsored: true,
    text: "Heading into the backcountry this winter? Our free avalanche awareness nights cover reading the Sierra Avalanche Center forecast, beacon basics and what to pack. No experience needed.",
    link: {
      url: "https://fogline.co/clinics/avalanche-awareness",
      title: "Free Avalanche Awareness Nights",
      domain: "fogline.co",
      description: "Thursdays at 7 PM at our SoMa flagship. Reserve a spot online.",
      image: "ski equipment",
    },
    reactions: 12,
  },
  {
    by: "foglineoutdoor",
    at: daysAgo(3, "12:00"),
    text: "The community ski & snowboard swap is this Sunday at our SoMa flagship. Drop off gear Saturday 4 to 7. 15% of sales go to trail maintenance.",
    event: "ski-swap",
    photos: ["ski equipment"],
    reactions: 37,
    comments: [
      {
        by: "luis.hernandez",
        text: "got my first board here 3 years ago for $80. still riding it",
      },
      {
        by: "theo.grant",
        text: "what time does the line start realistically",
        replies: [
          { by: "foglineoutdoor", text: "Theo Grant usually around 8, the good boots go fast!" },
        ],
      },
    ],
  },
];
