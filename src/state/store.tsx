import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import type { Dispatch, ReactNode } from "react";

import { internalPageOf, parseDomain, titleFor } from "../lib/url";
import type {
  GroupColor,
  HistoryEntry,
  Note,
  ScaffoldState,
  Settings,
  Sitting,
  Tab,
  TabGroup,
  WidthRule,
} from "./types";

const STORAGE_KEY = "scaffold.state.v1";
const HISTORY_LIMIT = 400;
const DEFAULT_SETTINGS: Settings = { newTab: "google", search: "duckduckgo", animations: "full" };
/** Blue leads because it is the brand's; red stays readable for groups already filed. */
const GROUP_COLORS: GroupColor[] = ["blue", "green", "amber", "violet"];

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function createTab(url: string, title?: string): Tab {
  return {
    id: uid(),
    url,
    title: title ?? titleFor(url),
    loading: !internalPageOf(url),
    entries: [url],
    pointer: 0,
    width: "fit",
    reloadKey: 0,
    groupId: null,
  };
}

function nextGroupColor(groups: TabGroup[]): GroupColor {
  const used = new Set(groups.map((group) => group.color));
  return (
    GROUP_COLORS.find((color) => !used.has(color)) ??
    GROUP_COLORS[groups.length % GROUP_COLORS.length]
  );
}

function groupNameFor(tab: Tab): string {
  if (internalPageOf(tab.url)) return titleFor(tab.url);
  return parseDomain(tab.url) || "group";
}

/**
 * Members of a group have to sit next to each other, or the strip would draw the
 * same group twice. Gathered at the position of the first member, order intact.
 */
function gatherGroup(tabs: Tab[], groupId: string): Tab[] {
  const first = tabs.findIndex((tab) => tab.groupId === groupId);
  if (first === -1) return tabs;
  const members = tabs.filter((tab) => tab.groupId === groupId);
  const rest = tabs.filter((tab) => tab.groupId !== groupId);
  const before = tabs.slice(0, first).filter((tab) => tab.groupId !== groupId).length;
  return [...rest.slice(0, before), ...members, ...rest.slice(before)];
}

function initialState(): ScaffoldState {
  const tab = createTab("scaffold://start");
  return {
    tabs: [tab],
    groups: [],
    activeId: tab.id,
    reference: null,
    shelf: [],
    history: [],
    sittings: [],
    notes: [],
    settings: DEFAULT_SETTINGS,
    shelfBarOpen: true,
    notice: null,
  };
}

export type Action =
  | { type: "open-tab"; url: string; activate?: boolean }
  | { type: "close-tab"; id: string }
  | { type: "activate-tab"; id: string }
  | { type: "navigate"; tabId?: string; url: string }
  | { type: "tab-title"; tabId: string; title: string }
  | { type: "tab-favicon"; tabId: string; url: string | null }
  | { type: "tab-loading"; tabId: string; loading: boolean }
  | { type: "tab-url"; tabId: string; url: string }
  | { type: "back"; tabId: string }
  | { type: "forward"; tabId: string }
  | { type: "reload"; tabId: string }
  | { type: "set-width"; tabId: string; width: WidthRule }
  | { type: "group-tab"; tabId: string; targetId: string }
  | { type: "rename-group"; groupId: string; name: string }
  | { type: "toggle-group"; groupId: string }
  | { type: "ungroup"; groupId: string }
  | { type: "keep"; tabId: string; note: string }
  | { type: "keep-clip"; url: string; title: string; note: string }
  | { type: "update-note"; id: string; note: string }
  | { type: "remove-card"; id: string }
  | { type: "hold"; url?: string; title?: string; tabId?: string }
  | { type: "unhold" }
  | { type: "shelf-bar"; open: boolean }
  | { type: "save-sitting"; name: string }
  | { type: "restore-sitting"; id: string }
  | { type: "delete-sitting"; id: string }
  | { type: "clear-history" }
  | { type: "note-add"; text: string }
  | { type: "note-remove"; id: string }
  | { type: "settings"; settings: Partial<Settings> }
  | { type: "notice"; text: string | null };

