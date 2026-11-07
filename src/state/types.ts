export type WidthRule = "fit" | 360 | 768;

export type GroupColor = "red" | "amber" | "green" | "blue" | "violet";

export interface TabGroup {
  id: string;
  name: string;
  color: GroupColor;
  /** A collapsed group is one pill; its tabs are still open and still here. */
  collapsed: boolean;
}

export type InternalPage =
  | "start"
  | "history"
  | "shelf"
  | "sittings"
  | "turbo"
  | "settings"
  | "updates";

export interface Settings {
  /** What the plus button and ⌘T open. */
  newTab: "google" | "start";
  /** Where a search goes. */
  search: "duckduckgo" | "google";
  /** Full micro-motion, or none of it. */
  animations: "full" | "reduced";
}

export interface Tab {
  id: string;
  /** Address currently shown. Internal pages use the scaffold:// scheme. */
  url: string;
  title: string;
  /** The page's own icon, as the engine reported it. Null until one arrives. */
  favicon?: string | null;
  loading: boolean;
  /** Back/forward stack of addresses for this tab. */
  entries: string[];
  pointer: number;
  width: WidthRule;
  /** Bumped to force a web frame remount on reload. */
  reloadKey: number;
  /** The group this tab sits in, if any. Groups never split: members stay adjacent. */
  groupId?: string | null;
}

export interface KeptPage {
  id: string;
  url: string;
  title: string;
  /** The reason it was kept. This is the product. */
  note: string;
  keptAt: number;
}

export interface HistoryEntry {
  id: string;
  url: string;
  title: string;
  visitedAt: number;
}

export interface Note {
  id: string;
  text: string;
  createdAt: number;
}

export interface Sitting {
  id: string;
  name: string;
  createdAt: number;
  /** Group membership travels with the desk, by name. */
  tabs: { url: string; title: string; group?: string | null }[];
}

export interface Reference {
  url: string;
  title: string;
}

export interface ScaffoldState {
  tabs: Tab[];
  groups: TabGroup[];
  activeId: string;
  reference: Reference | null;
  shelf: KeptPage[];
  history: HistoryEntry[];
  sittings: Sitting[];
  /** Turbo notes: one line each, newest first. */
  notes: Note[];
  /** Browser behaviour, the only things worth a preference. */
  settings: Settings;
  /** The shelf bar is dismissed from the bottom of the desk, not emptied. */
  shelfBarOpen: boolean;
  /** Ephemeral one-line confirmation, never persisted. */
  notice: string | null;
}
