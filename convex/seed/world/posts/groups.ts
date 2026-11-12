import { daysAgo, hoursAgo } from "../../lib/time";
import type { PostSeed } from "../../types";

/**
 * Group posts. Every post has `in`, and every author/commenter is a member
 * (admin, moderator, or member) of that group.
 */
export const groupPosts: readonly PostSeed[] = [
  // ── Cal Housing, Sublets & Roommates ───────────────────────────────────────
  {
    key: "jordan-scam-warning",
    by: "jordan.kim",
    in: "cal-housing",
    at: daysAgo(7, "09:40"),
    text: "PSA because I've removed 6 of these this week: the 'furnished 2BR on Durant Ave for $1,400, owner is out of the country, just wire the deposit and they'll mail you the keys' listing is a SCAM. Same photos have been posted in LA and San Diego groups.\n\nRules of thumb:\n- if you can't see the place in person or on a live video call, walk away\n- nobody legit asks for Zelle, wire, or gift cards before you sign anything\n- reverse image search the photos\n- look up the address on the Alameda County assessor map and see who actually owns it\n- if it's way under market for Southside, it's fake. sorry.\n\nIf you already sent money, report it to Berkeley PD and call your bank today, not tomorrow. DM me or Amara if you're unsure about a listing. We'll look, no judgment.",
    reactions: 44,
    mood: "wow",
    comments: [
      {
        by: "amara.diallo",
        text: "pinning this. also please stop sending deposits to people named 'Pastor Richard' 😭",
        after: 6,
        likes: 18,
      },
      {
        by: "maya.chen",
        text: "the reverse image search tip saved my friend last spring. the 'loft' was literally a hotel in Lisbon",
        after: 14,
        likes: 7,
        replies: [
          {
            by: "jordan.kim",
            text: "classic. the Lisbon loft has been making the rounds for 2 years lol",
            after: 9,
          },
        ],
      },
      {
        by: "leo.novak",
        text: "ok this is really useful as someone who just moved here. how do I tell what's 'way under market'? everything here looks expensive to me lol",
        after: 31,
        replies: [
          {
            by: "fatima.hassan",
            text: "rooms near campus are like $1,200-1,600 rn, 1BRs $2,300-2,800. a whole 2BR for $1,400 is a fairy tale",
            after: 12,
            likes: 9,
          },
        ],
      },
      {
        by: "emily.chen",
        text: "wait someone messaged me about a room on Fulton and asked for $400 to 'hold it' before showing it... is that this",
        after: 48,
        replies: [
          {
            by: "jordan.kim",
            text: "yes. don't send anything. screenshot the convo and send it to me",
            after: 3,
          },
          {
            by: "maya.chen",
            text: "emily do NOT send them anything. if it's real I'll go look at it with you this weekend",
            after: 7,
            likes: 4,
          },
        ],
      },
      {
        by: "derek.holloway",
        text: "Speaking as a landlord: I will never ask for money before a showing and an application. California also caps screening fees and you're owed a receipt. If someone's rushing you, that's the tell.",
        after: 75,
        likes: 15,
      },
      {
        by: "sophie.dubois",
        text: "this happened to a girl in my department. she lost $1,800. please listen to Jordan",
        after: 102,
      },
      {
        by: "priya.raman",
        text: "adding: if they say they're a missionary or a doctor overseas and their 'agent' will mail you the keys, run",
        after: 190,
        likes: 5,
      },
      {
        by: "hannah.lee",
        text: "the 'owner is out of the country' thing is SO common. we almost fell for one sophomore year Maya Chen remember??",
        after: 260,
        replies: [
          {
            by: "maya.chen",
            text: "the one with a piano in every single photo. I still think about that piano",
            after: 18,
            likes: 5,
          },
        ],
      },
    ],
  },
  {
    key: "fatima-sublet-post",
    by: "fatima.hassan",
    in: "cal-housing",
    at: daysAgo(6, "21:00"),
    text: "Room available in 3BR near campus, $1,450/mo, June-Aug sublet ☀️\n\nI'm doing a summer research thing in Minneapolis so my room on Channing near Ellsworth is open June 15 to Aug 31. Furnished (bed, desk, dresser, the world's best blackout curtains). Two chill grad student roommates and one cat named Chai who will judge you. 5 min walk to Telegraph, 10 to Downtown Berkeley BART. Utilities are ~$70. DM me!",
    listing: "fatima-berkeley-sublet",
    reactions: 14,
    comments: [
      {
        by: "lily.anderson",
        text: "is the cat a dealbreaker if I'm mildly allergic",
        after: 25,
        replies: [
          {
            by: "fatima.hassan",
            text: "Chai mostly lives in my roommate's room but honestly... probably yes 😅",
            after: 14,
          },
        ],
      },
      {
        by: "jiho.choi",
        text: "hi! is June 15 flexible? my program ends June 12",
        after: 70,
      },
      { by: "theo.grant", text: "interested, sent you a message", after: 160 },
      {
        by: "jordan.kim",
        text: "verified Fatima is a real human I have met in person lol, this one's legit",
        after: 220,
        likes: 9,
      },
    ],
  },
  {
    by: "priya.raman",
    in: "cal-housing",
    at: daysAgo(4, "13:05"),
    text: "Leaving for Copenhagen in January so I'm selling basically everything + subletting my room. Couch first! Elmwood pickup. Room listing coming this week, ask me if you want early details",
    listing: "priya-couch",
    reactions: 9,
    comments: [
      {
        by: "ana.torres",
        text: "Maya Chen didn't you say your future living room needs a real couch",
        after: 18,
        replies: [
          {
            by: "maya.chen",
            text: "I need it to stay in Priya's apartment until June 😭",
            after: 6,
            likes: 4,
          },
        ],
      },
      {
        by: "samir.khan",
        text: "what are you asking for the room?",
        after: 120,
        replies: [
          {
            by: "priya.raman",
            text: "$1,350, January through June. posting it soon!",
            after: 15,
          },
        ],
      },
    ],
  },
  {
    by: "leo.novak",
    in: "cal-housing",
    at: daysAgo(6, "21:10"),
    text: "Hi! Just moved from Chicago, working in the Haight. Not a student, hope it's ok to ask here since this group seems to know everything. Which neighborhoods should I look at? Budget ~$2,800 for a 1BR, no car.",
    reactions: 7,
    comments: [
      {
        by: "jordan.kim",
        text: "you're fine! with no car and a Haight job: the Haight, Cole Valley, the Inner Sunset, or the Inner Richmond if you bike. the 33 and the 43 get you there from most of those",
        after: 20,
        likes: 6,
      },
      {
        by: "sophie.dubois",
        text: "Inner Sunset is quiet and you can walk through the park to the Haight. Inner Richmond is fun (dim sum!!) but rent keeps creeping up",
        after: 45,
      },
      {
        by: "maya.chen",
        text: "the Mission if you want things open after 10pm lol. the 33 gets you there but it takes forever",
        after: 70,
        replies: [
          {
            by: "leo.novak",
            text: "honestly things being open after 10 is a big deal, chicago spoiled me",
            after: 12,
          },
        ],
      },
      {
        by: "derek.holloway",
        text: "I have a Haight 2BR opening Jan 1 if you'd do a roommate situation. Posted it in SF Apartments",
        after: 130,
      },
    ],
  },
  {
    by: "lily.anderson",
    in: "cal-housing",
    at: hoursAgo(5),
    text: "Anyone know if the Rockridge Lofts allow cats? website says 'pet friendly' but the leasing office keeps dodging the question 🐱",
    photos: ["rooms/apartment building"],
    reactions: 3,
    comments: [
      {
        by: "sophie.dubois",
        text: "my friend has a cat there! $40/mo pet rent + $300 deposit, separate addendum",
        after: 40,
      },
      {
        by: "amara.diallo",
        text: "also ask if they do the pet DNA poop thing, some buildings do now lol",
        after: 95,
        replies: [{ by: "lily.anderson", text: "the WHAT", after: 5, likes: 4 }],
      },
    ],
  },
  {
    by: "samir.khan",
    in: "cal-housing",
    at: daysAgo(1, "12:30"),
    text: "Taking over my lease in the Mission, $2,950 1BR, Jan 1\n\nFinished my MS early and got a job in LA. 18th St near Dolores, 3rd floor, huge bay windows, dishwasher, laundry in the building. Lease runs through Aug 31. Landlord is fine with a takeover, you just apply normally ($45 screening fee).",
    photos: ["rooms/living-room-16.jpg", "rooms/kitchen-23.jpg"],
    reactions: 11,
    comments: [
      {
        by: "maya.chen",
        text: "omg which building. this is literally my dream street",
        after: 25,
        replies: [
          {
            by: "samir.khan",
            text: "the yellow one across from the park. but Maya it starts Jan 1 lol aren't you in Berkeley till June",
            after: 10,
          },
        ],
      },
      {
        by: "leo.novak",
        text: "still available? I'm month to month right now",
        after: 60,
      },
      {
        by: "jordan.kim",
        text: "reminder: get the takeover approval in writing from the landlord, not just from Samir 🙂",
        after: 110,
        likes: 5,
      },
    ],
  },
  {
    by: "ana.torres",
    in: "cal-housing",
    at: daysAgo(9, "10:15"),
    text: "how does the residential parking permit work if your lease doesn't include parking?? I'm getting a ticket every other day on our street",
    reactions: 4,
    mood: "haha",
    comments: [
      {
        by: "jordan.kim",
        text: "apply for the RPP permit on the city's site with your lease + registration showing the address. it's like $65 a year",
        after: 30,
      },
      {
        by: "hannah.lee",
        text: "she's talking about our street btw. the parking enforcement guy knows her by name",
        after: 55,
        likes: 6,
      },
      {
        by: "maya.chen",
        text: "Ana has personally funded the city of Berkeley this semester",
        after: 80,
        likes: 9,
      },
    ],
  },
  {
    by: "jiho.choi",
    in: "cal-housing",
    at: daysAgo(12, "19:45"),
    text: "Is it legal for my landlord to come in without notice? He came yesterday to 'check the smoke detector' while I was in class",
    reactions: 5,
    comments: [
      {
        by: "jordan.kim",
        text: "In CA they need to give 24 hours written notice to enter unless it's an emergency. A smoke detector check is not an emergency.",
        after: 15,
        likes: 8,
      },
      {
        by: "sophie.dubois",
        text: "write down the dates in case it keeps happening",
        after: 95,
      },
    ],
  },
  {
    by: "noah.williams",
    in: "cal-housing",
    at: daysAgo(3, "22:50"),
    text: "landlord raised our rent 14% for next year. on a 3BR with a dishwasher that's been 'on order' since August. love that for us",
    reactions: 26,
    mood: "sad",
    comments: [
      { by: "fatima.hassan", text: "ours went up 9% and I thought that was bad", after: 12 },
      {
        by: "jordan.kim",
        text: "if the building is 15+ years old the state cap is 5% + inflation, max 10%, so 14% is probably illegal. and if it's pre-1980 Berkeley rent control is way stricter. call the Rent Board",
        after: 30,
        likes: 11,
      },
      {
        by: "derek.holloway",
        text: "Not defending it, but property taxes and insurance went up a lot this year. 14% is still steep though.",
        after: 90,
        replies: [
          { by: "noah.williams", text: "derek why are you here lol", after: 8, likes: 7 },
          {
            by: "derek.holloway",
            text: "I'm in every housing group. it's my natural habitat",
            after: 5,
            likes: 14,
          },
        ],
      },
    ],
  },
  {
    by: "lily.anderson",
    in: "cal-housing",
    at: daysAgo(8, "16:00"),
    text: "Looking for a roommate! F, 20, nursing student, clean, quiet on weeknights, very loud during Cal games. Budget ~$1,300, want to be walkable to campus, Jan or Aug 2027 start",
    reactions: 6,
    comments: [
      {
        by: "amara.diallo",
        text: "bump for Lily, she lived on my floor in Unit 2 and was the best",
        after: 75,
      },
      {
        by: "theo.grant",
        text: "is a guy roommate ok? have a room opening in a 4BR on Dwight",
        after: 180,
      },
    ],
  },
  {
    by: "tyler.jensen",
    in: "cal-housing",
    at: hoursAgo(20),
    text: "Is this listing legit? $1,100 for a whole 1BR on Telegraph, 'fully furnished, utilities included.' Guy says he's a doctor working overseas and his lawyer will send me the keys once I wire first + last. the pictures look really nice which is kinda the problem",
    photos: ["rooms/bedroom"],
    reactions: 8,
    mood: "haha",
    comments: [
      {
        by: "jordan.kim",
        text: "scam. 100%. please read the pinned post 🙏 reporting it",
        after: 12,
        likes: 10,
      },
      {
        by: "ethan.park",
        text: "bro $1,100 for a 1BR on Telegraph in 2026",
        after: 35,
      },
      {
        by: "maya.chen",
        text: "reverse searched it, those photos are from an airbnb in Austin lol",
        after: 60,
        likes: 8,
        replies: [{ by: "tyler.jensen", text: "Maya Chen you're a hero. blocked him", after: 7 }],
      },
      {
        by: "derek.holloway",
        text: "Real units in that building go for about $2,600.",
        after: 140,
      },
    ],
  },
  {
    by: "maya.chen",
    in: "cal-housing",
    at: daysAgo(10, "23:15"),
    text: "when do people usually start looking for June leases in the Mission? graduating this spring and I can't tell if I'm way too early or already behind",
    reactions: 6,
    comments: [
      {
        by: "jordan.kim",
        text: "serious June listings show up March/April. but if a building has a waitlist, get on it now",
        after: 20,
      },
      {
        by: "derek.holloway",
        text: "Most of my June turnovers get listed about 60 days out, so April.",
        after: 65,
      },
      {
        by: "hannah.lee",
        text: "she has a spreadsheet already btw",
        after: 130,
        likes: 6,
        replies: [{ by: "maya.chen", text: "HANNAH", after: 2, likes: 5 }],
      },
    ],
  },
  {
    by: "jiho.choi",
    in: "cal-housing",
    at: daysAgo(1, "15:40"),
    text: "ISO room Jan to May (spring semester only), near campus, under $1,400. my current place ends Dec 31 😭",
    reactions: 3,
    comments: [
      {
        by: "priya.raman",
        text: "my room in Elmwood is Jan-June but I might do Jan-May if you're flexible?? DM me",
        after: 20,
      },
    ],
  },
  {
    by: "theo.grant",
    in: "cal-housing",
    at: hoursAgo(2),
    text: "do any buildings near campus have actual secure bike storage? mine got stolen from the rack outside Moffitt yesterday",
    photos: ["bike rack"],
    reactions: 2,
    mood: "sad",
    comments: [
      { by: "ethan.park", text: "rip. the Moffitt rack is cursed", after: 15 },
      {
        by: "sophie.dubois",
        text: "u-lock + a cable through the wheel, and keep it inside if you can",
        after: 40,
      },
    ],
  },
  {
    by: "amara.diallo",
    in: "cal-housing",
    at: daysAgo(5, "11:00"),
    text: "please put price, dates and neighborhood in your post. we declined 40 posts this week 🫠",
    bg: "berry",
    reactions: 12,
    comments: [
      { by: "jordan.kim", text: "and no, 'DM for price' is not a price", after: 10, likes: 7 },
      { by: "ethan.park", text: "what if the price is a vibe", after: 35, likes: 4 },
    ],
  },
  {
    by: "sophie.dubois",
    in: "cal-housing",
    at: daysAgo(2, "17:30"),
    text: "Room in 4BR house in North Berkeley, $1,200/mo + utilities, available Jan 1 (lease through Aug). Housemates are 2 grad students and a very old dog. Big backyard, slow wifi, good dinners.",
    photos: ["rooms/bedroom", "rooms/kitchen"],
    reactions: 7,
    comments: [
      {
        by: "jiho.choi",
        text: "is it near a bus?",
        after: 30,
      },
      {
        by: "leo.novak",
        text: "how old is the dog",
        after: 75,
        replies: [
          {
            by: "sophie.dubois",
            text: "14. his name is Professor. he does not do much",
            after: 9,
            likes: 6,
          },
        ],
      },
    ],
  },

  // ── SF Apartments & Rooms for Rent ─────────────────────────────────────────
  {
    key: "maya-roommate-search",
    by: "maya.chen",
    in: "sf-apartments",
    at: hoursAgo(14),
    text: "~$2,800, Mission, June 2027\n\nLooking for a 1BR, or a room with roommates, starting June (graduating from Cal, starting at Google in Mountain View in July). Clean, quiet-ish, I climb a lot so I'm out most evenings. Would love to be near 24th St BART or a shuttle stop. Open to studios if they aren't tiny. Please send leads 🙏",
    reactions: 18,
    likedBy: ["leo.novak", "emily.chen"],
    comments: [
      {
        by: "derek.holloway",
        text: "Hi Maya, I've got a couple Mission units on Guerrero that usually turn over in late spring, $3,100-3,300. Bit over budget, but they're rent controlled. Happy to add you to the list.",
        after: 25,
        replies: [
          {
            by: "maya.chen",
            text: "ooh yes please! is it the same building as the one with the bay window you posted?",
            after: 10,
          },
          { by: "derek.holloway", text: "Same building, different floor 👍", after: 15 },
        ],
      },
      {
        by: "leo.novak",
        text: "following because I'm figuring out the same thing. how is $2,800 'a bit under' for a 1BR here 😭",
        after: 40,
        replies: [
          {
            by: "maya.chen",
            text: "lol welcome to SF. rooms are like $1,500-2,000, 1BRs start around $2,900 if you get lucky",
            after: 8,
          },
        ],
      },
      {
        by: "marcus.bell",
        text: "just signed a 1BR on Shotwell for $2,895, took me 3 weeks. tip: go to showings on weekday evenings, way less competition",
        after: 70,
        likes: 5,
      },
      {
        by: "jordan.kim",
        text: "June is a great month to look, lots of turnover. just don't sign anything before you see it in person",
        after: 110,
      },
      {
        by: "kevin.tran",
        text: "maya you could just live in my closet in SoMa for free",
        after: 180,
        replies: [
          { by: "maya.chen", text: "kevin your closet has a rowing machine in it", after: 6 },
        ],
      },
    ],
  },
  {
    by: "derek.holloway",
    in: "sf-apartments",
    at: daysAgo(4, "10:00"),
    text: "$3,250 | Mission 1BR, available Dec 1\n\nGuerrero St near 21st, top floor of an Edwardian, bay windows, hardwood floors, W/D in unit (yes, in the Mission), cats OK. Rent controlled. Showings Saturday afternoon. Screening fee is actual cost ($43), nothing else up front.",
    listing: "derek-mission-1br",
    reactions: 15,
    comments: [
      { by: "marcus.bell", text: "bay window 😩 if I hadn't just signed", after: 40 },
      {
        by: "camila.santos",
        text: "cats ok?? my roommate and I have two",
        after: 80,
      },
      {
        by: "leo.novak",
        text: "would you do a 13 month lease? I'm month to month till Jan",
        after: 240,
      },
    ],
  },
  {
    by: "derek.holloway",
    in: "sf-apartments",
    at: daysAgo(9, "09:30"),
    text: "$4,300 | Haight 2BR/1BA, available Jan 1\n\nVictorian flat on Page near Cole, half a block from the Panhandle. Garage parking spot included (in the Haight, I know), laundry in the building. Great for roommates.",
    listing: "derek-haight-2br",
    reactions: 12,
    comments: [
      {
        by: "leo.novak",
        text: "the Haight! my office is 4 blocks away. would you take two people applying together? still finding a roommate",
        after: 50,
      },
      {
        by: "nora.kowalski",
        text: "Leo someone on the ops team is looking too, Tidewater people unite",
        after: 120,
      },
    ],
  },
  {
    by: "kevin.tran",
    in: "sf-apartments",
    at: daysAgo(2, "08:20"),
    text: "median 1BR is apparently over $3k now. my first place here in 2021 was $2,100 💀",
    share: "ledger-rent-report",
    reactions: 17,
    mood: "sad",
    comments: [
      {
        by: "camila.santos",
        text: "bartending does not pay $3k a month energy",
        after: 45,
        likes: 4,
      },
      {
        by: "derek.holloway",
        text: "The part about new SoMa supply softening prices is real. I'm seeing a lot more move-in specials.",
        after: 90,
        replies: [
          {
            by: "kevin.tran",
            text: "move-in special = 6 weeks free, rent still $3,600 lol",
            after: 14,
            likes: 6,
          },
        ],
      },
      {
        by: "maya.chen",
        text: "this is depressing to read in the middle of an apartment hunt",
        after: 150,
      },
    ],
  },
  {
    by: "leo.novak",
    in: "sf-apartments",
    at: daysAgo(5, "19:20"),
    text: "ok newcomer question: what's the deal with listings that say 'utilities ~$150'? is that normal? in Chicago heat was included everywhere",
    reactions: 4,
    comments: [
      {
        by: "jordan.kim",
        text: "lots of older buildings bill back water/garbage. PG&E is separate and that's the one that gets you",
        after: 25,
      },
      {
        by: "will.foster",
        text: "An old wall heater on PG&E rates will hurt. Ask what the heat source is.",
        after: 50,
      },
    ],
  },
  {
    by: "marcus.bell",
    in: "sf-apartments",
    at: daysAgo(11, "20:00"),
    text: "just moved into a Mission 1BR with literally zero furniture. sleeping on an air mattress, eating on the floor. if you're moving out and need stuff gone, I'll pick up. I have a borrowed SUV this weekend",
    photos: ["empty apartment"],
    reactions: 13,
    mood: "haha",
    comments: [
      {
        by: "will.foster",
        text: "I flip furniture in the Inner Richmond. Check the Richmond swap group, I've got a dining table + 4 chairs for $120.",
        after: 30,
      },
      {
        by: "maya.chen",
        text: "my friend Priya Raman is selling basically her whole apartment before she moves abroad, look her up on marketplace!",
        after: 55,
      },
    ],
  },
  {
    by: "yuki.sato",
    in: "sf-apartments",
    at: daysAgo(14, "12:10"),
    text: "$1,995 studio on Polk (Nob Hill) but it's above a bar... anyone live near there? my USF nursing clinicals are at CPMC so the location is perfect otherwise",
    photos: ["rooms/studio"],
    reactions: 3,
    comments: [
      {
        by: "emily.chen",
        text: "USF person here, that bar is LOUD on fridays",
        after: 35,
      },
      {
        by: "camila.santos",
        text: "if it's the karaoke one, rest in peace to your sleep",
        after: 80,
      },
    ],
  },
  {
    by: "kevin.tran",
    in: "sf-apartments",
    at: daysAgo(16, "18:30"),
    text: "moving SoMa to the Inner Richmond next month, anyone know a reasonable mover for a 1BR? last quote was $1,100 for 3 hours",
    photos: ["moving boxes"],
    reactions: 2,
    comments: [
      {
        by: "will.foster",
        text: "I do small moves. $95/hr for two guys + truck. DM me.",
        after: 20,
      },
      {
        by: "derek.holloway",
        text: "Will's legit, used him for a turnover last month.",
        after: 100,
      },
    ],
  },
  {
    by: "camila.santos",
    in: "sf-apartments",
    at: daysAgo(3, "23:40"),
    text: "landlord just sent a 'friendly reminder' that my rent goes from $2,600 to $2,965 in March. friendly??? for a 1BR above a dispensary??",
    reactions: 31,
    mood: "sad",
    comments: [
      { by: "marcus.bell", text: "that's a 14% jump, insane", after: 15 },
      {
        by: "jordan.kim",
        text: "if your building is pre-1979 that's way over the rent control limit. take the notice to the SF Rent Board, seriously",
        after: 40,
        likes: 9,
      },
      {
        by: "derek.holloway",
        text: "For what it's worth, some of us small landlords try to stay under 5% for good tenants. Sorry Camila.",
        after: 85,
      },
    ],
  },
  {
    by: "will.foster",
    in: "sf-apartments",
    at: daysAgo(7, "09:00"),
    text: "mod note: rent + neighborhood in the first line or your post gets removed 🙃",
    bg: "night",
    reactions: 10,
    comments: [
      { by: "derek.holloway", text: "Seconded.", after: 15 },
      {
        by: "leo.novak",
        text: "what if the neighborhood is 'near Salesforce Tower'",
        after: 60,
        replies: [
          {
            by: "will.foster",
            text: "That's SoMa and the answer is $3,800",
            after: 12,
            likes: 8,
          },
        ],
      },
    ],
  },
  {
    by: "nora.kowalski",
    in: "sf-apartments",
    at: daysAgo(1, "11:15"),
    text: "$1,650 | room in 2BR, Inner Sunset, Jan 1\n\nmy roommate's moving in with her boyfriend so I need a new one! I work at a startup in the Haight, I cook too much, and I have a very large monstera. 15 min to the Haight on the 43, or a nice walk through the park.",
    photos: ["rooms/bedroom-12.jpg", "rooms/living-room-21.jpg"],
    reactions: 6,
    comments: [
      {
        by: "leo.novak",
        text: "wait Nora is this the place you were telling me about at lunch",
        after: 30,
        replies: [
          {
            by: "nora.kowalski",
            text: "it is 👀 you'd never have to bike up Masonic again",
            after: 10,
          },
        ],
      },
    ],
  },
  {
    by: "emily.chen",
    in: "sf-apartments",
    at: daysAgo(6, "22:05"),
    text: "usf freshman here, what do people actually pay for a room in the mission? my mom thinks $1,000 is normal rent lol",
    reactions: 5,
    mood: "haha",
    comments: [
      {
        by: "maya.chen",
        text: "tell your mom it's 2026 😭 rooms are $1,500+",
        after: 15,
        replies: [
          {
            by: "emily.chen",
            text: "she said 'that's what we paid in san jose' and then hung up",
            after: 9,
            likes: 6,
          },
        ],
      },
      { by: "marcus.bell", text: "$1,000 gets you a parking spot", after: 50 },
    ],
  },
  {
    by: "luis.hernandez",
    in: "sf-apartments",
    at: daysAgo(20, "17:30"),
    text: "is it normal for a landlord to want 3x rent in income AND a cosigner? I make like 4x the rent",
    reactions: 3,
    comments: [
      {
        by: "derek.holloway",
        text: "3x is normal. A cosigner on top of 4x is not. Ask them why.",
        after: 45,
      },
      { by: "will.foster", text: "Might be a credit thing. Just ask straight up.", after: 120 },
    ],
  },
  {
    by: "marcus.bell",
    in: "sf-apartments",
    at: daysAgo(4, "21:30"),
    text: "my lease requires renters insurance and I've never had it. what are people paying?",
    reactions: 2,
    comments: [
      {
        by: "kevin.tran",
        text: "like $11/mo through my car insurance, took 5 minutes",
        after: 20,
      },
      { by: "luis.hernandez", text: "same, bundle it with your car", after: 70 },
    ],
  },

  // ── Mission District Neighbors ─────────────────────────────────────────────
  {
    by: "harper.quinn",
    in: "mission-neighbors",
    at: hoursAgo(9),
    text: "has anyone seen a big orange cat near 17th & Guerrero?? Biscuit got out this morning. he's very friendly and very dumb",
    photos: ["orange cat"],
    reactions: 22,
    mood: "care",
    comments: [
      { by: "jasmine.ortiz", text: "sharing on the Moonrise story!", after: 20 },
      {
        by: "marco.rossi",
        text: "I think I saw an orange cat under a car on Albion like an hour ago",
        after: 140,
      },
      {
        by: "harper.quinn",
        text: "UPDATE: BISCUIT IS HOME. he was under that exact car. Marco Rossi you legend",
        after: 260,
        likes: 15,
      },
    ],
  },
  {
    by: "leo.novak",
    in: "mission-neighbors",
    at: daysAgo(3, "19:05"),
    text: "where's good for a quiet drink in the mission that isn't a club? new here, want somewhere to read on a weeknight",
    reactions: 6,
    comments: [
      {
        by: "malik.johnson",
        text: "Velvet Owl on a Tuesday is dead quiet. come say hi, I'm behind the bar",
        after: 15,
      },
      {
        by: "camila.santos",
        text: "can confirm, Tuesdays are just Malik and the jukebox",
        after: 30,
        likes: 6,
      },
      {
        by: "maya.chen",
        text: "Moonrise is open til 9 if you want coffee instead!",
        after: 110,
        replies: [
          {
            by: "leo.novak",
            text: "you're all so nice. chicago told me everyone here would just pitch me their startup",
            after: 20,
            likes: 4,
          },
        ],
      },
    ],
  },
  {
    by: "marcus.bell",
    in: "mission-neighbors",
    at: daysAgo(8, "07:40"),
    text: "is jackhammering on 18th St at 7am legal?? I work from home fridays and I'm losing my mind",
    photos: ["construction"],
    reactions: 9,
    mood: "haha",
    comments: [
      {
        by: "jordan.kim",
        text: "construction noise is allowed 7am-8pm in SF. sorry",
        after: 20,
      },
      {
        by: "harper.quinn",
        text: "it's been 8 months. we are all losing our minds together",
        after: 45,
        likes: 5,
      },
    ],
  },
  {
    by: "tasha.okafor",
    in: "mission-neighbors",
    at: daysAgo(4, "12:00"),
    text: "Moonrise is collecting warm socks and gloves through Dec 15! drop them at the counter and we'll bring everything to the shelter on South Van Ness. new or gently used, no judgment on sock patterns",
    photos: ["donation bin"],
    reactions: 27,
    mood: "love",
    comments: [
      { by: "jasmine.ortiz", text: "I'm on the counter all week, bring socks!", after: 25 },
      { by: "maya.chen", text: "dropping some off before game night 🧦", after: 60 },
      {
        by: "sam.rivera",
        text: "Paper Lantern could do a book drive alongside it if you want to team up?",
        after: 140,
      },
    ],
  },
  {
    by: "marco.rossi",
    in: "mission-neighbors",
    at: daysAgo(2, "18:10"),
    text: "Valencia at 5pm. it's November, it's pitch black, the fog is rolling in, and honestly it's beautiful",
    photos: ["neon sign"],
    reactions: 24,
    mood: "love",
    comments: [
      { by: "harper.quinn", text: "the neon in the fog 😮‍💨", after: 30 },
      {
        by: "malik.johnson",
        text: "can we use this for the next show poster",
        after: 75,
      },
    ],
  },
  {
    by: "maya.chen",
    in: "mission-neighbors",
    at: daysAgo(5, "21:45"),
    text: "future mission resident here (moving in June!). what's one thing you wish you knew before moving to the mission?",
    reactions: 14,
    comments: [
      {
        by: "harper.quinn",
        text: "the 49 is your best friend and also your worst enemy",
        after: 10,
        likes: 6,
      },
      { by: "jasmine.ortiz", text: "never try to park on Valencia on a Friday night", after: 25 },
      {
        by: "jordan.kim",
        text: "it's sunny here when the rest of the city is socked in. microclimates are real, Dolores Park is your backyard",
        after: 40,
        likes: 5,
      },
      {
        by: "tasha.okafor",
        text: "come to board game night and you'll know everyone in 3 weeks",
        after: 90,
        replies: [
          {
            by: "maya.chen",
            text: "I already come!! I just need to live closer",
            after: 5,
          },
        ],
      },
    ],
  },
  {
    by: "malik.johnson",
    in: "mission-neighbors",
    at: daysAgo(10, "15:00"),
    text: "Velvet Owl is hiring a weekend door person, $25/hr + tips. message me",
    photos: ["bar"],
    reactions: 8,
    comments: [
      { by: "camila.santos", text: "it's actually a fun job, the regulars are wild", after: 20 },
      {
        by: "leo.novak",
        text: "do you need experience?",
        after: 60,
        replies: [
          {
            by: "malik.johnson",
            text: "you need to be able to say 'ID please' 300 times a night",
            after: 15,
            likes: 5,
          },
        ],
      },
    ],
  },
  {
    by: "jordan.kim",
    in: "mission-neighbors",
    at: daysAgo(6, "17:50"),
    text: "The streetlight at Florida & 20th has been out for 3 weeks and reported 4 times. If you walk there at night, please also report it on SF311. Squeaky wheel etc.",
    reactions: 16,
    comments: [{ by: "harper.quinn", text: "done", after: 15 }],
  },
  {
    by: "diego.morales",
    in: "mission-neighbors",
    at: daysAgo(1, "16:30"),
    text: "Kumo Ramen on Mission St is doing late night on Fri/Sat now, till 1am. I run the kitchen, not trying to spam, a lot of you asked",
    photos: ["ramen"],
    reactions: 19,
    comments: [{ by: "malik.johnson", text: "finally somewhere to eat after a show", after: 30 }],
  },

  // ── Free Stuff SF ──────────────────────────────────────────────────────────
  {
    key: "priya-free-stuff",
    by: "priya.raman",
    in: "free-stuff-sf",
    at: hoursAgo(19),
    text: "Leaving for Copenhagen in January so I'm giving away my kitchen + plants 🌿 all free, Elmwood pickup:\n\n- a huge trailing pothos, 2 snake plants, a fiddle leaf fig that's a little dramatic\n- rice cooker (works perfectly)\n- 4 mismatched mugs, a stack of plates, a cast iron pan\n- a whole drawer of spices I will never finish\n\nfirst come first served, pickup by Sunday. comment and I'll DM you!",
    photos: ["houseplants", "cast iron"],
    reactions: 23,
    mood: "love",
    comments: [
      {
        by: "yuki.sato",
        text: "the snake plants pls!! can pick up tonight",
        after: 8,
      },
      {
        by: "marcus.bell",
        text: "cast iron + plates if they're still around? I own exactly one fork",
        after: 15,
        replies: [
          {
            by: "priya.raman",
            text: "Marcus are you the air mattress guy? come get the mugs too",
            after: 9,
            likes: 5,
          },
          { by: "marcus.bell", text: "my reputation precedes me", after: 4, likes: 4 },
        ],
      },
      {
        by: "maya.chen",
        text: "Priya the fiddle leaf is not dramatic, it's just sad you're leaving 😭",
        after: 25,
        replies: [{ by: "priya.raman", text: "we're both a little sad Maya", after: 7 }],
      },
      { by: "sophie.dubois", text: "rice cooker if available 🙏", after: 35 },
      {
        by: "priya.raman",
        text: "UPDATE: plants and rice cooker GONE. cast iron, mugs and spices still here",
        after: 400,
        likes: 6,
      },
      {
        by: "sam.rivera",
        text: "picked up the pothos, it's already living in the bookstore window. thank you!!",
        after: 700,
        likes: 3,
      },
    ],
  },
  {
    by: "theo.grant",
    in: "free-stuff-sf",
    at: hoursAgo(3),
    text: "free couch on the curb in Elmwood (Ashby near College). red leather chesterfield, no rips, it just doesn't fit up the stairs at the new place. come get it before the rain does",
    photos: ["listings/sofa-01.jpg"],
    reactions: 5,
    comments: [
      {
        by: "marcus.bell",
        text: "is it still there??",
        after: 6,
        replies: [
          { by: "theo.grant", text: "yes!", after: 4 },
          { by: "marcus.bell", text: "on my way, 30 min", after: 3, likes: 3 },
        ],
      },
      {
        by: "theo.grant",
        text: "GONE. Marcus Bell came over the Bay Bridge with an SUV and two coworkers in like 28 minutes",
        after: 55,
        likes: 9,
      },
      { by: "harper.quinn", text: "the speed 😂", after: 70 },
    ],
  },
  {
    by: "jordan.kim",
    in: "free-stuff-sf",
    at: daysAgo(4, "14:20"),
    text: "ISO moving boxes! moving across the Mission Dec 1, will happily take any size",
    reactions: 4,
    comments: [
      {
        by: "maddie.collins",
        text: "I have like 30 flattened boxes from my classroom, they're yours",
        after: 25,
      },
      {
        by: "sophie.dubois",
        text: "I have 6 wardrobe boxes from my move!",
        after: 60,
      },
    ],
  },
  {
    by: "hannah.lee",
    in: "free-stuff-sf",
    at: daysAgo(2, "10:30"),
    text: "free: like 40 hangers, a dorm whiteboard, and a shower caddy. Southside porch pickup, first to comment gets it",
    reactions: 3,
    comments: [
      {
        by: "emily.chen",
        text: "the whiteboard!! I need it for orgo",
        after: 12,
        replies: [
          {
            by: "hannah.lee",
            text: "yours! come over tonight, Maya will be home",
            after: 8,
          },
        ],
      },
      {
        by: "maya.chen",
        text: "the shower caddy is mine and I'm keeping it actually",
        after: 70,
        likes: 4,
        replies: [{ by: "hannah.lee", text: "MAYA it's been in the closet since 2024", after: 3 }],
      },
    ],
  },
  {
    by: "maddie.collins",
    in: "free-stuff-sf",
    at: daysAgo(6, "08:15"),
    text: "reminder: holds are 24 hours max. if you said 'can pick up tonight' please actually pick up tonight 🙃",
    bg: "peach",
    reactions: 21,
    mood: "haha",
    comments: [
      { by: "yuki.sato", text: "louder for the people in the back", after: 20 },
      {
        by: "harper.quinn",
        text: "the 3 people who ghosted my bookshelf are in this group somewhere",
        after: 50,
        likes: 7,
      },
    ],
  },
  {
    by: "harper.quinn",
    in: "free-stuff-sf",
    at: daysAgo(12, "13:40"),
    text: "ISO a cat carrier for Biscuit's vet visit Friday. his old one was... destroyed. by him.",
    reactions: 6,
    mood: "haha",
    comments: [
      {
        by: "erin.mcallister",
        text: "vet tech here, we have loaner carriers at the clinic on Clement, message me",
        after: 30,
      },
    ],
  },
  {
    by: "sophie.dubois",
    in: "free-stuff-sf",
    at: daysAgo(1, "09:05"),
    text: "free: 2 bags of decaf coffee beans I bought by mistake. I am French. I cannot.",
    bg: "mint",
    reactions: 15,
    mood: "haha",
    comments: [
      { by: "jordan.kim", text: "lmaooo", after: 40 },
      {
        by: "maya.chen",
        text: "my roommate Ana Torres would take these, she's a barista who's 'cutting back'",
        after: 120,
      },
    ],
  },
  {
    by: "emily.chen",
    in: "free-stuff-sf",
    at: daysAgo(7, "20:40"),
    text: "ISO a shower curtain and a bath mat!! my roommate took hers when she moved out. can pick up near USF or anywhere along the 5 Fulton",
    reactions: 2,
    comments: [
      {
        by: "hannah.lee",
        text: "we have an extra shower curtain, it has ducks on it",
        after: 30,
      },
      {
        by: "maddie.collins",
        text: "I have a bath mat, porch pickup in the Inner Sunset",
        after: 90,
      },
    ],
  },
  {
    by: "will.foster",
    in: "free-stuff-sf",
    at: daysAgo(9, "13:30"),
    text: "Free: about 15 pallets. Good for raised beds or a very ambitious headboard. Inner Richmond, bring a truck.",
    photos: ["pallets"],
    reactions: 7,
    comments: [
      {
        by: "theo.grant",
        text: "how ambitious are we talking",
        after: 40,
        replies: [
          { by: "will.foster", text: "Ambitious enough to need a permit.", after: 12, likes: 5 },
        ],
      },
      { by: "maddie.collins", text: "taking 4 for my classroom garden!", after: 100 },
    ],
  },
  {
    by: "erin.mcallister",
    in: "free-stuff-sf",
    at: daysAgo(11, "15:10"),
    text: "free 5ft cat tree, my cats prefer the box it came in. Inner Richmond",
    photos: ["cat tree"],
    reactions: 9,
    mood: "haha",
    comments: [
      {
        by: "harper.quinn",
        text: "BISCUIT NEEDS THIS",
        after: 10,
      },
    ],
  },
  {
    by: "sam.rivera",
    in: "free-stuff-sf",
    at: daysAgo(2, "16:45"),
    text: "free: ~40 advance reader copies from the bookstore. mostly lit fic + a few thrillers. Haight porch pickup",
    photos: ["stack of books"],
    reactions: 18,
    comments: [
      {
        by: "hannah.lee",
        text: "omg any romance?",
        after: 20,
      },
      {
        by: "jordan.kim",
        text: "I'll take anything urban planning adjacent lol",
        after: 55,
        replies: [
          {
            by: "sam.rivera",
            text: "jordan none of them are about zoning, I checked",
            after: 7,
            likes: 6,
          },
        ],
      },
    ],
  },
  {
    by: "yuki.sato",
    in: "free-stuff-sf",
    at: daysAgo(15, "11:40"),
    text: "free plant cuttings! pothos + tradescantia, rooted in little jars. Nob Hill pickup, take as many as you want",
    photos: ["plant cuttings"],
    reactions: 11,
    comments: [
      { by: "hannah.lee", text: "taking 2!! my windowsill is so empty", after: 35 },
      {
        by: "priya.raman",
        text: "this is beautiful but I'm currently trying to get rid of plants 😭",
        after: 80,
        likes: 3,
      },
    ],
  },

  // ── Bay Area Climbers ──────────────────────────────────────────────────────
  {
    key: "kai-climbing-meetup",
    by: "kai.nakamura",
    in: "bay-area-climbers",
    at: daysAgo(4, "12:00"),
    text: "climbing night at Sutro Boulders! new set in the cave, all levels. quick intro for first timers at 7. loaner shoes for the first 15 people who RSVP so hit going on the event 👟",
    event: "climbing-night",
    reactions: 21,
    comments: [
      {
        by: "leo.novak",
        text: "I've climbed like once. is it actually ok to show up as a total beginner",
        after: 20,
        replies: [
          { by: "kai.nakamura", text: "that's literally who it's for. I'll set you up", after: 8 },
          {
            by: "maya.chen",
            text: "Leo come! I'll show you the warmups, the purple V0s are friendly",
            after: 25,
            likes: 3,
          },
        ],
      },
      {
        by: "sofia.alvarez",
        text: "I'M OFF THAT NIGHT. first night off in 3 weeks",
        after: 40,
        replies: [{ by: "maya.chen", text: "SOFIA. finally", after: 3 }],
      },
      {
        by: "lena.fischer",
        text: "PSA from your PT: warm up your fingers. I will be watching",
        after: 95,
        likes: 12,
      },
      {
        by: "theo.grant",
        text: "is the new set soft or are you being evil again",
        after: 150,
        replies: [
          { by: "kai.nakamura", text: "the purple V4 is fine. it's fine.", after: 6, likes: 7 },
        ],
      },
    ],
  },
  {
    by: "andre.silva",
    in: "bay-area-climbers",
    at: daysAgo(4, "20:30"),
    text: "Castle Rock on Sunday: rock was dry until about 2, then the fog rolled up the ridge and everything went greasy. Goat Rock had damp streaks in the usual spots. Parking lot was empty, which tells you everything about November",
    photos: ["granite cliff", "climbing gear"],
    reactions: 16,
    comments: [
      {
        by: "ben.carter",
        text: "isn't it way too damp for Castle Rock this time of year? or are you a hero",
        after: 40,
        replies: [{ by: "andre.silva", text: "I'm stubborn, not a hero", after: 15, likes: 4 }],
      },
      { by: "sofia.alvarez", text: "you went without me 😤", after: 80 },
    ],
  },
  {
    by: "theo.grant",
    in: "bay-area-climbers",
    at: daysAgo(6, "09:50"),
    text: "looking for a climbing partner for weekday mornings! V3-ish boulderer, free before 11 most days",
    reactions: 5,
    comments: [
      {
        by: "sofia.alvarez",
        text: "I work nights so mornings after a shift are perfect for me",
        after: 30,
      },
    ],
  },
  {
    by: "maya.chen",
    in: "bay-area-climbers",
    at: daysAgo(1, "22:30"),
    text: "anyone have beta for the pink V5 in the cave at Sutro? I can do every move except the heel hook, it just will not stick",
    photos: ["bouldering gym"],
    reactions: 12,
    comments: [
      {
        by: "kai.nakamura",
        text: "try a toe hook. the heel is a trap, I set it on purpose",
        after: 15,
        replies: [{ by: "maya.chen", text: "KAI.", after: 2, likes: 6 }],
      },
      {
        by: "arjun.mehta",
        text: "I did it with a drop knee instead, way easier if you're shorter",
        after: 60,
      },
      {
        by: "sofia.alvarez",
        text: "we're doing it together next session, it's going down",
        after: 120,
      },
    ],
  },
  {
    by: "sofia.alvarez",
    in: "bay-area-climbers",
    at: daysAgo(3, "08:00"),
    text: "Weekly gear swap thread 🧗 sell/swap in the comments. Soft goods: include age + use please",
    photos: ["climbing gear"],
    reactions: 8,
    comments: [
      {
        by: "ben.carter",
        text: "selling my 60m rope, 2 seasons, gym only, never caught a big fall. it's on marketplace",
        after: 30,
      },
      {
        by: "kai.nakamura",
        text: "crashpad, one season of Bishop on it, $90",
        after: 50,
      },
      { by: "grace.liu", text: "ISO women's size 38 aggressive shoes, any condition", after: 90 },
    ],
  },
  {
    by: "arjun.mehta",
    in: "bay-area-climbers",
    at: daysAgo(1, "13:00"),
    text: "Bishop this weekend? forecast says dry and cold in the Buttermilks. room for 2 in my car, leaving SF 5am",
    photos: ["bouldering outdoors"],
    reactions: 7,
    comments: [
      {
        by: "maya.chen",
        text: "ugh capstone deadline. next time 😭",
        after: 45,
      },
      { by: "grace.liu", text: "in!", after: 90 },
      {
        by: "tara.singh",
        text: "check Caltrans for chain controls on 50 first, it's already snowing up there",
        after: 180,
      },
    ],
  },
  {
    by: "tara.singh",
    in: "bay-area-climbers",
    at: daysAgo(9, "21:00"),
    text: "my fingertips are see-through. how do you all keep skin this time of year",
    bg: "sky",
    reactions: 9,
    comments: [
      {
        by: "lena.fischer",
        text: "balm at night, sand down the edges, and take a rest day (I know, I know)",
        after: 25,
        likes: 6,
      },
      { by: "kai.nakamura", text: "rest day?? never heard of her", after: 40, likes: 8 },
    ],
  },
  {
    by: "leo.novak",
    in: "bay-area-climbers",
    at: hoursAgo(4),
    text: "what shoes should a total beginner buy? the rental ones smell like regret",
    photos: ["climbing shoes"],
    reactions: 4,
    mood: "haha",
    comments: [
      {
        by: "ben.carter",
        text: "come by Fogline and we'll fit you. don't buy aggressive shoes first",
        after: 20,
      },
      {
        by: "maya.chen",
        text: "something comfy and flat! your toes will thank you",
        after: 50,
      },
      { by: "kai.nakamura", text: "rent for a month first, then buy", after: 70 },
    ],
  },
  {
    by: "grace.liu",
    in: "bay-area-climbers",
    at: daysAgo(14, "19:15"),
    text: "first outdoor V6!!! Bishop, 4th session on it, almost cried",
    photos: ["bouldering outdoors", "bouldering outdoors"],
    reactions: 38,
    mood: "love",
    comments: [
      { by: "sofia.alvarez", text: "GRACE!!!", after: 10 },
      { by: "maya.chen", text: "omg the patience on that thing. so proud", after: 30 },
      { by: "kai.nakamura", text: "told you the heel hook would go", after: 60 },
    ],
  },

  // ── Bay Area Hikers ────────────────────────────────────────────────────────
  {
    by: "arjun.mehta",
    in: "bay-area-hikers",
    at: daysAgo(4, "19:45"),
    text: "Castle Pass + Round Valley, Sunday. Snow from the trailhead, packed but icy on the climb to the pass, microspikes absolutely needed. Frog Lake partially frozen. Castle Peak lot was half full by 9. Anything toward the peak crosses avalanche terrain so check the Sierra Avalanche Center before you go.",
    photos: ["snowy lake", "snowy trail"],
    reactions: 33,
    comments: [
      {
        by: "tara.singh",
        text: "great report, thank you for the avy forecast reminder",
        after: 30,
      },
      { by: "ben.carter", text: "microspikes are 20% off at Fogline this week fyi", after: 70 },
    ],
  },
  {
    by: "leo.novak",
    in: "bay-area-hikers",
    at: daysAgo(1, "10:20"),
    text: "anyone driving to Mount Tam or Tennessee Valley this weekend? new to the area, no car, will pay gas + bring snacks",
    reactions: 6,
    comments: [
      {
        by: "maddie.collins",
        text: "doing Tennessee Valley Saturday, room for 1! Pickles stays home for this one, no dogs on that trail",
        after: 30,
        replies: [{ by: "leo.novak", text: "yes please!!", after: 5 }],
      },
      {
        by: "kevin.tran",
        text: "Mount Tam Sunday if you want a second one, leaving SoMa at 8",
        after: 80,
      },
      {
        by: "maya.chen",
        text: "Leo you're doing more hiking in a month than I've done all semester",
        after: 200,
      },
    ],
  },
  {
    by: "maddie.collins",
    in: "bay-area-hikers",
    at: hoursAgo(11),
    text: "Tahoe got 8 inches overnight. If you're heading up 80: chains in the car, check Caltrans before you leave, keep dogs leashed near the plows",
    photos: ["snowy mountains"],
    reactions: 29,
    mood: "wow",
    comments: [
      { by: "erin.mcallister", text: "Pickles in the snow is all I need", after: 40 },
      { by: "luis.hernandez", text: "ski season!!", after: 90 },
    ],
  },
  {
    by: "tara.singh",
    in: "bay-area-hikers",
    at: daysAgo(5, "12:30"),
    text: "Group hike in Tennessee Valley! Easy pace, all welcome, carpools from the Mission and Berkeley. Bring layers, it's always windier at the beach than you think.",
    event: "tennessee-valley-hike",
    reactions: 20,
    comments: [
      {
        by: "daniel.reyes",
        text: "running it or hiking it?",
        after: 25,
        replies: [{ by: "tara.singh", text: "hiking, Daniel. HIKING.", after: 6, likes: 7 }],
      },
      {
        by: "theo.grant",
        text: "can I bring a friend who's never hiked?",
        after: 70,
      },
    ],
  },
  {
    by: "maya.chen",
    in: "bay-area-hikers",
    at: daysAgo(4, "18:30"),
    text: "Cataract Falls on Saturday: muddy, then slippery, then gorgeous. Falls are finally running after the rain, the stairs near the top were slick so wear real shoes. Cell service dies right after the parking lot",
    photos: ["forest river", "forest trail", "foggy hills"],
    tagged: ["sofia.alvarez"],
    reactions: 26,
    mood: "love",
    comments: [
      { by: "sofia.alvarez", text: "my legs still hate you", after: 20 },
      {
        by: "tara.singh",
        text: "this is the perfect trip report format, framing it",
        after: 60,
      },
      {
        by: "grace.liu",
        text: "the fog in the third one 😮",
        after: 110,
        replies: [
          {
            by: "maya.chen",
            text: "it was 45 degrees and windy and I was SO cold for that photo",
            after: 15,
          },
        ],
      },
    ],
  },
  {
    by: "daniel.reyes",
    in: "bay-area-hikers",
    at: daysAgo(7, "15:30"),
    text: "ran Mount Tam from Mill Valley to East Peak and back in 1:52 this morning. trail is wet, fog sits right on the ridge. headlamp needed by 5",
    photos: ["posts/forest-trail-03.jpg"],
    reactions: 15,
    comments: [
      { by: "luis.hernandez", text: "1:52 is wild", after: 30 },
      {
        by: "kevin.tran",
        text: "I walked it in 4 hours and was proud of myself",
        after: 120,
        likes: 5,
      },
    ],
  },
  {
    by: "sophie.dubois",
    in: "bay-area-hikers",
    at: daysAgo(2, "16:00"),
    text: "Lands End in the fog today. 3 herons, zero people",
    photos: ["beach", "heron"],
    reactions: 22,
    comments: [
      { by: "theo.grant", text: "the labyrinth is so good in the fog", after: 40 },
      { by: "erin.mcallister", text: "heron count is a valid trail metric", after: 90, likes: 4 },
    ],
  },
  {
    by: "kevin.tran",
    in: "bay-area-hikers",
    at: daysAgo(2, "21:10"),
    text: "saw Arjun's Castle Pass report. would trail runners + microspikes work or do I need real boots right now?",
    reactions: 3,
    comments: [
      { by: "arjun.mehta", text: "boots. trail runners will be soaked in 10 min", after: 20 },
      { by: "ben.carter", text: "waterproof boots + gaiters and you're golden", after: 55 },
    ],
  },

  // ── UC Berkeley Class of 2027 ──────────────────────────────────────────────
  {
    by: "amara.diallo",
    in: "cal-class-of-2027",
    at: hoursAgo(6),
    text: "185 days until commencement. not that anyone's counting 🎓",
    bg: "purple",
    reactions: 34,
    comments: [
      { by: "maya.chen", text: "I'm counting. I have a widget", after: 20, likes: 6 },
      {
        by: "ethan.park",
        text: "185 days to finish capstone, that's plenty right",
        after: 50,
        replies: [{ by: "maya.chen", text: "Ethan Park it is not plenty", after: 5, likes: 8 }],
      },
      { by: "hannah.lee", text: "this post gave me anxiety ty", after: 120 },
    ],
  },
  {
    by: "maya.chen",
    in: "cal-class-of-2027",
    at: daysAgo(2, "23:50"),
    text: "capstone demo is in 3 weeks and our prototype has 4 screens. we are so back (we are not back)",
    photos: ["library"],
    tagged: ["ethan.park", "noah.williams", "zoe.nguyen"],
    reactions: 25,
    mood: "haha",
    comments: [
      { by: "zoe.nguyen", text: "it has 5 screens I made one at 2am", after: 10, likes: 5 },
      { by: "ethan.park", text: "we are so back", after: 25 },
      {
        by: "noah.williams",
        text: "who left the sticky notes on our whiteboard I need to know",
        after: 40,
      },
    ],
  },
  {
    by: "olivia.brooks",
    in: "cal-class-of-2027",
    at: daysAgo(5, "14:00"),
    text: "finals schedule just dropped and I have 3 exams on the same Monday. is that even allowed",
    reactions: 11,
    mood: "sad",
    comments: [
      {
        by: "isaiah.thompson",
        text: "you can petition if it's 3+ in one day I think, check the registrar page",
        after: 25,
      },
      {
        by: "mei.tanaka",
        text: "happened to me sophomore year, the prof moved mine without a fight",
        after: 60,
      },
    ],
  },
  {
    by: "isaiah.thompson",
    in: "cal-class-of-2027",
    at: daysAgo(8, "11:30"),
    text: "cap and gown orders open in Feb through the Cal Student Store. ignore the 'early bird' emails from random sites",
    photos: ["berkeley campus"],
    reactions: 19,
    comments: [
      {
        by: "amara.diallo",
        text: "yes. those are scams, only order through the Student Store",
        after: 20,
      },
      {
        by: "chloe.wright",
        text: "wait so the $89 one I already bought...",
        after: 45,
        replies: [{ by: "isaiah.thompson", text: "chloe 💀", after: 4, likes: 9 }],
      },
    ],
  },
  {
    by: "mei.tanaka",
    in: "cal-class-of-2027",
    at: daysAgo(6, "17:00"),
    text: "decorating grad caps for anyone who wants one! $25, any design. comment and I'll add you to the list",
    reactions: 28,
    comments: [
      { by: "zoe.nguyen", text: "me! something with film strips", after: 15 },
      {
        by: "maya.chen",
        text: "I want a tiny climbing wall on mine",
        after: 40,
        replies: [{ by: "mei.tanaka", text: "Maya that's going to be so fun to draw", after: 12 }],
      },
    ],
  },
  {
    by: "noah.williams",
    in: "cal-class-of-2027",
    at: daysAgo(10, "22:30"),
    text: "how many of you actually have jobs lined up for after graduation? I keep hearing 'everyone has a return offer' and I do not",
    reactions: 30,
    mood: "care",
    comments: [
      {
        by: "daniel.reyes",
        text: "no job yet, applying to Tesla and like 40 other things",
        after: 20,
      },
      {
        by: "maya.chen",
        text: "it's not everyone, I promise. happy to look at your resume if you want",
        after: 45,
      },
      {
        by: "amara.diallo",
        text: "the career center does mock interviews every Tuesday fyi",
        after: 150,
      },
    ],
  },
  {
    by: "ana.torres",
    in: "cal-class-of-2027",
    at: daysAgo(1, "19:00"),
    text: "who's staying in berkeley for thanksgiving? thinking friendsgiving potluck at our place",
    photos: ["posts/thanksgiving-table-01.jpg"],
    reactions: 13,
    comments: [
      { by: "hannah.lee", text: "WE are hosting apparently", after: 30 },
      { by: "maya.chen", text: "I'm making the dumplings 🥟", after: 45, likes: 5 },
      { by: "daniel.reyes", text: "staying! I can bring pie", after: 90 },
    ],
  },

  // ── SF Tech Interns & New Grads ────────────────────────────────────────────
  {
    by: "rohan.iyer",
    in: "sf-tech-new-grads",
    at: daysAgo(3, "12:15"),
    text: "New grad + intern mixer is back! Free snacks, zero recruiters, just people who also don't know what half the acronyms in their onboarding doc mean. RSVP on the event so we order enough pizza",
    event: "new-grad-mixer",
    reactions: 32,
    comments: [
      {
        by: "owen.murphy",
        text: "Tidewater's covering the pizza. I promise not to pitch anyone (much)",
        after: 30,
      },
      {
        by: "nina.petrova",
        text: "will there be designers or just SDEs again",
        after: 60,
        replies: [
          { by: "rohan.iyer", text: "designers please come, we're outnumbered", after: 10 },
          { by: "maya.chen", text: "I'm coming!! bringing my design friends", after: 25 },
        ],
      },
      { by: "leo.novak", text: "first one! going", after: 120 },
    ],
  },
  {
    by: "maya.chen",
    in: "sf-tech-new-grads",
    at: daysAgo(5, "15:10"),
    text: "Google July 2027 new grads, where are you?? would love a cohort group chat before we all show up confused on day 1",
    reactions: 24,
    comments: [
      {
        by: "chris.adeyemi",
        text: "Maya you already know where everything is, you're the cohort's tour guide now",
        after: 20,
        likes: 6,
      },
      {
        by: "grace.liu",
        text: "not a new grad but happy to grab coffee and tell you all the stuff nobody tells you",
        after: 50,
        replies: [{ by: "maya.chen", text: "yes please!!", after: 5 }],
      },
      {
        by: "nina.petrova",
        text: "design team happy hour next time you're on campus, I'll add you",
        after: 90,
      },
    ],
  },
  {
    by: "noah.williams",
    in: "sf-tech-new-grads",
    at: daysAgo(1, "21:00"),
    text: "team matching anxiety thread. my call is tomorrow and I've rewritten my 'what are you interested in' answer 9 times",
    reactions: 14,
    mood: "care",
    comments: [
      {
        by: "ryan.oconnor",
        text: "just say what you actually like. they're trying to match you, not test you",
        after: 30,
      },
      {
        by: "rohan.iyer",
        text: "way lower stakes than it feels. you can transfer after a year",
        after: 45,
      },
      { by: "fatima.hassan", text: "rooting for you Noah!!", after: 200 },
    ],
  },
  {
    by: "fatima.hassan",
    in: "sf-tech-new-grads",
    at: daysAgo(7, "18:00"),
    text: "for anyone interning in SF next summer: I put together everything I learned finding intern housing (sublet timing, which buildings do 3 month leases, scams to avoid). add to it!",
    link: {
      url: "https://docs.example.com/sf-intern-housing-2027",
      title: "SF Bay Area Intern Housing Guide 2027 (crowdsourced)",
      domain: "docs.example.com",
      description:
        "Sublet timelines, short-term leases, neighborhoods by BART and Caltrain commute, and red flags.",
    },
    reactions: 41,
    comments: [
      { by: "rohan.iyer", text: "pinning this", after: 15 },
      {
        by: "ethan.park",
        text: "the 'do not sign a 12 month lease for a 12 week internship' section should be in red",
        after: 50,
        replies: [{ by: "fatima.hassan", text: "it IS in red lol", after: 6, likes: 4 }],
      },
    ],
  },
  {
    by: "ethan.park",
    in: "sf-tech-new-grads",
    at: daysAgo(4, "22:10"),
    text: "still waiting on my return offer decision but got a new grad offer from a startup in SoMa. base is lower, equity is 'significant'. how do you even evaluate that",
    reactions: 9,
    comments: [
      {
        by: "owen.murphy",
        text: "Speaking as a founder: ask for the strike price, total shares outstanding, and how long you have to exercise if you leave. If they won't answer, that's your answer.",
        after: 25,
        likes: 11,
      },
      {
        by: "ryan.oconnor",
        text: "value the equity at zero and see if you'd still take it",
        after: 60,
      },
      { by: "rohan.iyer", text: "also ask about runway. politely", after: 100 },
    ],
  },
  {
    by: "marcus.bell",
    in: "sf-tech-new-grads",
    at: daysAgo(2, "13:30"),
    text: "~1 year in as an SWE at Google. happy to do resume reviews for new grads this weekend, drop a comment",
    reactions: 29,
    comments: [
      { by: "fatima.hassan", text: "would love one 🙏", after: 15 },
      { by: "noah.williams", text: "yes please", after: 35 },
      {
        by: "maya.chen",
        text: "also happy to help with design portfolios if anyone needs!",
        after: 70,
        replies: [
          { by: "marcus.bell", text: "teaming up Maya, we're a review service now", after: 12 },
        ],
      },
    ],
  },
  {
    by: "leo.novak",
    in: "sf-tech-new-grads",
    at: daysAgo(9, "20:30"),
    text: "what do people do on weeknights here that isn't drinking? new to SF and everyone at my job is a 6am cyclist",
    reactions: 10,
    mood: "haha",
    comments: [
      {
        by: "nora.kowalski",
        text: "Leo I literally invited you to board game night",
        after: 15,
        replies: [{ by: "leo.novak", text: "ok fair. going thursday", after: 5 }],
      },
      { by: "grace.liu", text: "climbing!! Sutro Boulders in Dogpatch", after: 40 },
    ],
  },
  {
    by: "ryan.oconnor",
    in: "sf-tech-new-grads",
    at: daysAgo(11, "08:40"),
    text: "new grads: get the full 401k match before anything else. that's the post",
    bg: "ocean",
    reactions: 22,
    comments: [
      { by: "kevin.tran", text: "and the HSA if you have one", after: 30 },
      { by: "noah.williams", text: "what's a 401k (joking) (mostly)", after: 90, likes: 5 },
    ],
  },

  // ── SF Board Game Night ────────────────────────────────────────────────────
  {
    key: "tasha-game-night-post",
    by: "tasha.okafor",
    in: "sf-board-game-night",
    at: daysAgo(2, "11:30"),
    text: "Thursday game night at Moonrise, 7pm as always! Wingspan table, a Codenames table for the chaotic, and Tyler is teaching Root for anyone brave. First timers just show up and say hi 🎲",
    event: "board-game-night",
    reactions: 19,
    comments: [
      {
        by: "tyler.jensen",
        text: "Root teach is happening. nobody understands it the first time and that's ok",
        after: 20,
      },
      {
        by: "leo.novak",
        text: "coming again! I still only know Monopoly and Codenames",
        after: 45,
      },
      {
        by: "maya.chen",
        text: "save me a seat at Wingspan pls 🐦",
        after: 70,
      },
      {
        by: "nora.kowalski",
        text: "bringing Owen, he says he's 'not a board game person'",
        after: 110,
        replies: [
          { by: "owen.murphy", text: "I'm not. I'll be there anyway", after: 15, likes: 5 },
        ],
      },
    ],
  },
  {
    by: "tasha.okafor",
    in: "sf-board-game-night",
    at: daysAgo(7, "22:40"),
    text: "tonight's crew!! 31 people, 7 tables, one very intense Catan game that ended in a handshake. thank you Moonrise for letting us take over again",
    photos: ["board games", "coffee shop"],
    reactions: 27,
    mood: "love",
    comments: [
      { by: "theo.grant", text: "the Catan handshake was a peace treaty", after: 15 },
      { by: "ethan.park", text: "I'm still mad about the wheat", after: 30, likes: 3 },
      {
        by: "maya.chen",
        text: "my Wingspan score was a personal best and nobody cared",
        after: 45,
        replies: [{ by: "tyler.jensen", text: "I cared Maya. 94 is huge", after: 10 }],
      },
    ],
  },
  {
    by: "leo.novak",
    in: "sf-board-game-night",
    at: daysAgo(7, "23:15"),
    text: "went to my first game night tonight and everyone was so nice. Jiho destroyed me at Codenames and I respect it",
    reactions: 15,
    comments: [
      { by: "jiho.choi", text: "you were very good for first time!", after: 10 },
      {
        by: "maya.chen",
        text: "Leo you were so close in that last round",
        after: 35,
        replies: [{ by: "leo.novak", text: "Maya I'll get you next week", after: 6 }],
      },
    ],
  },
  {
    by: "jiho.choi",
    in: "sf-board-game-night",
    at: daysAgo(5, "20:10"),
    text: "I want to bring Halli Galli to game night, it's very popular in Korea. is it ok if it's loud? there is a bell",
    photos: ["halli galli"],
    reactions: 11,
    comments: [
      { by: "tasha.okafor", text: "LOUD IS WELCOME", after: 10, likes: 4 },
      { by: "tyler.jensen", text: "Halli Galli is a classic, bring it", after: 25 },
      { by: "sam.rivera", text: "that bell is going to haunt Moonrise", after: 60 },
    ],
  },
  {
    by: "tyler.jensen",
    in: "sf-board-game-night",
    at: daysAgo(10, "18:30"),
    text: "We have $150 from the tip jar for the group library. What should we buy? Vote in the comments",
    photos: ["wingspan"],
    reactions: 8,
    comments: [
      { by: "theo.grant", text: "Cascadia", after: 10 },
      { by: "nora.kowalski", text: "Wavelength!!", after: 25 },
      {
        by: "owen.murphy",
        text: "something under 30 min. the long ones scare the newcomers",
        after: 90,
      },
    ],
  },

  // ── SF Run Club ────────────────────────────────────────────────────────────
  {
    by: "daniel.reyes",
    in: "sf-run-club",
    at: daysAgo(1, "17:00"),
    text: "Saturday 8am from Crissy Field (East Beach). 5k and 10k routes out toward the bridge, fog or shine (it'll be fog). Coffee after, Tasha's bringing the good stuff",
    event: "run-club-saturday",
    reactions: 16,
    comments: [
      { by: "lily.anderson", text: "10k group please be gentle with me", after: 30 },
      {
        by: "leo.novak",
        text: "first run club! what's the slowest pace group",
        after: 70,
        replies: [
          { by: "daniel.reyes", text: "whatever pace you are. we don't drop anyone", after: 10 },
        ],
      },
      {
        by: "tasha.okafor",
        text: "bringing 2 pump pots of Moonrise drip and the good oat milk",
        after: 120,
        likes: 4,
      },
    ],
  },
  {
    by: "tasha.okafor",
    in: "sf-run-club",
    at: daysAgo(5, "11:20"),
    text: "Saturday recap: 42 runners, 1 rogue wave, 0 dry socks. shoutout to everyone tapering for the SF Marathon on the 29th 🏃",
    photos: ["runners", "runners"],
    reactions: 24,
    comments: [
      { by: "luis.hernandez", text: "my socks are still wet", after: 30 },
      {
        by: "maddie.collins",
        text: "Pickles did the 5k and then slept for 6 hours",
        after: 60,
        likes: 5,
      },
      {
        by: "fatima.hassan",
        text: "first 10k with the group!! thank you for waiting at the turns",
        after: 120,
      },
    ],
  },
  {
    by: "luis.hernandez",
    in: "sf-run-club",
    at: daysAgo(8, "21:30"),
    text: "anyone else running the SF Marathon on the 29th? first full. tapering is making me insane",
    photos: ["running shoes"],
    reactions: 13,
    comments: [
      { by: "daniel.reyes", text: "doing the half! see you at the start", after: 20 },
      {
        by: "nora.kowalski",
        text: "I'll be cheering with a sign, tell me what you want it to say",
        after: 60,
        replies: [
          {
            by: "luis.hernandez",
            text: "'luis you're almost done' even if I'm not",
            after: 10,
            likes: 4,
          },
        ],
      },
    ],
  },
  {
    by: "lily.anderson",
    in: "sf-run-club",
    at: daysAgo(2, "21:00"),
    text: "tuesday track was COLD. who's doing the holiday lights run in december?",
    photos: ["running track"],
    reactions: 7,
    comments: [
      { by: "theo.grant", text: "me!", after: 15 },
      { by: "maddie.collins", text: "if dogs are allowed, yes", after: 45 },
    ],
  },

  // ── SF Foodies ─────────────────────────────────────────────────────────────
  {
    by: "leo.novak",
    in: "sf-foodies",
    at: daysAgo(4, "18:00"),
    text: "ok SF, I've been here 3 weeks. give me your top Mission burrito spot, I'm told this is a whole thing",
    reactions: 14,
    comments: [
      {
        by: "diego.morales",
        text: "burritos are a religion here. find a taqueria with a faded menu board, a line out the door and a cash only sign. that's the one",
        after: 15,
        likes: 9,
      },
      {
        by: "chloe.wright",
        text: "carne asada super, extra salsa verde, chips. no notes",
        after: 30,
      },
      {
        by: "camila.santos",
        text: "do not leave without trying one at 1am on Mission St",
        after: 110,
      },
    ],
  },
  {
    by: "chloe.wright",
    in: "sf-foodies",
    at: daysAgo(2, "20:15"),
    text: "Kumo Ramen's new black garlic tonkotsu 🍜 worth the 40 min line in the fog",
    photos: ["ramen", "ramen shop"],
    reactions: 31,
    mood: "love",
    comments: [
      {
        by: "diego.morales",
        text: "the kitchen says thank you 🙏 (it's me, I'm the kitchen)",
        after: 25,
        likes: 8,
      },
      { by: "jasmine.ortiz", text: "the egg in the second pic", after: 50 },
      { by: "jessica.huang", text: "adding this to my december list", after: 130 },
    ],
  },
  {
    by: "fatima.hassan",
    in: "sf-foodies",
    at: hoursAgo(8),
    text: "best pho for a rainy day? not on Telegraph pls, I've tried them all",
    reactions: 6,
    comments: [
      { by: "kevin.tran", text: "little saigon on Larkin. any of them. you can't miss", after: 25 },
      {
        by: "ryan.oconnor",
        text: "the place on Irving in the Sunset, get the brisket",
        after: 60,
      },
      { by: "camila.santos", text: "pho on a rainy day is literally medicine", after: 140 },
    ],
  },
  {
    by: "diego.morales",
    in: "sf-foodies",
    at: daysAgo(9, "16:00"),
    text: "unpopular opinion: the best dumplings around here are in the suburbs",
    bg: "sunset",
    reactions: 20,
    comments: [
      { by: "chloe.wright", text: "this is not unpopular this is fact", after: 10 },
      { by: "ryan.oconnor", text: "is this San Mateo slander or praise, I can't tell", after: 40 },
    ],
  },
  {
    by: "marcus.bell",
    in: "sf-foodies",
    at: daysAgo(6, "19:30"),
    text: "new to the Mission, what's the move for a cheap weeknight dinner? I've been eating cereal for a week",
    photos: ["cereal"],
    reactions: 10,
    mood: "haha",
    comments: [
      {
        by: "jasmine.ortiz",
        text: "Moonrise does a grilled cheese now. not exactly dinner but it's $9",
        after: 20,
      },
      { by: "diego.morales", text: "Kumo does $14 shoyu ramen on Tuesdays", after: 45 },
      {
        by: "leo.novak",
        text: "marcus, fellow cereal guy, let's go together",
        after: 140,
      },
    ],
  },

  // ── Inner Richmond Marketplace Swap ────────────────────────────────────────
  {
    by: "will.foster",
    in: "richmond-marketplace-swap",
    at: daysAgo(2, "10:45"),
    text: "$220: mid-century cane armchair, solid teak, rewove the seat and back myself. Pickup off Clement.",
    listing: "will-armchair",
    reactions: 12,
    comments: [
      {
        by: "marcus.bell",
        text: "still available?? my living room has nothing in it",
        after: 30,
      },
      { by: "erin.mcallister", text: "Will's chairs are the best, I have two", after: 75 },
    ],
  },
  {
    by: "ben.carter",
    in: "richmond-marketplace-swap",
    at: daysAgo(5, "17:20"),
    text: "$350: commuter bike, 56cm, new tires and chain, fenders (non-negotiable in the Richmond, the fog drips). selling because I got a cargo bike",
    photos: ["commuter bike"],
    reactions: 6,
    comments: [
      { by: "marcus.bell", text: "fenders non-negotiable, correct", after: 30 },
      {
        by: "derek.holloway",
        text: "Would you take $300?",
        after: 90,
        replies: [{ by: "ben.carter", text: "$325 and I'll throw in a light", after: 25 }],
      },
    ],
  },
  {
    by: "marco.rossi",
    in: "richmond-marketplace-swap",
    at: daysAgo(8, "12:30"),
    text: "$40 each: two 4x4 cube shelves, Inner Richmond near Clement & 10th. need them gone by Sunday",
    reactions: 4,
    comments: [
      {
        by: "marcus.bell",
        text: "one for me!",
        after: 20,
      },
      { by: "will.foster", text: "These flip for $80. You're too nice.", after: 60 },
    ],
  },
  {
    by: "derek.holloway",
    in: "richmond-marketplace-swap",
    at: daysAgo(1, "08:30"),
    text: "Can anyone recommend a reliable plumber in the Richmond? Tenant's kitchen sink backed up for the second time this month.",
    reactions: 3,
    comments: [
      {
        by: "will.foster",
        text: "I can look today. If it's the main line I'll send you to my guy.",
        after: 20,
      },
      {
        by: "erin.mcallister",
        text: "tree roots in the old Richmond sewer lines are no joke",
        after: 90,
      },
    ],
  },

  // ── SF Concerts & Shows ────────────────────────────────────────────────────
  {
    by: "malik.johnson",
    in: "sf-concerts",
    at: daysAgo(3, "16:00"),
    text: "Low Tide Radio at The Velvet Owl! new songs, old songs, and one cover you'll pretend not to know. $15 at the door",
    event: "low-tide-radio-show",
    reactions: 27,
    comments: [
      {
        by: "camila.santos",
        text: "I'll be the one pouring your drinks, tip me in compliments",
        after: 20,
      },
      { by: "zoe.nguyen", text: "bringing my film camera 📷", after: 50 },
      {
        by: "marco.rossi",
        text: "shooting the show if you're cool with it",
        after: 90,
      },
    ],
  },
  {
    by: "olivia.brooks",
    in: "sf-concerts",
    at: daysAgo(1, "14:10"),
    text: "2 tickets to Moth Static at The Independent, Dec 4, face value ($38 each). can't go, finals 😭",
    reactions: 5,
    comments: [
      { by: "nina.petrova", text: "messaged you!", after: 20 },
      { by: "jasmine.ortiz", text: "if Nina falls through I want them", after: 60 },
      {
        by: "olivia.brooks",
        text: "sold to Nina! face value obviously 🙏",
        after: 140,
      },
    ],
  },
  {
    by: "jasmine.ortiz",
    in: "sf-concerts",
    at: daysAgo(5, "13:00"),
    text: "the warehouse show in West Oakland last night was the best $10 I've ever spent",
    photos: ["concert", "concert"],
    reactions: 18,
    comments: [
      { by: "harper.quinn", text: "the drummer was unreal", after: 30 },
      {
        by: "camila.santos",
        text: "where do you even find out about these",
        after: 70,
        replies: [
          {
            by: "jasmine.ortiz",
            text: "you have to know a guy. I'm the guy now",
            after: 15,
            likes: 6,
          },
        ],
      },
    ],
  },
  {
    by: "zoe.nguyen",
    in: "sf-concerts",
    at: hoursAgo(12),
    text: "anyone want to come to the Bottom of the Hill show on the 20th? my friend bailed, extra ticket at face",
    reactions: 3,
    comments: [
      {
        by: "harper.quinn",
        text: "who's playing?",
        after: 30,
        replies: [
          {
            by: "zoe.nguyen",
            text: "Glass Ferns! dreamy, slow, perfect for crying in a crowd",
            after: 10,
          },
        ],
      },
      { by: "marco.rossi", text: "I'm in if Harper isn't", after: 120 },
    ],
  },

  // ── SF Giants Fans ─────────────────────────────────────────────────────────
  {
    by: "jamal.wilson",
    in: "giants-fans",
    at: daysAgo(2, "21:00"),
    text: "hot stove season, aka I check trade rumors every 20 minutes and pretend I'm not. we NEED a middle of the order bat. somebody talk me down",
    photos: ["baseball stadium"],
    reactions: 19,
    comments: [
      {
        by: "isaiah.thompson",
        text: "pitching wins in this park. let the front office cook",
        after: 20,
      },
      {
        by: "luis.hernandez",
        text: "the front office has been 'cooking' since 2014",
        after: 45,
        likes: 9,
      },
      {
        by: "chris.adeyemi",
        text: "every year I say I won't get my hopes up. every year.",
        after: 160,
      },
    ],
  },
  {
    by: "isaiah.thompson",
    in: "giants-fans",
    at: daysAgo(6, "12:20"),
    text: "any word on FanFest dates? early February again?",
    reactions: 7,
    comments: [
      {
        by: "jamal.wilson",
        text: "should be early Feb, get there before the gates open",
        after: 30,
      },
      { by: "daniel.reyes", text: "going just for the clubhouse tour again", after: 80 },
    ],
  },
  {
    by: "ryan.oconnor",
    in: "giants-fans",
    at: hoursAgo(16),
    text: "that rumor about trading our young catcher for an ace... someone please hide my phone",
    reactions: 12,
    mood: "haha",
    comments: [
      { by: "jamal.wilson", text: "it's a rumor. RUMOR. breathe", after: 40 },
      {
        by: "kevin.tran",
        text: "if they do it I'm buying the new guy's jersey anyway lol",
        after: 100,
      },
      { by: "luis.hernandez", text: "hot stove brain rot is real", after: 300 },
    ],
  },

  // ── Discover-only groups (the main persona isn't a member) ─────────────────
  {
    by: "nora.kowalski",
    in: "sf-dog-owners",
    at: hoursAgo(5),
    text: "Fort Funston is a sand-and-mud situation this week, bring towels. Also whoever's golden kept stealing everyone's tennis balls: legend.",
    photos: ["dog park"],
    reactions: 64,
    mood: "love",
    comments: [
      { by: "sam.rivera", text: "that was Biscuit. he has no regrets", after: 22, likes: 11 },
      {
        by: "lena.fischer",
        text: "Bernal Hill is drier if anyone's looking for an alternative",
        after: 50,
      },
    ],
  },
  {
    by: "owen.murphy",
    in: "sf-dog-owners",
    at: daysAgo(1, "18:10"),
    text: "Any recs for a trainer who does reactive dog classes? Our rescue is a sweetheart until she sees a skateboard.",
    reactions: 21,
    comments: [
      {
        by: "andre.silva",
        text: "we did the reactive rover class in the Mission, worth it",
        after: 35,
      },
    ],
  },
  {
    by: "aisha.rahman",
    in: "sf-coffee-lovers",
    at: hoursAgo(9),
    text: "New roaster opened on Divisadero and their Ethiopia pour-over is ridiculous. Blueberry jam in a cup. Go before the line finds out.",
    photos: ["coffee"],
    reactions: 38,
    comments: [
      { by: "nina.petrova", text: "adding to the list, thank you", after: 18 },
      { by: "will.foster", text: "do they sell beans by the bag?", after: 64 },
    ],
  },
  {
    by: "yuki.sato",
    in: "sf-photography",
    at: hoursAgo(3),
    text: "Last night from Twin Peaks. Waited two hours for the fog to break and got about four minutes of this.",
    photos: ["twin peaks", "sunset"],
    reactions: 142,
    mood: "love",
    comments: [
      { by: "grace.liu", text: "those four minutes were worth it. stunning", after: 12, likes: 6 },
      { by: "erin.mcallister", text: "what lens?", after: 40 },
    ],
  },
  {
    by: "lena.fischer",
    in: "sf-photography",
    at: daysAgo(2, "10:00"),
    text: "December photo walk: Chinatown and North Beach at blue hour, Saturday the 12th, meet at the Dragon Gate at 4pm. Tripods welcome.",
    reactions: 33,
  },
  {
    by: "owen.murphy",
    in: "ferry-commuters",
    at: hoursAgo(2),
    text: "Larkspur 7:50 running about 25 late, vessel swap again. Plan accordingly.",
    photos: ["ferry"],
    reactions: 17,
    mood: "sad",
    comments: [{ by: "erin.mcallister", text: "of course it's the day I have a 9am", after: 8 }],
  },
  {
    by: "jamal.wilson",
    in: "sf-gamers",
    at: hoursAgo(20),
    text: "LAN night at the Mission spot on Friday. 24 seats, bring your own peripherals. Smash bracket at 9.",
    photos: ["gaming setup"],
    reactions: 46,
    comments: [
      { by: "kevin.tran", text: "saving a seat for me pls", after: 15 },
      { by: "samir.khan", text: "is it BYO PC or are there rigs?", after: 33 },
    ],
  },
  {
    by: "marco.rossi",
    in: "ferry-building-regulars",
    at: hoursAgo(7),
    text: "Dungeness crab season is open and the fish counter's prices are actually reasonable this year. Go early, they sold out by 1 last Saturday.",
    photos: ["ferry building"],
    reactions: 58,
    comments: [{ by: "sam.rivera", text: "chowder line was 40 min at noon fyi", after: 25 }],
  },
];
