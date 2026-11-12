/* Shared with the client: keep this module free of server imports. */

/** Facebook's "Report a problem" areas, in its order. */
export const PROBLEM_AREAS = [
  "Accessibility",
  "Account",
  "Ads",
  "Events",
  "Feed",
  "Friends",
  "Gaming",
  "Groups",
  "Login",
  "Marketplace",
  "Memories",
  "Messenger",
  "Notifications",
  "Pages",
  "Photos",
  "Privacy",
  "Profile",
  "Reels",
  "Search",
  "Stories",
  "Video",
  "Other",
] as const;

/** Facebook's reasons for reporting a Marketplace listing. */
export const LISTING_REPORT_REASONS = [
  "Scam",
  "Prohibited item",
  "Nudity or sexual activity",
  "Violence, hate or exploitation",
  "Spam",
  "Wrong category",
  "Intellectual property",
  "Something else",
] as const;
