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

export interface UpdateNotice {
  sha: string;
  version: string;
  notes: string;
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
  /** Opens Google Password Manager: Chrome's own page, or passwords.google.com. */
  openPasswordManager: () => Promise<"chrome" | "web">;
  /** Pulls, rebuilds and replaces this app from the checkout it was built in. */
  installUpdate: () => Promise<"started" | "manual">;
  onInstallEvent: (handler: (event: InstallEvent) => void) => () => void;
  syncLayout: (layout: LayoutSync) => void;
  /** Modal overlays must lift the native page views or they cover them. */
  setOverlay: (open: boolean) => void;
  navigate: (tabId: string, url: string) => void;
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
