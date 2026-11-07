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

export interface NativeViewEvent {
  kind: "title" | "loading" | "open" | "url" | "context-keep" | "keep-request" | "hold";
  tabId?: string;
  url?: string;
  title?: string;
  loading?: boolean;
  /** The quoted text of a selection, or a line saying where a clip came from. */
  note?: string;
}

export interface VaultEntry {
  id: string;
  origin: string;
  username: string;
  lastUsed: number | null;
}

/**
 * The contract between the chrome renderer and the Electron shell.
 * Absent in the web preview harness, where pages fall back to a placeholder.
 */
export interface ScaffoldBridge {
  platform: string;
  /** True when the OS keyring backs the vault. False means the weak fallback key. */
  vaultProtected: () => Promise<boolean>;
  syncLayout: (layout: LayoutSync) => void;
  /** Modal overlays must lift the native page views or they cover them. */
  setOverlay: (open: boolean) => void;
  navigate: (tabId: string, url: string) => void;
  /** Chrome's own update button: quit and come back on the pulled build. */
  relaunch: () => void;
  closeTab: (tabId: string) => void;
  viewAction: (tabId: string, action: "back" | "forward" | "reload") => void;
  onViewEvent: (handler: (event: NativeViewEvent) => void) => () => void;
  vault: {
    list: () => Promise<VaultEntry[]>;
    save: (entry: { origin: string; username: string; password: string }) => Promise<void>;
    remove: (id: string) => Promise<void>;
    /** Fills the login for the tab's current origin. Resolves false when nothing matched. */
    fill: (tabId: string) => Promise<boolean>;
  };
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
