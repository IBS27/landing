import type { CommentSeed, Handle, PostSeed } from "../../types";

/**
 * Longer comment threads (with replies to replies) appended to a few popular
 * posts near the top of Maya's feed, so post dialogs show Facebook's full
 * three-level threading. Matched by author and the start of the post text.
 * `after` on a top-level comment is minutes after the post; on a reply it is
 * minutes after the previous reply.
 */
const THREADS: readonly { by: Handle; text: string; comments: readonly CommentSeed[] }[] = [
  {
    by: "leo.novak",
    text: "what shoes should a total beginner buy?",
    comments: [
      {
        by: "grace.liu",
        after: 78,
        likes: 14,
        text: "La Sportiva Tarantulace. cheap, comfy, resoleable. that's the whole post",
        replies: [
          {
            by: "leo.novak",
            text: "how tight is tight? the guy at REI said to go down 2 sizes",
            replies: [
              {
                by: "grace.liu",
                text: "do NOT go down 2 sizes for your first pair. toes flat, snug, no pain",
                likes: 9,
              },
              { by: "ben.carter", text: "this. painful shoes = you quit in 3 weeks", likes: 4 },
              { by: "leo.novak", text: "ok so REI guy was lying to me" },
            ],
          },
          { by: "arjun.mehta", text: "+1 on the Tarantulace, got 2 years out of mine", likes: 2 },
          {
            by: "tara.singh",
            text: "Scarpa Origin is the same idea if they don't fit your feet",
            replies: [{ by: "grace.liu", text: "true, wider toe box too" }],
          },
        ],
      },
      {
        by: "lena.fischer",
        after: 96,
        likes: 6,
        text: "whatever you buy, get them fitted in the afternoon. feet swell",
        replies: [
          { by: "leo.novak", text: "this is the kind of info nobody tells you" },
          {
            by: "andre.silva",
            text: "also bring the socks you'd wear. or no socks, like a normal climber",
            replies: [
              { by: "lena.fischer", text: "socks in climbing shoes is a war crime" },
              { by: "theo.grant", text: "I climbed in socks for a year and I will not apologize" },
            ],
          },
        ],
      },
      {
        by: "maya.chen",
        after: 120,
        likes: 3,
        text: "also chalk your hands, not the holds. you're welcome",
        replies: [
          {
            by: "kai.nakamura",
            text: "and brush the holds when you're done",
            replies: [{ by: "maya.chen", text: "kai is the gym etiquette police" }],
          },
        ],
      },
      {
        by: "tara.singh",
        after: 141,
        text: "fogline has a used shoe bin by the front desk, ask Ben",
        replies: [
          { by: "ben.carter", text: "it's real. size 42 and up is well stocked", likes: 2 },
          { by: "leo.novak", text: "used climbing shoes... the smell problem remains" },
        ],
      },
      { by: "arjun.mehta", after: 165, text: "this thread is better than any youtube review" },
    ],
  },
  {
    by: "theo.grant",
    text: "free couch on the curb in Elmwood",
    comments: [
      {
        by: "emily.chen",
        after: 80,
        likes: 5,
        text: "noooo I was literally putting my shoes on",
        replies: [
          {
            by: "theo.grant",
            text: "I have a matching armchair if that helps",
            replies: [
              { by: "emily.chen", text: "it helps. it helps a lot", likes: 3 },
              { by: "sam.rivera", text: "wait I want the armchair" },
              { by: "theo.grant", text: "Emily called it first, those are the rules" },
            ],
          },
          { by: "harper.quinn", text: "Marcus walks among us at a different speed" },
        ],
      },
      {
        by: "marcus.bell",
        after: 95,
        likes: 11,
        text: "in my defense my coworkers wanted to leave early anyway",
        replies: [
          {
            by: "jordan.kim",
            text: "how did 3 people and a loveseat fit in an SUV",
            replies: [
              { by: "marcus.bell", text: "physics is a suggestion" },
              { by: "will.foster", text: "this is how backs get thrown out", likes: 2 },
            ],
          },
          { by: "priya.raman", text: "photos of it in the new place or it didn't happen" },
        ],
      },
      {
        by: "sophie.dubois",
        after: 120,
        text: "pro tip: put a tarp on curb furniture when it's this rainy, people move faster when it's dry",
        replies: [{ by: "theo.grant", text: "noted for the armchair" }],
      },
      { by: "erin.mcallister", after: 150, text: "this group is undefeated" },
    ],
  },
  {
    by: "theo.grant",
    text: "do any buildings near campus have actual secure bike storage?",
    comments: [
      {
        by: "fatima.hassan",
        after: 52,
        likes: 8,
        text: "Blackwell Hall has a locked cage with a keycard. still not perfect but way better",
        replies: [
          {
            by: "theo.grant",
            text: "is that only for residents or can you rent a spot?",
            replies: [
              { by: "fatima.hassan", text: "residents only, they're strict about it", likes: 1 },
              { by: "samir.khan", text: "the waitlist is also like a semester long" },
            ],
          },
          { by: "lily.anderson", text: "the cage in my old building got broken into twice 🙃" },
        ],
      },
      {
        by: "noah.williams",
        after: 70,
        likes: 5,
        text: "register it with UCPD! they actually recovered my friend's bike from a sweep",
        replies: [
          { by: "theo.grant", text: "did not know that was a thing, filing tonight" },
          {
            by: "jiho.choi",
            text: "also post the serial number on bike index",
            replies: [{ by: "noah.williams", text: "yes, bike index is how they matched it" }],
          },
        ],
      },
      {
        by: "ana.torres",
        after: 88,
        text: "I just keep mine in my room. my roommate hates it but it's alive",
        replies: [{ by: "hannah.lee", text: "as the roommate: it's fine. mostly" }],
      },
      { by: "derek.holloway", after: 101, text: "so sorry Theo, that rack needs a camera" },
    ],
  },
  {
    by: "maya.chen",
    text: "ok friends, putting this out there. looking for a 1br",
    comments: [
      {
        by: "priya.raman",
        after: 52,
        likes: 9,
        text: "my coworker is leaving a studio on Guerrero in july, want me to connect you?",
        replies: [
          {
            by: "maya.chen",
            text: "YES. does it have laundry??",
            replies: [
              {
                by: "priya.raman",
                text: "in the building, not in unit. but it has a dishwasher",
                likes: 2,
              },
              { by: "maya.chen", text: "i can live with that. sending you a dm" },
            ],
          },
          { by: "harper.quinn", text: "competition for my building 👀" },
        ],
      },
      {
        by: "derek.holloway",
        after: 65,
        text: "pro tip, ask about the heating situation in old Mission Victorians before you sign",
        replies: [
          {
            by: "maya.chen",
            text: "radiator vs wall heater, which one do i want",
            replies: [
              {
                by: "derek.holloway",
                text: "radiator every time, those old wall heaters will eat your paycheck",
                likes: 3,
              },
              { by: "ana.torres", text: "radiators 😍 (again)" },
            ],
          },
        ],
      },
    ],
  },
];

/** Extra comment threads for a post seed (empty for most posts). */
export function threadsFor(post: PostSeed): readonly CommentSeed[] {
  const hit = THREADS.find((t) => t.by === post.by && post.text?.startsWith(t.text));
  return hit?.comments ?? [];
}