function recordHistory(history: HistoryEntry[], url: string, title: string): HistoryEntry[] {
  if (internalPageOf(url)) return history;
  const entry: HistoryEntry = { id: uid(), url, title, visitedAt: Date.now() };
  return [entry, ...history].slice(0, HISTORY_LIMIT);
}

function withTab(state: ScaffoldState, id: string, update: (tab: Tab) => Tab): ScaffoldState {
  return { ...state, tabs: state.tabs.map((tab) => (tab.id === id ? update(tab) : tab)) };
}

/** An icon belongs to the site, so a move within it keeps the icon it already has. */
function sameOrigin(from: string, to: string): boolean {
  try {
    return new URL(from).origin === new URL(to).origin;
  } catch {
    return false;
  }
}

export function reducer(state: ScaffoldState, action: Action): ScaffoldState {
  switch (action.type) {
    case "open-tab": {
      // The start sheet is a place, not a page: there is only ever one of it.
      const startTab =
        action.url === "scaffold://start"
          ? state.tabs.find((tab) => internalPageOf(tab.url) === "start")
          : undefined;
      if (startTab) return { ...state, activeId: startTab.id };

      // A tab opened from inside a group joins that group, so a group never splits.
      const groupId = state.tabs.find((item) => item.id === state.activeId)?.groupId ?? null;
      const tab: Tab = { ...createTab(action.url), groupId };
      const index = state.tabs.findIndex((item) => item.id === state.activeId);
      const lastOfGroup =
        groupId === null
          ? -1
          : state.tabs.reduce((last, item, i) => (item.groupId === groupId ? i : last), -1);
      const tabs = [...state.tabs];
      tabs.splice((lastOfGroup === -1 ? index : lastOfGroup) + 1, 0, tab);
      return {
        ...state,
        tabs,
        activeId: action.activate === false ? state.activeId : tab.id,
        history: recordHistory(state.history, tab.url, tab.title),
      };
    }

    case "close-tab": {
      const index = state.tabs.findIndex((tab) => tab.id === action.id);
      if (index === -1) return state;
      const tabs = state.tabs.filter((tab) => tab.id !== action.id);
      if (tabs.length === 0) {
        const fresh = createTab("scaffold://start");
        return { ...state, tabs: [fresh], activeId: fresh.id, groups: [] };
      }
      const activeId =
        state.activeId === action.id ? tabs[Math.min(index, tabs.length - 1)].id : state.activeId;
      const groups = state.groups.filter((group) =>
        tabs.some((tab) => tab.groupId === group.id),
      );
      return { ...state, tabs, activeId, groups };
    }

    case "activate-tab":
      return state.tabs.some((tab) => tab.id === action.id)
        ? { ...state, activeId: action.id }
        : state;

    case "navigate": {
      const tabId = action.tabId ?? state.activeId;
      const tab = state.tabs.find((item) => item.id === tabId);
      if (!tab || tab.url === action.url) {
        if (tab && tab.url === action.url) {
          return withTab(state, tabId, (item) => ({ ...item, reloadKey: item.reloadKey + 1 }));
        }
        return state;
      }
      const entries = [...tab.entries.slice(0, tab.pointer + 1), action.url];
      const next: ScaffoldState = withTab(state, tabId, (item) => ({
        ...item,
        url: action.url,
        title: titleFor(action.url),
        favicon: sameOrigin(item.url, action.url) ? item.favicon : null,
        loading: !internalPageOf(action.url),
        entries,
        pointer: entries.length - 1,
      }));
      return {
        ...next,
        history: recordHistory(next.history, action.url, titleFor(action.url)),
      };
    }

    case "tab-title":
      return withTab(state, action.tabId, (tab) => ({ ...tab, title: action.title }));

    case "tab-favicon":
      return withTab(state, action.tabId, (tab) => ({ ...tab, favicon: action.url }));

    case "tab-loading":
      return withTab(state, action.tabId, (tab) => ({ ...tab, loading: action.loading }));

    // A navigation the page started itself (a link inside a native view).
    case "tab-url": {
      const tab = state.tabs.find((item) => item.id === action.tabId);
      if (!tab || tab.url === action.url) return state;
      const entries = [...tab.entries.slice(0, tab.pointer + 1), action.url];
      return {
        ...withTab(state, action.tabId, (item) => ({
          ...item,
          url: action.url,
          title: item.title,
          favicon: sameOrigin(item.url, action.url) ? item.favicon : null,
          entries,
          pointer: entries.length - 1,
        })),
        history: recordHistory(state.history, action.url, tab.title),
      };
    }

    case "back": {
      const tab = state.tabs.find((item) => item.id === action.tabId);
      if (!tab || tab.pointer === 0) return state;
      const pointer = tab.pointer - 1;
      const url = tab.entries[pointer];
      return withTab(state, action.tabId, (item) => ({
        ...item,
        pointer,
        url,
        title: titleFor(url),
        favicon: sameOrigin(item.url, url) ? item.favicon : null,
        loading: !internalPageOf(url),
      }));
    }

    case "forward": {
      const tab = state.tabs.find((item) => item.id === action.tabId);
      if (!tab || tab.pointer >= tab.entries.length - 1) return state;
      const pointer = tab.pointer + 1;
      const url = tab.entries[pointer];
      return withTab(state, action.tabId, (item) => ({
        ...item,
        pointer,
        url,
        title: titleFor(url),
        favicon: sameOrigin(item.url, url) ? item.favicon : null,
        loading: !internalPageOf(url),
      }));
    }

    case "reload":
      return withTab(state, action.tabId, (tab) => ({
        ...tab,
        reloadKey: tab.reloadKey + 1,
        loading: !internalPageOf(tab.url),
      }));

    case "set-width":
      return withTab(state, action.tabId, (tab) => ({ ...tab, width: action.width }));

    // Drag a tab onto another one: both land in a group. Groups persist with the
    // desk, so a quit and a relaunch comes back grouped.
    case "group-tab": {
      if (action.tabId === action.targetId) return state;
      const moving = state.tabs.find((tab) => tab.id === action.tabId);
      const target = state.tabs.find((tab) => tab.id === action.targetId);
      if (!moving || !target) return state;
      if (moving.groupId && moving.groupId === target.groupId) return state;
      if (internalPageOf(moving.url) === "start" || internalPageOf(target.url) === "start") {
        return { ...state, notice: "the start sheet stays out of groups" };
      }

      let groups = state.groups;
      let groupId = target.groupId ?? null;
      if (!groupId) {
        const group: TabGroup = {
          id: uid(),
          name: groupNameFor(target),
          color: nextGroupColor(groups),
          collapsed: false,
        };
        groups = [...groups, group];
        groupId = group.id;
      }

      const tabs = gatherGroup(
        state.tabs.map((tab) =>
          tab.id === action.tabId || tab.id === action.targetId ? { ...tab, groupId } : tab,
        ),
        groupId,
      );
      const groupsInUse = new Set(tabs.map((tab) => tab.groupId));
      groups = groups.filter((group) => groupsInUse.has(group.id));
      const group = groups.find((item) => item.id === groupId);
      return {
        ...state,
        tabs,
        groups,
        notice: group ? `filed under ${group.name}` : state.notice,
      };
    }

    case "rename-group": {
      const name = action.name.trim();
      if (!name) return state;
      return {
        ...state,
        groups: state.groups.map((group) =>
          group.id === action.groupId ? { ...group, name } : group,
        ),
      };
    }

    case "toggle-group":
      return {
        ...state,
        groups: state.groups.map((group) =>
          group.id === action.groupId ? { ...group, collapsed: !group.collapsed } : group,
        ),
      };

    case "ungroup":
      return {
        ...state,
        tabs: state.tabs.map((tab) =>
          tab.groupId === action.groupId ? { ...tab, groupId: null } : tab,
        ),
        groups: state.groups.filter((group) => group.id !== action.groupId),
        notice: "ungrouped — the tabs stay open",
      };

    case "keep": {
      const tab = state.tabs.find((item) => item.id === action.tabId);
      if (!tab) return state;
      if (internalPageOf(tab.url)) {
        return { ...state, notice: "Post's own pages stay out of the shelf" };
      }
      const existing = state.shelf.find((page) => page.url === tab.url);
      const shelf = existing
        ? state.shelf.map((page) =>
            page.id === existing.id ? { ...page, note: action.note, keptAt: Date.now() } : page,
          )
        : [
            {
              id: uid(),
              url: tab.url,
              title: tab.title,
              note: action.note,
              keptAt: Date.now(),
            },
            ...state.shelf,
          ];
      return {
        ...state,
        shelf,
        shelfBarOpen: true,
        notice: existing ? "note updated" : "kept — the note is the point",
      };
    }

    // A clip: a selection, an image, a video, a link, or a page kept straight
    // from the context menu. Same shelf, same rule — the note says why.
    case "keep-clip": {
      if (!action.url) return state;
      if (internalPageOf(action.url)) {
        return { ...state, notice: "Post's own pages stay out of the shelf" };
      }
      const note = action.note.trim();
      const existing = state.shelf.find((page) => page.url === action.url);
      const shelf = existing
        ? state.shelf.map((page) =>
            page.id === existing.id ? { ...page, note: note || page.note, keptAt: Date.now() } : page,
          )
        : [
            {
              id: uid(),
              url: action.url,
              title: action.title || titleFor(action.url),
              note,
              keptAt: Date.now(),
            },
            ...state.shelf,
          ];
      return {
        ...state,
        shelf,
        shelfBarOpen: true,
        notice: existing ? "note updated" : "kept — the note is the point",
      };
    }

    case "update-note":
      return {
        ...state,
        shelf: state.shelf.map((page) => (page.id === action.id ? { ...page, note: action.note } : page)),
      };

    case "remove-card":
      return { ...state, shelf: state.shelf.filter((page) => page.id !== action.id) };

    case "hold": {
      const tab = state.tabs.find((item) => item.id === (action.tabId ?? state.activeId));
      const url = action.url ?? tab?.url;
      const title = action.title ?? tab?.title;
      if (!url) return state;
      return {
        ...state,
        reference: { url, title: title ?? titleFor(url) },
        notice: "held open — it stays while you browse",
      };
    }

    case "unhold":
      return { ...state, reference: null };

    case "shelf-bar":
      return { ...state, shelfBarOpen: action.open };

    case "save-sitting": {
      const name = action.name.trim() || `desk, ${new Date().getDate()} ${new Date().toLocaleString("en", { month: "short" })}`;
      const sitting: Sitting = {
        id: uid(),
        name,
        createdAt: Date.now(),
        tabs: state.tabs.map((tab) => ({
          url: tab.url,
          title: tab.title,
          group: state.groups.find((group) => group.id === tab.groupId)?.name ?? null,
        })),
      };
      const fresh = createTab("scaffold://start");
      return {
        ...state,
        sittings: [sitting, ...state.sittings],
        tabs: [fresh],
        groups: [],
        activeId: fresh.id,
        notice: `set aside — ${sitting.tabs.length} ${sitting.tabs.length === 1 ? "tab" : "tabs"}`,
      };
    }

    case "restore-sitting": {
      const sitting = state.sittings.find((item) => item.id === action.id);
      if (!sitting || sitting.tabs.length === 0) return state;
      const groups: TabGroup[] = [];
      const byName = new Map<string, TabGroup>();
      const tabs = sitting.tabs.map((entry) => {
        const tab = createTab(entry.url, entry.title);
        const name = entry.group?.trim();
        if (!name) return tab;
        let group = byName.get(name);
        if (!group) {
          group = { id: uid(), name, color: nextGroupColor(groups), collapsed: false };
          byName.set(name, group);
          groups.push(group);
        }
        return { ...tab, groupId: group.id };
      });
      return {
        ...state,
        tabs,
        groups: groups.filter((group) => tabs.some((tab) => tab.groupId === group.id)),
        activeId: tabs[0].id,
        notice: `restored ${sitting.name}`,
      };
    }

    case "delete-sitting":
      return { ...state, sittings: state.sittings.filter((item) => item.id !== action.id) };

    case "clear-history":
      return { ...state, history: [] };

    case "note-add": {
      const text = action.text.trim();
      if (!text) return state;
      const note: Note = { id: uid(), text, createdAt: Date.now() };
      return { ...state, notes: [note, ...state.notes], notice: "saved to turbo notes" };
    }

    case "note-remove":
      return { ...state, notes: state.notes.filter((note) => note.id !== action.id) };

    case "settings":
      return { ...state, settings: { ...DEFAULT_SETTINGS, ...state.settings, ...action.settings } };

    case "notice":
      return { ...state, notice: action.text };

    default:
      return state;
  }
}

