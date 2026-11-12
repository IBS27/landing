# Roadmap: build order

The center of Landing is City Profile → neighborhoods → Move-in Crew → Journeys: knowing a place and its people before you land. Build that first, then fill in the rest of the find → move in → live → move out loop.

Pick tasks from the earliest wave that still has open, unblocked issues. Within a wave, tasks can run in parallel as long as their "Depends on" issues are closed.

## Wave 1: Foundations
Nothing else can start until these exist. GitHub assignees are the source of truth for owners; the table is a snapshot.

| Order | Issue | Owner | Notes |
|---|---|---|---|
| First | #55 Landing app shell: `/landing` routes, layout, navigation and link helpers | sanjeevexe | Every Landing UI issue builds inside it. Keep it small and merge it quickly |
| First | #54 Move the seed world and app from Seattle to San Francisco | IBS27 | In progress. #15's seed work builds on it |
| First | #7 Citations: shared sources model and UI | IBS27 | Post the `source` type in a plan comment before building: #6 and #8 use it |
| Parallel | #8 AI foundation: model calls from Convex actions | IBS27 | Sends model output into #6's proposals |
| Parallel | #3 City Profile data model and onboarding brief | sanjeevexe | Starts after #55. Post the fact and interest types early: most of Wave 2 reads them |
| Parallel | #6 Muse approval queue for outgoing drafts | Vaibhav100968 | Backend can start right away; the inbox UI needs #55 |
| Parallel | #11 Verified listings and scam signals | Vaibhav100968 | Shares Messenger chat UI with #6, hence one owner |
| Parallel | #15 Neighborhood data model and San Francisco seed | jw0968 | Schema, DataSF boundaries and point-in-polygon can start now; seed content waits for #54 |

Most of this wave changes `convex/schema.ts`. Post plan comments early so schema changes don't collide.

## Wave 2: Find a place
- #56 Landing map: shared SF map whose pins link to Groups, Events and listings
- #10 Apartment search tuned to the City Profile
- #12 Network vouching on listings
- #4 Learn from activity: RSVPs, joins, likes, skips and pins
- #16 Neighborhood page: Groups, Events, crew and interest matches
- #17 Neighborhood scores with sources
- #18 Weekend Route from local Group threads (Ember and Spark)

## Wave 3: The flagship flow
- #19 "Try the neighborhood": compare two neighborhoods
- #30 Move-in Crew matching → #31 Crew Group, intros and first meetup → #32 Journeys: weekly Weekend Route and crew overlap
- #21 Opt-in lifestyle questionnaire → #22 Roommate candidates from the user's network → #23 Roommate compatibility score
- #25 Room scan and style vibe → #37 3D room model with item placement

## Wave 4: Complete the loop
- #33 Weekly check-ins and levels
- #34 Turn crew chat into real plans
- #5 "What Muse knows about you" page
- #26 Marketplace items that match the room and vibe
- #27 Owned-items inventory → #43 Sell tracked items at move-out
- #36 Marketplace negotiation via Muse → #44 Negotiate move-out sales
- #45 Sublease listing and negotiation
- #38 House Group for roommates → #39 Bill splitting and chore rotation

## Not a priority right now
Don't pick these up until waves 1–4 are done, unless the team decides otherwise.

| Issue | Why it can wait |
|---|---|
| #46–#51 City Map epic (pins, photo tagging, shared pins) | Marked "maybe" in the brief, and it's about memories rather than finding or settling into a place |
| #52 3D memories from video | A research project, not a product feature |
| #49 AI photo cleanup and collages, #50 recaps and vlogs | Polish on top of the City Map, which is already deferred |
| #41 Rent payments | Payments bring regulatory and integration weight with little that's specific to Landing |
| #28 Mover quotes and discounts | Needs real outreach to outside businesses and is hard to make work end to end |
| #40 House dinners and shared shopping runs | Mostly plain Events plus a shared list |
| #13 Unit details: views and noise risk | Nice detail, but it doesn't change whether someone picks a place |
