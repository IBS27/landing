/**
 * Friends: the /friends pages plus reusable pieces.
 *
 * - `FriendButton({ userId, name, relation?, variant? })` — Add friend / Cancel request /
 *   Respond / Friends (Unfriend), live when `relation` is omitted.
 * - `UnfriendDialog`, `MutualLine`, `PersonGridCard`, `useFriendActions`.
 */
export { MutualLine, type PersonCard, PersonGridCard } from "./cards";
export { FriendButton, type Relation, UnfriendDialog } from "./FriendButton";
export { FriendListsPage } from "./FriendListsPage";
export { FriendsHome } from "./FriendsHome";
export { AllFriendsPage, FriendRequestsPage, SuggestionsPage } from "./FriendsSubPages";
export { useFriendActions, useRemovedSuggestions } from "./hooks";
export {
  FriendRequestsGlyph,
  FriendsHomeGlyph,
  PersonCheckGlyph,
  PersonPlusGlyph,
  PersonXGlyph,
} from "./icons";
