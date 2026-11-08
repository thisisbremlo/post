import type { WidthRule } from "../state/types";

export interface ViewRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutSync {
  activeTab: { id: string; url: string; rect: ViewRect } | null;
  reference: { url: string; rect: ViewRect } | null;
}

export type BrowserCommand =
  | "new-tab"
  | "close-tab"
  | "keep"
  | "shelf"
  | "address"
  | "palette"
  | "back"
  | "forward"
  | "reload"
  | "reference";

export interface NativeViewEvent {
  kind:
    | "title"
    | "favicon"
    | "loading"
    | "open"
    | "url"
    | "context-keep"
    | "keep-request"
    | "hold"
    | "download";
  tabId?: string;
  url?: string;
  title?: string;
  loading?: boolean;
  /** The quoted text of a selection, or a line saying where a clip came from. */
  note?: string;
}

export interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  lang: string;
  themeColor: string;
  openGraph: Record<string, string>;
  twitter: Record<string, string>;
  jsonLd: unknown[];
  metas: { key: string; content: string }[];
  links: { rel: string; href: string }[];
}

export interface ChangelogEntry {
  sha: string;
  /** The commit subject: the changelog line as it was written on push. */
  title: string;
  date: string;
}

export interface UpdateNotice {
  sha: string;
  version: string;
  notes: string;
  entries?: ChangelogEntry[];
}

export interface PagePreferences {
  zoom: number;
  doNotTrack: boolean;
}

export interface AdblockState {
  enabled: boolean;
  blocked: number;
  updatedAt: number | null;
  /** Hosts explicitly allowed through the blocker. */
  allow: string[];
  /** Extra filter-list URLs, merged with Ghostery's built-in lists. */
  lists: string[];
  activeHost: string;
  paused: boolean;
  ready: boolean;
  error: string | null;
}

export interface Article {
  title: string;
  url: string;
  text: string;
}

export interface InstallEvent {
  state: "downloading" | "verifying" | "pulling" | "installing" | "building" | "ready" | "failed";
  /** The last useful line of output, or why it stopped. */
  line: string;
}

/**
 * The contract between the chrome renderer and the Electron shell.
 * Absent in the web preview harness, where pages fall back to a placeholder.
 */
export interface ScaffoldBridge {
  platform: string;
  /** Pulls, rebuilds and replaces this app from the checkout it was built in. */
  installUpdate: () => Promise<"started" | "manual" | "failed">;
  onInstallEvent: (handler: (event: InstallEvent) => void) => () => void;
  syncLayout: (layout: LayoutSync) => void;
  /** Modal overlays must lift the native page views or they cover them. */
  setOverlay: (open: boolean) => void;
  /** Applies default zoom and Do Not Track to every page view, now and later. */
  setPreferences: (preferences: PagePreferences) => void;
  openDownloads: () => void;
  navigate: (tabId: string, url: string) => void;
  /** Reads the page's own account of itself; null on Post's pages and on failure. */
  readPageMeta: (tabId: string) => Promise<PageMeta | null>;
  /** The readable article, stripped of chrome; "reference" reads the held pane. */
  readArticle: (tabId: string) => Promise<Article | null>;
  getAdblockState: () => Promise<AdblockState>;
  setAdblockEnabled: (enabled: boolean) => Promise<AdblockState>;
  /** Allowlist one host, or put it back under the blocker. */
  setAdblockSite: (host: string, allowed: boolean) => Promise<AdblockState>;
  setAdblockLists: (lists: string[]) => Promise<AdblockState>;
  refreshAdblock: () => Promise<AdblockState>;
  onAdblock: (handler: (state: AdblockState) => void) => () => void;
  /** Chrome's own update button: quit and come back on the pulled build. */
  relaunch: () => void;
  closeTab: (tabId: string) => void;
  viewAction: (tabId: string, action: "back" | "forward" | "reload") => void;
  onViewEvent: (handler: (event: NativeViewEvent) => void) => () => void;
  /** The shell fetches main through the checkout's own remote; null means quiet. */
  onUpdate: (handler: (notice: UpdateNotice | null) => void) => () => void;
  /** Ask main to look again, e.g. when the window comes back to the front. */
  checkUpdates: () => void;
  /** Menu items are the shell's; the chrome owns what they do. */
  onCommand: (handler: (command: BrowserCommand) => void) => () => void;
}

declare global {
  interface Window {
    scaffold?: ScaffoldBridge;
  }
}

export const bridge: ScaffoldBridge | null =
  typeof window !== "undefined" && window.scaffold ? window.scaffold : null;

export const isNative = bridge !== null;

/** Widths double as real viewport sizes in the native shell. */
export function widthPx(rule: WidthRule, available: number): number {
  if (rule === "fit") return available;
  return Math.min(rule, available);
}