function restore(): ScaffoldState {
  const fallback = initialState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ScaffoldState>;
    // Groups come back with the desk. A tab pointing at a group that is gone is
    // just a tab again, and a group with no tabs left is dropped.
    const storedGroups = Array.isArray(parsed.groups) ? (parsed.groups as TabGroup[]) : [];
    const rawGroups = storedGroups
      .filter((group) => group && typeof group.id === "string")
      .map((group) => ({
        id: group.id,
        name: typeof group.name === "string" && group.name.trim() ? group.name : "group",
        color: GROUP_COLORS.includes(group.color) ? group.color : "red",
        collapsed: Boolean(group.collapsed),
      }));
    const knownGroup = new Set(rawGroups.map((group) => group.id));
    const tabs = Array.isArray(parsed.tabs) && parsed.tabs.length > 0
      ? parsed.tabs.map((tab) => ({
          ...tab,
          loading: false,
          groupId: tab.groupId && knownGroup.has(tab.groupId) ? tab.groupId : null,
        }))
      : fallback.tabs;
    const groups = rawGroups.filter((group) => tabs.some((tab) => tab.groupId === group.id));
    const activeId = tabs.some((tab) => tab.id === parsed.activeId) ? parsed.activeId! : tabs[0].id;
    const stored = (parsed.settings ?? {}) as Partial<Settings>;
    return {
      ...fallback,
      ...parsed,
      tabs,
      groups,
      activeId,
      shelf: Array.isArray(parsed.shelf) ? parsed.shelf : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
      sittings: Array.isArray(parsed.sittings) ? parsed.sittings : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      settings: {
        newTab: stored.newTab === "start" ? "start" : "google",
        search: stored.search === "google" ? "google" : "duckduckgo",
        animations: stored.animations === "reduced" ? "reduced" : "full",
      },
      shelfBarOpen: parsed.shelfBarOpen !== false,
      notice: null,
    };
  } catch {
    return fallback;
  }
}

function persist(state: ScaffoldState): void {
  try {
    const { notice: _notice, ...rest } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  } catch {
    /* a full disk should never take the browser down with it */
  }
}

interface StoreValue {
  state: ScaffoldState;
  dispatch: Dispatch<Action>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, restore);

  useEffect(() => {
    persist(state);
  }, [state]);

  useEffect(() => {
    if (!state.notice) return;
    const timer = window.setTimeout(() => dispatch({ type: "notice", text: null }), 2600);
    return () => window.clearTimeout(timer);
  }, [state.notice]);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside StoreProvider");
  return value;
}

export function useActiveTab(): Tab {
  const { state } = useStore();
  return state.tabs.find((tab) => tab.id === state.activeId) ?? state.tabs[0];
}
