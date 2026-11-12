import { daysAgo, hoursAgo } from "../../lib/time";
import type { PostSeed } from "../../types";

/**
 * Group posts. Every post has `in`, and every author/commenter is a member
 * (admin, moderator, or member) of that group.
 */
export const groupPosts: readonly PostSeed[] = [
  // ── UW Housing, Sublets & Roommates ────────────────────────────────────────
  {
    key: "jordan-scam-warning",
    by: "jordan.kim",
    in: "uw-housing",
    at: daysAgo(7, "09:40"),
    text: "PSA because I've removed 6 of these this week: the 'furnished 2BR on Brooklyn Ave for $1,100, owner is out of the country, just wire the deposit and they'll mail you the keys' listing is a SCAM. Same photos have been posted in Portland and Boise groups.\n\nRules of thumb:\n- if you can't see the place in person or on a live video call, walk away\n- nobody legit asks for Zelle, wire, or gift cards before you sign anything\n- reverse image search the photos\n- look up the address on the King County parcel viewer and see who actually owns it\n- if it's way under market for the U District, it's fake. sorry.\n\nIf you already sent money, report it to SPD and call your bank today, not tomorrow. DM me or Amara if you're unsure about a listing. We'll look, no judgment.",
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
            text: "rooms near campus are like $900-1,300 rn, 1BRs $1,600-2,000. a whole 2BR for $1,100 is a fairy tale",
            after: 12,
            likes: 9,
          },
        ],
      },
      {
        by: "emily.chen",
        text: "wait someone messaged me about a room on 47th and asked for $400 to 'hold it' before showing it... is that this",
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
        text: "Speaking as a landlord: I will never ask for money before a showing and an application. WA also caps screening fees at actual cost. If someone's rushing you, that's the tell.",
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
    in: "uw-housing",
    at: daysAgo(6, "21:00"),
    text: "Room available in 3BR in U District, $1,150/mo, June-Aug sublet ☀️\n\nI'm doing a summer research thing in Minneapolis so my room on NE 50th is open June 15 to Aug 31. Furnished (bed, desk, dresser, the world's best blackout curtains). Two chill grad student roommates and one cat named Chai who will judge you. 8 min walk to the Ave, 10 to the light rail. Utilities are ~$60. DM me!",
    listing: "fatima-udistrict-sublet",
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
    in: "uw-housing",
    at: daysAgo(4, "13:05"),
    text: "Leaving for Copenhagen in January so I'm selling basically everything + subletting my room. Couch first! Wallingford pickup. Room listing coming this week, ask me if you want early details",
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
            text: "around $1,050, January through June. posting it soon!",
            after: 15,
          },
        ],
      },
    ],
  },
  {
    by: "leo.novak",
    in: "uw-housing",
    at: daysAgo(6, "21:10"),
    text: "Hi! Just moved from Chicago, working in Fremont. Not a student, hope it's ok to ask here since this group seems to know everything. Which neighborhoods should I look at? Budget ~$1,800 for a 1BR, no car.",
    reactions: 7,
    comments: [
      {
        by: "jordan.kim",
        text: "you're fine! with no car and a Fremont job: Fremont, Wallingford, or Ballard if you bike. U District works too, the 31/32 goes straight to Fremont",
        after: 20,
        likes: 6,
      },
      {
        by: "sophie.dubois",
        text: "Wallingford is quiet and close to Fremont. Ballard is fun but rent keeps creeping up",
        after: 45,
      },
      {
        by: "maya.chen",
        text: "Capitol Hill if you want things open after 10pm lol. it's a 2 bus commute though",
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
        text: "I have a Fremont 2BR opening Jan 1 if you'd do a roommate situation. Posted it in Seattle Apartments",
        after: 130,
      },
    ],
  },
  {
    by: "lily.anderson",
    in: "uw-housing",
    at: hoursAgo(5),
    text: "Anyone know if the Roosevelt Lofts allow cats? website says 'pet friendly' but the leasing office keeps dodging the question 🐱",
    photos: ["apartment building"],
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
    in: "uw-housing",
    at: daysAgo(1, "12:30"),
    text: "Taking over my lease in Capitol Hill, $1,950 1BR, Jan 1\n\nFinished my MS early and got a job in Portland. Summit Ave near Olive, 4th floor, huge windows, dishwasher, laundry in the building. Lease runs through Aug 31. Landlord is fine with a takeover, you just apply normally ($45 screening fee).",
    photos: ["rooms/apartment living room", "rooms/bedroom", "rooms/kitchen"],
    reactions: 11,
    comments: [
      {
        by: "maya.chen",
        text: "omg which building. this is literally my dream street",
        after: 25,
        replies: [
          {
            by: "samir.khan",
            text: "the brick one across from the little park. but Maya it starts Jan 1 lol aren't you here till June",
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
    in: "uw-housing",
    at: daysAgo(9, "10:15"),
    text: "how does the residential parking permit work if your lease doesn't include parking?? I'm getting a ticket every other day on our street",
    reactions: 4,
    mood: "haha",
    comments: [
      {
        by: "jordan.kim",
        text: "apply through SDOT online with your lease + registration showing the address. it's like $95 for 2 years",
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
        text: "Ana has personally funded the city of Seattle this quarter",
        after: 80,
        likes: 9,
      },
    ],
  },
  {
    by: "jiho.choi",
    in: "uw-housing",
    at: daysAgo(12, "19:45"),
    text: "Is it legal for my landlord to come in without notice? He came yesterday to 'check the smoke detector' while I was in class",
    reactions: 5,
    comments: [
      {
        by: "jordan.kim",
        text: "In WA they need to give 2 days notice to enter (1 day to show the unit) unless it's an emergency. A smoke detector check is not an emergency.",
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
    in: "uw-housing",
    at: daysAgo(3, "22:50"),
    text: "landlord raised our rent 14% for next year. on a 3BR with a dishwasher that's been 'on order' since August. love that for us",
    reactions: 26,
    mood: "sad",
    comments: [
      { by: "fatima.hassan", text: "ours went up 9% and I thought that was bad", after: 12 },
      {
        by: "jordan.kim",
        text: "Seattle requires 180 days notice for increases, and if it's 10%+ you might qualify for relocation help if you move out. check the city's page",
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
    in: "uw-housing",
    at: daysAgo(8, "16:00"),
    text: "Looking for a roommate! F, 20, nursing student, clean, quiet on weeknights, very loud during Husky games. Budget ~$1,000, want to be walkable to campus, Jan or Sept 2027 start",
    reactions: 6,
    comments: [
      {
        by: "amara.diallo",
        text: "bump for Lily, she lived on my floor in McMahon and was the best",
        after: 75,
      },
      {
        by: "theo.grant",
        text: "is a guy roommate ok? have a room opening in a 4BR on 52nd",
        after: 180,
      },
    ],
  },
  {
    by: "tyler.jensen",
    in: "uw-housing",
    at: hoursAgo(20),
    text: "Is this listing legit? $975 for a whole 1BR on University Way, 'fully furnished, utilities included.' Guy says he's a doctor working overseas and his lawyer will send me the keys once I wire first + last. the pictures look really nice which is kinda the problem",
    photos: ["rooms/apartment living room", "rooms/bedroom"],
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
        text: "bro $975 for a 1BR on the Ave in 2026",
        after: 35,
      },
      {
        by: "maya.chen",
        text: "reverse searched it, those photos are from an airbnb in Vancouver BC lol",
        after: 60,
        likes: 8,
        replies: [{ by: "tyler.jensen", text: "Maya Chen you're a hero. blocked him", after: 7 }],
      },
      {
        by: "derek.holloway",
        text: "Real units in that building go for about $1,750.",
        after: 140,
      },
    ],
  },
  {
    by: "maya.chen",
    in: "uw-housing",
    at: daysAgo(10, "23:15"),
    text: "when do people usually start looking for June leases on Capitol Hill? graduating in June and I can't tell if I'm way too early or already behind",
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
    in: "uw-housing",
    at: daysAgo(1, "15:40"),
    text: "ISO room Jan to March (winter quarter only), near campus, under $1,000. my current place ends Dec 31 😭",
    reactions: 3,
    comments: [
      {
        by: "priya.raman",
        text: "my room in Wallingford is Jan-June but I might do Jan-March if you're flexible?? DM me",
        after: 20,
      },
    ],
  },
  {
    by: "theo.grant",
    in: "uw-housing",
    at: hoursAgo(2),
    text: "do any buildings near campus have actual secure bike storage? mine got stolen from the rack outside Odegaard yesterday",
    photos: ["empty bike rack"],
    reactions: 2,
    mood: "sad",
    comments: [
      { by: "ethan.park", text: "rip. the Odegaard rack is cursed", after: 15 },
      {
        by: "sophie.dubois",
        text: "u-lock + a cable through the wheel, and keep it inside if you can",
        after: 40,
      },
    ],
  },
  {
    by: "amara.diallo",
    in: "uw-housing",
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
    in: "uw-housing",
    at: daysAgo(2, "17:30"),
    text: "Room in 4BR house in Ravenna, $925/mo + utilities, available Jan 1 (lease through Aug). Housemates are 2 grad students and a very old dog. Big backyard, slow wifi, good dinners.",
    photos: ["rooms/bedroom", "rooms/kitchen", "backyard"],
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

  // ── Seattle Apartments & Rooms for Rent ────────────────────────────────────
  {
    key: "maya-roommate-search",
    by: "maya.chen",
    in: "seattle-apartments",
    at: hoursAgo(14),
    text: "~$1,700, Capitol Hill, June 2027\n\nLooking for a 1BR, or a room with roommates, starting June (graduating from UW, starting a job in Redmond in July). Clean, quiet-ish, I climb a lot so I'm out most evenings. Would love to be near Capitol Hill station for the light rail. Open to studios if they aren't tiny. Please send leads 🙏",
    reactions: 18,
    likedBy: ["leo.novak", "emily.chen"],
    comments: [
      {
        by: "derek.holloway",
        text: "Hi Maya, I've got a couple Cap Hill units on Harvard Ave that usually turn over in the summer, $1,800-1,900. Bit over budget, but water/sewer/garbage are included. Happy to add you to the list.",
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
        text: "following because I'm figuring out the same thing. how is $1,700 a 'room' budget here 😭",
        after: 40,
        replies: [
          {
            by: "maya.chen",
            text: "lol welcome to seattle. rooms are like $1,100-1,300, 1BRs start around $1,650 if you get lucky",
            after: 8,
          },
        ],
      },
      {
        by: "marcus.bell",
        text: "just signed a 1BR on Bellevue Ave for $1,795, took me 3 weeks. tip: go to showings on weekday evenings, way less competition",
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
        text: "maya you could just live in my closet in SLU for free",
        after: 180,
        replies: [
          { by: "maya.chen", text: "kevin your closet has a rowing machine in it", after: 6 },
        ],
      },
    ],
  },
  {
    by: "derek.holloway",
    in: "seattle-apartments",
    at: daysAgo(4, "10:00"),
    text: "$1,850 | Capitol Hill 1BR, available Dec 1\n\nHarvard Ave E, 2nd floor, bay window, hardwood floors, laundry in building, cats OK. Water/sewer/garbage included. Showings Saturday 11-1. Screening fee is actual cost ($43), nothing else up front.",
    listing: "derek-caphill-1br",
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
    in: "seattle-apartments",
    at: daysAgo(9, "09:30"),
    text: "$2,650 | Fremont 2BR/1BA, available Jan 1\n\nTop floor of a fourplex on N 36th, 5 min walk to the Burke-Gilman. Off-street parking spot included, in-unit washer/dryer. Great for roommates.",
    listing: "derek-fremont-2br",
    reactions: 12,
    comments: [
      {
        by: "leo.novak",
        text: "Fremont! my office is 4 blocks away. would you take two people applying together? still finding a roommate",
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
    in: "seattle-apartments",
    at: daysAgo(2, "08:20"),
    text: "median 1BR is apparently $1,900 now. my first place here in 2021 was $1,350 💀",
    share: "ledger-rent-report",
    reactions: 17,
    mood: "sad",
    comments: [
      {
        by: "camila.santos",
        text: "bartending does not pay $1,900 a month energy",
        after: 45,
        likes: 4,
      },
      {
        by: "derek.holloway",
        text: "The part about new SLU supply softening prices is real. I'm seeing a lot more move-in specials.",
        after: 90,
        replies: [
          {
            by: "kevin.tran",
            text: "move-in special = 6 weeks free, rent still $2,400 lol",
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
    in: "seattle-apartments",
    at: daysAgo(5, "19:20"),
    text: "ok newcomer question: what's the deal with listings that say 'utilities ~$150'? is that normal? in Chicago heat was included everywhere",
    reactions: 4,
    comments: [
      {
        by: "jordan.kim",
        text: "lots of older buildings bill back water/sewer/garbage. electric is separate through City Light, usually not bad",
        after: 25,
      },
      {
        by: "will.foster",
        text: "Electric baseboard heat in winter will hurt. Ask what the heat source is.",
        after: 50,
      },
    ],
  },
  {
    by: "marcus.bell",
    in: "seattle-apartments",
    at: daysAgo(11, "20:00"),
    text: "just moved into a Capitol Hill 1BR with literally zero furniture. sleeping on an air mattress, eating on the floor. if you're moving out and need stuff gone, I'll pick up. I have a borrowed SUV this weekend",
    photos: ["empty apartment"],
    reactions: 13,
    mood: "haha",
    comments: [
      {
        by: "will.foster",
        text: "I flip furniture in Ballard. Check the Ballard swap group, I've got a dining table + 4 chairs for $120.",
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
    in: "seattle-apartments",
    at: daysAgo(14, "12:10"),
    text: "$1,395 studio on Boylston (First Hill) but it's above a bar... anyone live near there? I'm at SU nursing so the location is perfect otherwise",
    photos: ["rooms/studio apartment"],
    reactions: 3,
    comments: [
      {
        by: "emily.chen",
        text: "SU person here, that bar is LOUD on fridays",
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
    in: "seattle-apartments",
    at: daysAgo(16, "18:30"),
    text: "moving SLU to Ballard next month, anyone know a reasonable mover for a 1BR? last quote was $900 for 3 hours",
    photos: ["moving boxes"],
    reactions: 2,
    comments: [
      {
        by: "will.foster",
        text: "I do small moves. $70/hr for two guys + truck. DM me.",
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
    in: "seattle-apartments",
    at: daysAgo(3, "23:40"),
    text: "landlord just sent a 'friendly reminder' that my rent goes from $1,720 to $1,960 in March. friendly??? for a 1BR above a dispensary??",
    reactions: 31,
    mood: "sad",
    comments: [
      { by: "marcus.bell", text: "that's a 14% jump, insane", after: 15 },
      {
        by: "jordan.kim",
        text: "if it's 10%+ you may qualify for economic displacement relocation assistance if you move. look it up on the city site",
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
    in: "seattle-apartments",
    at: daysAgo(7, "09:00"),
    text: "mod note: rent + neighborhood in the first line or your post gets removed 🙃",
    bg: "night",
    reactions: 10,
    comments: [
      { by: "derek.holloway", text: "Seconded.", after: 15 },
      {
        by: "leo.novak",
        text: "what if the neighborhood is 'near the Amazon spheres'",
        after: 60,
        replies: [
          {
            by: "will.foster",
            text: "That's South Lake Union and the answer is $2,600",
            after: 12,
            likes: 8,
          },
        ],
      },
    ],
  },
  {
    by: "nora.kowalski",
    in: "seattle-apartments",
    at: daysAgo(1, "11:15"),
    text: "$1,175 | room in 2BR, Greenwood, Jan 1\n\nmy roommate's moving in with her boyfriend so I need a new one! I work at a startup in Fremont, I cook too much, and I have a very large monstera. 15 min to Fremont on the 5.",
    photos: ["rooms/bedroom", "rooms/apartment living room"],
    reactions: 6,
    comments: [
      {
        by: "leo.novak",
        text: "wait Nora is this the place you were telling me about at lunch",
        after: 30,
        replies: [
          {
            by: "nora.kowalski",
            text: "it is 👀 you'd never have to bike up the Fremont hill again",
            after: 10,
          },
        ],
      },
    ],
  },
  {
    by: "emily.chen",
    in: "seattle-apartments",
    at: daysAgo(6, "22:05"),
    text: "seattle u freshman here, what do people actually pay for a room on capitol hill? my mom thinks $800 is normal rent lol",
    reactions: 5,
    mood: "haha",
    comments: [
      {
        by: "maya.chen",
        text: "tell your mom it's 2026 😭 rooms are $1,100+",
        after: 15,
        replies: [
          {
            by: "emily.chen",
            text: "she said 'in san jose that's cheap' and then hung up",
            after: 9,
            likes: 6,
          },
        ],
      },
      { by: "marcus.bell", text: "$800 gets you a parking spot", after: 50 },
    ],
  },
  {
    by: "luis.hernandez",
    in: "seattle-apartments",
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
    in: "seattle-apartments",
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

  // ── Capitol Hill Neighbors ─────────────────────────────────────────────────
  {
    by: "harper.quinn",
    in: "capitol-hill-neighbors",
    at: hoursAgo(9),
    text: "has anyone seen a big orange cat near 12th & Pine?? Biscuit got out this morning. he's very friendly and very dumb",
    photos: ["orange cat"],
    reactions: 22,
    mood: "care",
    comments: [
      { by: "jasmine.ortiz", text: "sharing on the Moonrise story!", after: 20 },
      {
        by: "marco.rossi",
        text: "I think I saw an orange cat under a car on 13th like an hour ago",
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
    in: "capitol-hill-neighbors",
    at: daysAgo(3, "19:05"),
    text: "where's good for a quiet drink on the hill that isn't a club? new here, want somewhere to read on a weeknight",
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
            text: "you're all so nice. chicago lied to me about the seattle freeze",
            after: 20,
            likes: 4,
          },
        ],
      },
    ],
  },
  {
    by: "marcus.bell",
    in: "capitol-hill-neighbors",
    at: daysAgo(8, "07:40"),
    text: "is jackhammering on E Olive at 7am legal?? I work from home fridays and I'm losing my mind",
    photos: ["construction site"],
    reactions: 9,
    mood: "haha",
    comments: [
      {
        by: "jordan.kim",
        text: "construction noise is allowed 7am-10pm on weekdays in Seattle. sorry",
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
    in: "capitol-hill-neighbors",
    at: daysAgo(4, "12:00"),
    text: "Moonrise is collecting warm socks and gloves through Dec 15! drop them at the counter and we'll bring everything to the shelter on Pine. new or gently used, no judgment on sock patterns",
    photos: ["donation box"],
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
    in: "capitol-hill-neighbors",
    at: daysAgo(2, "18:10"),
    text: "Pike/Pine at 5pm. it's November, it's pitch black, and honestly it's beautiful",
    photos: ["rainy street night", "neon sign rain"],
    reactions: 24,
    mood: "love",
    comments: [
      { by: "harper.quinn", text: "the neon on the wet pavement 😮‍💨", after: 30 },
      {
        by: "malik.johnson",
        text: "can we use this for the next show poster",
        after: 75,
      },
    ],
  },
  {
    by: "maya.chen",
    in: "capitol-hill-neighbors",
    at: daysAgo(5, "21:45"),
    text: "future capitol hill resident here (moving in June!). what's one thing you wish you knew before moving to the hill?",
    reactions: 14,
    comments: [
      {
        by: "harper.quinn",
        text: "the 49 is your best friend and also your worst enemy",
        after: 10,
        likes: 6,
      },
      { by: "jasmine.ortiz", text: "never try to park on Broadway on a Friday night", after: 25 },
      {
        by: "jordan.kim",
        text: "Volunteer Park conservatory is $4 and it's the best rainy day spot in the city",
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
    in: "capitol-hill-neighbors",
    at: daysAgo(10, "15:00"),
    text: "Velvet Owl is hiring a weekend door person, $22/hr + tips. message me",
    photos: ["bar interior"],
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
    in: "capitol-hill-neighbors",
    at: daysAgo(6, "17:50"),
    text: "The streetlight at Summit & John has been out for 3 weeks and reported 4 times. If you walk there at night, please also report it on Find It Fix It. Squeaky wheel etc.",
    reactions: 16,
    comments: [{ by: "harper.quinn", text: "done", after: 15 }],
  },
  {
    by: "diego.morales",
    in: "capitol-hill-neighbors",
    at: daysAgo(1, "16:30"),
    text: "Kumo Ramen on the hill is doing late night on Fri/Sat now, till 1am. I run the kitchen, not trying to spam, a lot of you asked",
    photos: ["ramen"],
    reactions: 19,
    comments: [{ by: "malik.johnson", text: "finally somewhere to eat after a show", after: 30 }],
  },

  // ── Free Stuff Seattle ─────────────────────────────────────────────────────
  {
    key: "priya-free-stuff",
    by: "priya.raman",
    in: "free-stuff-seattle",
    at: hoursAgo(19),
    text: "Leaving for Copenhagen in January so I'm giving away my kitchen + plants 🌿 all free, Wallingford pickup:\n\n- a huge trailing pothos, 2 snake plants, a fiddle leaf fig that's a little dramatic\n- rice cooker (works perfectly)\n- 4 mismatched mugs, a stack of plates, a cast iron pan\n- a whole drawer of spices I will never finish\n\nfirst come first served, pickup by Sunday. comment and I'll DM you!",
    photos: ["houseplants", "kitchen shelf", "cast iron pan"],
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
    in: "free-stuff-seattle",
    at: hoursAgo(3),
    text: "free couch on the curb in Wallingford (N 43rd near Burke), come get it before the rain does. gray 3 seater, no rips",
    photos: ["couch on curb"],
    reactions: 5,
    comments: [
      {
        by: "marcus.bell",
        text: "is it still there??",
        after: 6,
        replies: [
          { by: "theo.grant", text: "yes!", after: 4 },
          { by: "marcus.bell", text: "on my way, 20 min", after: 3, likes: 3 },
        ],
      },
      {
        by: "theo.grant",
        text: "GONE. Marcus Bell showed up with an SUV and two coworkers in like 18 minutes",
        after: 55,
        likes: 9,
      },
      { by: "harper.quinn", text: "the speed 😂", after: 70 },
    ],
  },
  {
    by: "jordan.kim",
    in: "free-stuff-seattle",
    at: daysAgo(4, "14:20"),
    text: "ISO moving boxes! moving across Capitol Hill Dec 1, will happily take any size",
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
    in: "free-stuff-seattle",
    at: daysAgo(2, "10:30"),
    text: "free: like 40 hangers, a dorm whiteboard, and a shower caddy. U District porch pickup, first to comment gets it",
    photos: ["hangers", "whiteboard"],
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
    in: "free-stuff-seattle",
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
    in: "free-stuff-seattle",
    at: daysAgo(12, "13:40"),
    text: "ISO a cat carrier for Biscuit's vet visit Friday. his old one was... destroyed. by him.",
    reactions: 6,
    mood: "haha",
    comments: [
      {
        by: "erin.mcallister",
        text: "vet tech here, we have loaner carriers at the clinic in Ballard, message me",
        after: 30,
      },
    ],
  },
  {
    by: "sophie.dubois",
    in: "free-stuff-seattle",
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
    in: "free-stuff-seattle",
    at: daysAgo(7, "20:40"),
    text: "ISO a shower curtain and a bath mat!! my roommate took hers when she moved out. can pick up on First Hill or anywhere near the streetcar",
    reactions: 2,
    comments: [
      {
        by: "hannah.lee",
        text: "we have an extra shower curtain, it has ducks on it",
        after: 30,
      },
      { by: "maddie.collins", text: "I have a bath mat, porch pickup in Greenwood", after: 90 },
    ],
  },
  {
    by: "will.foster",
    in: "free-stuff-seattle",
    at: daysAgo(9, "13:30"),
    text: "Free: about 15 pallets. Good for raised beds or a very ambitious headboard. Ballard, bring a truck.",
    photos: ["wooden pallets"],
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
    in: "free-stuff-seattle",
    at: daysAgo(11, "15:10"),
    text: "free 5ft cat tree, my cats prefer the box it came in. Ballard",
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
    in: "free-stuff-seattle",
    at: daysAgo(2, "16:45"),
    text: "free: ~40 advance reader copies from the bookstore. mostly lit fic + a few thrillers. Fremont porch pickup",
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
    in: "free-stuff-seattle",
    at: daysAgo(15, "11:40"),
    text: "free plant cuttings! pothos + tradescantia, rooted in little jars. First Hill pickup, take as many as you want",
    photos: ["plant cuttings in jars"],
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

  // ── Seattle Climbers ───────────────────────────────────────────────────────
  {
    key: "kai-climbing-meetup",
    by: "kai.nakamura",
    in: "seattle-climbers",
    at: daysAgo(4, "12:00"),
    text: "climbing night at Cascade Boulders! new set in the cave, all levels. quick intro for first timers at 7. loaner shoes for the first 15 people who RSVP so hit going on the event 👟",
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
    in: "seattle-climbers",
    at: daysAgo(4, "20:30"),
    text: "Index on Sunday: rock was dry until about 2, then the classic PNW betrayal. Lower Town Wall had seepage in the usual spots. Parking lot was empty, which tells you everything about November",
    photos: ["granite cliff", "climbing rope"],
    reactions: 16,
    comments: [
      {
        by: "ben.carter",
        text: "isn't the season basically done for Index? or are you a hero",
        after: 40,
        replies: [{ by: "andre.silva", text: "I'm stubborn, not a hero", after: 15, likes: 4 }],
      },
      { by: "sofia.alvarez", text: "you went without me 😤", after: 80 },
    ],
  },
  {
    by: "theo.grant",
    in: "seattle-climbers",
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
    in: "seattle-climbers",
    at: daysAgo(1, "22:30"),
    text: "anyone have beta for the pink V5 in the cave at Cascade? I can do every move except the heel hook, it just will not stick",
    photos: ["bouldering wall"],
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
    in: "seattle-climbers",
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
        text: "crashpad, one season of Leavenworth on it, $90",
        after: 50,
      },
      { by: "grace.liu", text: "ISO women's size 38 aggressive shoes, any condition", after: 90 },
    ],
  },
  {
    by: "arjun.mehta",
    in: "seattle-climbers",
    at: daysAgo(1, "13:00"),
    text: "Leavenworth this weekend? forecast says dry Saturday east of the pass. room for 2 in my car, leaving Seattle 6am",
    photos: ["leavenworth mountains"],
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
        text: "check Stevens Pass conditions first, chains may be required",
        after: 180,
      },
    ],
  },
  {
    by: "tara.singh",
    in: "seattle-climbers",
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
    in: "seattle-climbers",
    at: hoursAgo(4),
    text: "what shoes should a total beginner buy? the rental ones smell like regret",
    photos: ["climbing shoes"],
    reactions: 4,
    mood: "haha",
    comments: [
      {
        by: "ben.carter",
        text: "come by Rainline and we'll fit you. don't buy aggressive shoes first",
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
    in: "seattle-climbers",
    at: daysAgo(14, "19:15"),
    text: "first outdoor V6!!! Leavenworth, 4th session on it, almost cried",
    photos: ["bouldering outdoors", "granite boulder"],
    reactions: 38,
    mood: "love",
    comments: [
      { by: "sofia.alvarez", text: "GRACE!!!", after: 10 },
      { by: "maya.chen", text: "omg the patience on that thing. so proud", after: 30 },
      { by: "kai.nakamura", text: "told you the heel hook would go", after: 60 },
    ],
  },

  // ── PNW Hikers ─────────────────────────────────────────────────────────────
  {
    by: "arjun.mehta",
    in: "pnw-hikers",
    at: daysAgo(4, "19:45"),
    text: "Snow Lake, Sunday. Snow starts around 3,500 ft, packed but icy on the switchbacks, microspikes absolutely needed. Lake partially frozen. Alpental lot was half full by 9. Upper part crosses avalanche terrain so check NWAC before you go.",
    photos: ["snowy lake", "snowy trail"],
    reactions: 33,
    comments: [
      {
        by: "tara.singh",
        text: "great report, thank you for the NWAC reminder",
        after: 30,
      },
      { by: "ben.carter", text: "microspikes are 20% off at Rainline this week fyi", after: 70 },
    ],
  },
  {
    by: "leo.novak",
    in: "pnw-hikers",
    at: daysAgo(1, "10:20"),
    text: "anyone driving to Rattlesnake Ledge or Mt Si this weekend? new to the area, no car, will pay gas + bring snacks",
    reactions: 6,
    comments: [
      {
        by: "maddie.collins",
        text: "doing Rattlesnake Saturday with my dog Pickles, room for 1!",
        after: 30,
        replies: [{ by: "leo.novak", text: "yes please!!", after: 5 }],
      },
      {
        by: "kevin.tran",
        text: "Mt Si Sunday if you want a second one, leaving SLU at 8",
        after: 80,
      },
      {
        by: "maya.chen",
        text: "Leo you're doing more hiking in a month than I've done all quarter",
        after: 200,
      },
    ],
  },
  {
    by: "maddie.collins",
    in: "pnw-hikers",
    at: hoursAgo(11),
    text: "Snoqualmie Pass got 8 inches overnight. If you're heading up: traction tires or chains, check WSDOT before you leave, keep dogs leashed near the plows",
    photos: ["snowy mountain road"],
    reactions: 29,
    mood: "wow",
    comments: [
      { by: "erin.mcallister", text: "Pickles in the snow is all I need", after: 40 },
      { by: "luis.hernandez", text: "ski season!!", after: 90 },
    ],
  },
  {
    by: "tara.singh",
    in: "pnw-hikers",
    at: daysAgo(5, "12:30"),
    text: "Group hike to Rattlesnake Ledge! Easy pace, all welcome, carpools from Capitol Hill and the U District. Bring microspikes in case it's icy up top.",
    event: "rattlesnake-ledge-hike",
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
    in: "pnw-hikers",
    at: daysAgo(4, "18:30"),
    text: "Lake 22 on Saturday: muddy, then icy, then gorgeous. Bridge at the bottom is fine, upper switchbacks were slick so bring spikes. Cell service dies right after the parking lot",
    photos: ["mountain lake", "forest trail", "foggy lake"],
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
            text: "it was 40 degrees and I was SO cold for that photo",
            after: 15,
          },
        ],
      },
    ],
  },
  {
    by: "daniel.reyes",
    in: "pnw-hikers",
    at: daysAgo(7, "15:30"),
    text: "ran Mt Si up and down in 1:52 this morning. trail is wet but no snow below the haystack. headlamp needed by 4:30",
    photos: ["mountain summit view"],
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
    in: "pnw-hikers",
    at: daysAgo(2, "16:00"),
    text: "Discovery Park in the rain today. 3 herons, zero people",
    photos: ["foggy beach", "heron"],
    reactions: 22,
    comments: [
      { by: "theo.grant", text: "the lighthouse loop is so good in the rain", after: 40 },
      { by: "erin.mcallister", text: "heron count is a valid trail metric", after: 90, likes: 4 },
    ],
  },
  {
    by: "kevin.tran",
    in: "pnw-hikers",
    at: daysAgo(2, "21:10"),
    text: "saw Arjun's Snow Lake report. would trail runners + microspikes work or do I need real boots right now?",
    reactions: 3,
    comments: [
      { by: "arjun.mehta", text: "boots. trail runners will be soaked in 10 min", after: 20 },
      { by: "ben.carter", text: "waterproof boots + gaiters and you're golden", after: 55 },
    ],
  },

  // ── UW Class of 2027 ───────────────────────────────────────────────────────
  {
    by: "amara.diallo",
    in: "uw-class-of-2027",
    at: hoursAgo(6),
    text: "212 days until commencement. not that anyone's counting 🎓",
    bg: "purple",
    reactions: 34,
    comments: [
      { by: "maya.chen", text: "I'm counting. I have a widget", after: 20, likes: 6 },
      {
        by: "ethan.park",
        text: "212 days to finish capstone, that's plenty right",
        after: 50,
        replies: [{ by: "maya.chen", text: "Ethan Park it is not plenty", after: 5, likes: 8 }],
      },
      { by: "hannah.lee", text: "this post gave me anxiety ty", after: 120 },
    ],
  },
  {
    by: "maya.chen",
    in: "uw-class-of-2027",
    at: daysAgo(2, "23:50"),
    text: "capstone demo is in 3 weeks and our prototype has 4 screens. we are so back (we are not back)",
    photos: ["students laptops library night"],
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
    in: "uw-class-of-2027",
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
    in: "uw-class-of-2027",
    at: daysAgo(8, "11:30"),
    text: "cap and gown orders open in Feb through the UW bookstore. ignore the 'early bird' emails from random sites",
    photos: ["graduation cap and gown"],
    reactions: 19,
    comments: [
      { by: "amara.diallo", text: "yes. those are scams, only order through UW", after: 20 },
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
    in: "uw-class-of-2027",
    at: daysAgo(6, "17:00"),
    text: "decorating grad caps for anyone who wants one! $25, any design. comment and I'll add you to the list",
    photos: ["decorated graduation cap"],
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
    in: "uw-class-of-2027",
    at: daysAgo(10, "22:30"),
    text: "how many of you actually have jobs lined up for after graduation? I keep hearing 'everyone has a return offer' and I do not",
    reactions: 30,
    mood: "care",
    comments: [
      {
        by: "daniel.reyes",
        text: "no job yet, applying to Boeing and like 40 other things",
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
    in: "uw-class-of-2027",
    at: daysAgo(1, "19:00"),
    text: "who's staying in seattle for thanksgiving? thinking friendsgiving potluck at our place",
    photos: ["thanksgiving table"],
    reactions: 13,
    comments: [
      { by: "hannah.lee", text: "WE are hosting apparently", after: 30 },
      { by: "maya.chen", text: "I'm making the dumplings 🥟", after: 45, likes: 5 },
      { by: "daniel.reyes", text: "staying! I can bring pie", after: 90 },
    ],
  },

  // ── Seattle Tech Interns & New Grads ───────────────────────────────────────
  {
    by: "rohan.iyer",
    in: "seattle-tech-new-grads",
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
    in: "seattle-tech-new-grads",
    at: daysAgo(5, "15:10"),
    text: "Microsoft July 2027 new grads, where are you?? would love a cohort group chat before we all show up confused on day 1",
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
    in: "seattle-tech-new-grads",
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
    in: "seattle-tech-new-grads",
    at: daysAgo(7, "18:00"),
    text: "for anyone interning in Seattle next summer: I put together everything I learned finding intern housing (sublet timing, which buildings do 3 month leases, scams to avoid). add to it!",
    link: {
      url: "https://docs.example.com/seattle-intern-housing-2027",
      title: "Seattle Intern Housing Guide 2027 (crowdsourced)",
      domain: "docs.example.com",
      description: "Sublet timelines, short-term leases, neighborhoods by commute, and red flags.",
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
    in: "seattle-tech-new-grads",
    at: daysAgo(4, "22:10"),
    text: "still waiting on my return offer decision but got a new grad offer from a startup in SLU. base is lower, equity is 'significant'. how do you even evaluate that",
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
    in: "seattle-tech-new-grads",
    at: daysAgo(2, "13:30"),
    text: "~1 year in as an SWE at Microsoft. happy to do resume reviews for new grads this weekend, drop a comment",
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
    in: "seattle-tech-new-grads",
    at: daysAgo(9, "20:30"),
    text: "what do people do on weeknights here that isn't drinking? new to seattle and everyone at my job is a 6am cyclist",
    reactions: 10,
    mood: "haha",
    comments: [
      {
        by: "nora.kowalski",
        text: "Leo I literally invited you to board game night",
        after: 15,
        replies: [{ by: "leo.novak", text: "ok fair. going thursday", after: 5 }],
      },
      { by: "grace.liu", text: "climbing!! Cascade Boulders in Fremont", after: 40 },
    ],
  },
  {
    by: "ryan.oconnor",
    in: "seattle-tech-new-grads",
    at: daysAgo(11, "08:40"),
    text: "new grads: get the full 401k match before anything else. that's the post",
    bg: "ocean",
    reactions: 22,
    comments: [
      { by: "kevin.tran", text: "and the HSA if you have one", after: 30 },
      { by: "noah.williams", text: "what's a 401k (joking) (mostly)", after: 90, likes: 5 },
    ],
  },

  // ── Seattle Board Game Night ───────────────────────────────────────────────
  {
    key: "tasha-game-night-post",
    by: "tasha.okafor",
    in: "seattle-board-game-night",
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
    in: "seattle-board-game-night",
    at: daysAgo(7, "22:40"),
    text: "tonight's crew!! 31 people, 7 tables, one very intense Catan game that ended in a handshake. thank you Moonrise for letting us take over again",
    photos: ["board games table", "friends playing board games", "coffee shop night"],
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
    in: "seattle-board-game-night",
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
    in: "seattle-board-game-night",
    at: daysAgo(5, "20:10"),
    text: "I want to bring Halli Galli to game night, it's very popular in Korea. is it ok if it's loud? there is a bell",
    photos: ["card game"],
    reactions: 11,
    comments: [
      { by: "tasha.okafor", text: "LOUD IS WELCOME", after: 10, likes: 4 },
      { by: "tyler.jensen", text: "Halli Galli is a classic, bring it", after: 25 },
      { by: "sam.rivera", text: "that bell is going to haunt Moonrise", after: 60 },
    ],
  },
  {
    by: "tyler.jensen",
    in: "seattle-board-game-night",
    at: daysAgo(10, "18:30"),
    text: "We have $150 from the tip jar for the group library. What should we buy? Vote in the comments",
    photos: ["board game shelf"],
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

  // ── Seattle Run Club ───────────────────────────────────────────────────────
  {
    by: "daniel.reyes",
    in: "seattle-run-club",
    at: daysAgo(1, "17:00"),
    text: "Saturday 8am from Gas Works. 5k and 10k routes on the Burke-Gilman, rain or shine (it'll be rain). Coffee after, Tasha's bringing the good stuff",
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
    in: "seattle-run-club",
    at: daysAgo(5, "11:20"),
    text: "Saturday recap: 42 runners, 1 rainbow, 0 dry socks. shoutout to everyone tapering for the Seattle Marathon on the 29th 🏃",
    photos: ["group of runners", "rainy trail run"],
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
    in: "seattle-run-club",
    at: daysAgo(8, "21:30"),
    text: "anyone else running the Seattle Marathon on the 29th? first full. tapering is making me insane",
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
    in: "seattle-run-club",
    at: daysAgo(2, "21:00"),
    text: "tuesday track was COLD. who's doing the holiday lights run in december?",
    photos: ["running track night"],
    reactions: 7,
    comments: [
      { by: "theo.grant", text: "me!", after: 15 },
      { by: "maddie.collins", text: "if dogs are allowed, yes", after: 45 },
    ],
  },

  // ── Seattle Foodies ────────────────────────────────────────────────────────
  {
    by: "leo.novak",
    in: "seattle-foodies",
    at: daysAgo(4, "18:00"),
    text: "ok Seattle, I've been here 3 weeks. give me your top teriyaki spot, I'm told this is a whole thing",
    reactions: 14,
    comments: [
      {
        by: "diego.morales",
        text: "teriyaki is a religion here. find a strip mall spot with a faded menu board and a cash discount. that's the one",
        after: 15,
        likes: 9,
      },
      { by: "chloe.wright", text: "chicken teriyaki, extra sauce, gyoza. no notes", after: 30 },
      {
        by: "camila.santos",
        text: "do not leave without trying one at 1am on Broadway",
        after: 110,
      },
    ],
  },
  {
    by: "chloe.wright",
    in: "seattle-foodies",
    at: daysAgo(2, "20:15"),
    text: "Kumo Ramen's new black garlic tonkotsu 🍜 worth the 40 min line in the rain",
    photos: ["ramen bowl", "ramen shop"],
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
      { by: "jessica.huang", text: "flying up in december, adding to the list", after: 130 },
    ],
  },
  {
    by: "fatima.hassan",
    in: "seattle-foodies",
    at: hoursAgo(8),
    text: "best pho for a rainy day? not on the Ave pls, I've tried them all",
    reactions: 6,
    comments: [
      { by: "kevin.tran", text: "little saigon. any of them. you can't miss", after: 25 },
      {
        by: "ryan.oconnor",
        text: "the place near the Beacon Hill station, get the brisket",
        after: 60,
      },
      { by: "camila.santos", text: "pho on a rainy day is literally medicine", after: 140 },
    ],
  },
  {
    by: "diego.morales",
    in: "seattle-foodies",
    at: daysAgo(9, "16:00"),
    text: "unpopular opinion: the best dumplings around here are in the suburbs",
    bg: "sunset",
    reactions: 20,
    comments: [
      { by: "chloe.wright", text: "this is not unpopular this is fact", after: 10 },
      { by: "ryan.oconnor", text: "is this Bellevue slander or praise, I can't tell", after: 40 },
    ],
  },
  {
    by: "marcus.bell",
    in: "seattle-foodies",
    at: daysAgo(6, "19:30"),
    text: "new to Capitol Hill, what's the move for a cheap weeknight dinner? I've been eating cereal for a week",
    photos: ["bowl of cereal"],
    reactions: 10,
    mood: "haha",
    comments: [
      {
        by: "jasmine.ortiz",
        text: "Moonrise does a grilled cheese now. not exactly dinner but it's $8",
        after: 20,
      },
      { by: "diego.morales", text: "Kumo does $12 shoyu ramen on Tuesdays", after: 45 },
      {
        by: "leo.novak",
        text: "marcus, fellow cereal guy, let's go together",
        after: 140,
      },
    ],
  },

  // ── Ballard Marketplace Swap ───────────────────────────────────────────────
  {
    by: "will.foster",
    in: "ballard-marketplace-swap",
    at: daysAgo(2, "10:45"),
    text: "$160: mid-century armchair, reupholstered in mustard wool, walnut legs, rebuilt the springs myself. Pickup near the Locks.",
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
    in: "ballard-marketplace-swap",
    at: daysAgo(5, "17:20"),
    text: "$350: commuter bike, 56cm, new tires and chain, fenders (non-negotiable in Seattle). selling because I got a cargo bike",
    photos: ["commuter bike"],
    reactions: 6,
    comments: [
      { by: "maddie.collins", text: "fenders non-negotiable, correct", after: 30 },
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
    in: "ballard-marketplace-swap",
    at: daysAgo(8, "12:30"),
    text: "$40 each: two 4x4 cube shelves, Ballard near Market St. need them gone by Sunday",
    photos: ["cube bookshelf"],
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
    in: "ballard-marketplace-swap",
    at: daysAgo(1, "08:30"),
    text: "Can anyone recommend a reliable plumber in Ballard? Tenant's kitchen sink backed up for the second time this month.",
    reactions: 3,
    comments: [
      {
        by: "will.foster",
        text: "I can look today. If it's the main line I'll send you to my guy.",
        after: 20,
      },
      {
        by: "erin.mcallister",
        text: "tree roots in the old Ballard sewer lines are no joke",
        after: 90,
      },
    ],
  },

  // ── Seattle Concerts & Shows ───────────────────────────────────────────────
  {
    by: "malik.johnson",
    in: "seattle-concerts",
    at: daysAgo(3, "16:00"),
    text: "Low Tide Radio at The Velvet Owl! new songs, old songs, and one cover you'll pretend not to know. $12 at the door",
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
    in: "seattle-concerts",
    at: daysAgo(1, "14:10"),
    text: "2 tickets to Moth Static at the Showbox, Dec 4, face value ($38 each). can't go, finals 😭",
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
    in: "seattle-concerts",
    at: daysAgo(5, "13:00"),
    text: "the basement show in the CD last night was the best $5 I've ever spent",
    photos: ["concert crowd", "band playing small venue"],
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
    in: "seattle-concerts",
    at: hoursAgo(12),
    text: "anyone want to come to the Neumos show on the 20th? my friend bailed, extra ticket at face",
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

  // ── Mariners Fans ──────────────────────────────────────────────────────────
  {
    by: "jamal.wilson",
    in: "mariners-fans",
    at: daysAgo(2, "21:00"),
    text: "hot stove season, aka I check trade rumors every 20 minutes and pretend I'm not. we NEED a middle of the order bat. somebody talk me down",
    photos: ["baseball stadium"],
    reactions: 19,
    comments: [
      {
        by: "isaiah.thompson",
        text: "pitching wins in this town. let the front office cook",
        after: 20,
      },
      {
        by: "luis.hernandez",
        text: "the front office has been 'cooking' since 2001",
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
    in: "mariners-fans",
    at: daysAgo(6, "12:20"),
    text: "any word on FanFest dates? late January again?",
    reactions: 7,
    comments: [
      { by: "jamal.wilson", text: "should be late Jan, tickets go fast", after: 30 },
      { by: "daniel.reyes", text: "going just for the clubhouse tour again", after: 80 },
    ],
  },
  {
    by: "ryan.oconnor",
    in: "mariners-fans",
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
];
