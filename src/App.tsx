import { useEffect, useRef, useState } from "react";

import { BookmarkDialog } from "./components/BookmarkDialog";
import { BookmarksBar } from "./components/BookmarksBar";
import { ContextMenu } from "./components/ContextMenu";
import type { MenuItem } from "./components/ContextMenu";
import { KeepDialog } from "./components/KeepDialog";
import { MetaSheet } from "./components/MetaSheet";
import { Palette } from "./components/Palette";
import { PageView } from "./components/PageView";
import { ReaderDialog } from "./components/ReaderDialog";
import { ReferencePane } from "./components/ReferencePane";
import { ShelfBar } from "./components/ShelfBar";
import { TabStrip } from "./components/TabStrip";
import { Toolbar } from "./components/Toolbar";
import { TurboNote } from "./components/TurboNote";
import { UpdateDialog } from "./components/UpdateDialog";
import {
  bridge,
  type AdblockState,
  type Article,
  type BrowserCommand,
  type PageMeta,
  type ViewRect,
} from "./lib/bridge";
import { downloadMarkdown, shelfToMarkdown } from "./lib/markdown";
import { fileStamp } from "./lib/time";
import { checkForUpdate, updateFromCommit, type UpdateInfo } from "./lib/updates";
import { internalPageOf, newTabUrl, parseDomain } from "./lib/url";
import { useActiveTab, useStore } from "./state/store";
import type { Bookmark, KeptPage, Tab } from "./state/types";

function rectOf(element: HTMLElement | null | undefined): ViewRect | null {
  if (!element) return null;
  const box = element.getBoundingClientRect();
  return {
    x: Math.round(box.x),
    y: Math.round(box.y),
    width: Math.round(box.width),
    height: Math.round(box.height),
  };
}

/** The last path segment, which is what an image or a file is called. */
function fileNameOf(url: string): string {
  try {
    const name = new URL(url).pathname.split("/").filter(Boolean).pop();
    return name ? decodeURIComponent(name) : parseDomain(url);
  } catch {
    return parseDomain(url);
  }
}

interface MenuState {
  x: number;
  y: number;
  items: MenuItem[];
}

interface Clip {
  selection?: string;
  mediaType?: string;
  srcURL?: string;
  linkURL?: string;
}

/** A citation is what you paste into a brief: who, what, where. */
function citationOf(meta: PageMeta, url: string): string | null {
  const lines = [meta.title, meta.description].filter(Boolean);
  return lines.length > 0 ? `${lines.join("\n")}\n${url}` : null;
}

/** The fields a link preview is built from, in one payload. */
function socialCardOf(meta: PageMeta): string | null {
  const card = { ...meta.openGraph, ...meta.twitter };
  return Object.keys(card).length > 0 ? JSON.stringify(card, null, 2) : null;
}

export function App() {
  const { state, dispatch } = useStore();
  const activeTab = useActiveTab();
  const [keepOpen, setKeepOpen] = useState(false);
  const [keepTabId, setKeepTabId] = useState<string | null>(null);
  const [bookmarkTabId, setBookmarkTabId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [turbo, setTurbo] = useState<{ x: number; y: number } | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [adblockOpen, setAdblockOpen] = useState(false);
  const [metaSheet, setMetaSheet] = useState<{ meta: PageMeta; tab: Tab } | null>(null);
  const [reader, setReader] = useState<Article | null>(null);
  const [adblock, setAdblock] = useState<AdblockState | null>(null);

  const stageRef = useRef<HTMLElement>(null);
  const referenceRef = useRef<HTMLElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const adblockRef = useRef(adblock);
  adblockRef.current = adblock;

  const keepTab = state.tabs.find((tab) => tab.id === keepTabId) ?? activeTab;
  const bookmarkTab = state.tabs.find((tab) => tab.id === bookmarkTabId) ?? null;
  const floating =
    keepOpen ||
    paletteOpen ||
    updateOpen ||
    bookmarkTab !== null ||
    metaSheet !== null ||
    reader !== null ||
    menu !== null ||
    turbo !== null ||
    toolsOpen ||
    adblockOpen;
  const overlaysNative = bridge !== null && floating && internalPageOf(activeTab.url) === null;

  // One dialog per new build, not per launch: closing it is enough until main moves again.
  const seenKey = (info: UpdateInfo) => info.commit || info.version;
  const announce = (found: UpdateInfo | null) => {
    if (!found) return;
    setUpdate(found);
    let seen: string | null = null;
    try {
      seen = localStorage.getItem("scaffold.update.seen");
    } catch {
      /* private mode */
    }
    if (seenKey(found) && seenKey(found) !== seen) setUpdateOpen(true);
  };
  const dismissUpdate = () => {
    if (update && seenKey(update)) {
      try {
        localStorage.setItem("scaffold.update.seen", seenKey(update));
      } catch {
        /* private mode */
      }
    }
    setUpdateOpen(false);
  };

  // The star and ⌘D open the same bookmark editor.
  const openBookmark = (tab: Tab) => {
    if (internalPageOf(tab.url) !== null) return;
    dispatch({ type: "bookmark-add", url: tab.url, title: tab.title });
    setBookmarkTabId(tab.id);
  };

  // Reader mode reads the page in its own view, then puts the words on a sheet.
  const openReader = async (tab: Tab) => {
    if (!bridge) {
      dispatch({ type: "notice", text: "reader mode needs the desktop engine" });
      return;
    }
    if (internalPageOf(tab.url) !== null) return;
    const article = await bridge.readArticle(tab.id);
    if (!article || !article.text.trim()) {
      dispatch({ type: "notice", text: "this page has no readable article" });
      return;
    }
    setReader({ ...article, title: article.title || tab.title });
  };

  // ⌘⇧D, and the toolbar button, both open the same one-line note.
  useEffect(() => {
    const open = () => setKeepOpen(true);
    window.addEventListener("scaffold:keep", open);
    return () => window.removeEventListener("scaffold:keep", open);
  }, []);

  useEffect(() => {
    const open = () => {
      const current = stateRef.current;
      const tab = current.tabs.find((item) => item.id === current.activeId) ?? current.tabs[0];
      if (tab) openBookmark(tab);
    };
    window.addEventListener("scaffold:bookmark", open);
    return () => window.removeEventListener("scaffold:bookmark", open);
  }, [dispatch]);

  // The blocker lives in main's session; the chrome only reads its state and
  // asks for the two changes a reader can make.
  useEffect(() => {
    if (!bridge) return;
    let live = true;
    bridge
      .getAdblockState()
      .then((next) => {
        if (live) setAdblock(next);
      })
      .catch(() => undefined);
    const off = bridge.onAdblock(setAdblock);
    return () => {
      live = false;
      off();
    };
  }, []);

  // The shell reads main through the checkout's own git remote, so a private
  // repo needs no token; the harness asks the public feed instead.
  useEffect(() => {
    if (!bridge) return;
    return bridge.onUpdate((notice) => announce(notice ? updateFromCommit(notice) : null));
  }, []);

  // Coming back to the window is when a browser looks again, no more than once
  // every five minutes, so focus does not become a polling loop.
  useEffect(() => {
    if (!bridge) return;
    let last = 0;
    const look = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - last < 5 * 60 * 1000) return;
      last = now;
      bridge!.checkUpdates();
    };
    window.addEventListener("focus", look);
    document.addEventListener("visibilitychange", look);
    return () => {
      window.removeEventListener("focus", look);
      document.removeEventListener("visibilitychange", look);
    };
  }, []);

  // Zoom and Do Not Track are page-level, so the shell applies them to every view.
  useEffect(() => {
    bridge?.setPreferences({
      zoom: state.settings.zoom,
      doNotTrack: state.settings.doNotTrack,
    });
  }, [state.settings.zoom, state.settings.doNotTrack]);

  // A browser looks for a newer build quietly and says so once, in a small chip.
  useEffect(() => {
    if (bridge) return;
    let live = true;
    const look = () => {
      checkForUpdate().then((found) => {
        if (live) announce(found);
      });
    };
    const first = window.setTimeout(look, 4000);
    const every = window.setInterval(look, 6 * 60 * 60 * 1000);
    return () => {
      live = false;
      window.clearTimeout(first);
      window.clearInterval(every);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      const current = stateRef.current;
      const tab = current.tabs.find((item) => item.id === current.activeId) ?? current.tabs[0];

      if (event.key === "Escape") {
        setPaletteOpen(false);
        setKeepOpen(false);
        setMenu(null);
        setUpdateOpen(false);
        setBookmarkTabId(null);
        setMetaSheet(null);
        setReader(null);
        return;
      }
      if (!mod) return;

      switch (key) {
        case "d":
          event.preventDefault();
          if (event.shiftKey) setKeepOpen(true);
          else if (internalPageOf(tab.url) === null) {
            dispatch({ type: "bookmark-add", url: tab.url, title: tab.title });
            setBookmarkTabId(tab.id);
          }
          break;
        case "k":
          event.preventDefault();
          setPaletteOpen((open) => !open);
          break;
        case "r":
          event.preventDefault();
          if (event.shiftKey) {
            if (current.reference?.url === tab.url) dispatch({ type: "unhold" });
            else dispatch({ type: "hold", tabId: tab.id });
          } else {
            dispatch({ type: "reload", tabId: tab.id });
          }
          break;
        case "t":
          event.preventDefault();
          dispatch({ type: "open-tab", url: newTabUrl(current.settings.newTab) });
          break;
        case ",":
          event.preventDefault();
          dispatch({ type: "navigate", url: "scaffold://settings" });
          break;
        case "h":
          if (event.shiftKey) {
            event.preventDefault();
            dispatch({ type: "open-tab", url: "scaffold://start" });
          }
          break;
        case "w":
          event.preventDefault();
          dispatch({ type: "close-tab", id: tab.id });
          break;
        case "l":
          event.preventDefault();
          window.dispatchEvent(new CustomEvent("scaffold:address"));
          break;
        // No pointer needed to group: ⌘⇧G folds this tab in with the one beside it.
        case "b":
          if (event.shiftKey) {
            event.preventDefault();
            dispatch({
              type: "settings",
              settings: { bookmarksBar: !current.settings.bookmarksBar },
            });
          }
          break;
        case "g":
          if (event.shiftKey) {
            event.preventDefault();
            const position = current.tabs.findIndex((item) => item.id === tab.id);
            const neighbour = current.tabs[position + 1] ?? current.tabs[position - 1];
            if (neighbour) dispatch({ type: "group-tab", tabId: tab.id, targetId: neighbour.id });
            else dispatch({ type: "notice", text: "open a second tab to make a group" });
          }
          break;
        default:
          if (/^[1-9]$/.test(key)) {
            // The strip's numbering skips the start sheet, which the home button owns.
            const pages = current.tabs.filter((item) => internalPageOf(item.url) !== "start");
            const target = pages[Number(key) - 1];
            if (target) {
              event.preventDefault();
              dispatch({ type: "activate-tab", id: target.id });
            }
          }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch]);

  /*
   * The shelf's right click. Everything that can be kept is offered here: the
   * page itself, a selection of its text, an image, a video, a link. A clip is
   * a shelf entry whose note is the quoted text, so the reason stays attached.
   */
  useEffect(() => {
    const keepFromMenu = (tabId: string) => {
      setKeepTabId(tabId);
      setKeepOpen(true);
      setMenu(null);
    };

    const clipToShelf = (url: string, title: string, note: string) => {
      dispatch({ type: "keep-clip", url, title, note });
      setMenu(null);
    };

    const copyAddress = async (url: string) => {
      try {
        await navigator.clipboard.writeText(url);
        dispatch({ type: "notice", text: "address copied" });
      } catch {
        dispatch({ type: "notice", text: "couldn't copy — select the address instead" });
      }
      setMenu(null);
    };

    const bookmarkItems = (bookmark: Bookmark): MenuItem[] => [
      {
        id: "bookmark-open",
        label: "open bookmark",
        icon: "arrow-up-right",
        onSelect: () => dispatch({ type: "navigate", url: bookmark.url }),
      },
      {
        id: "bookmark-new-tab",
        label: "open in a new tab",
        icon: "plus",
        onSelect: () => dispatch({ type: "open-tab", url: bookmark.url }),
      },
      {
        id: "bookmark-copy",
        label: "copy address",
        icon: "copy",
        onSelect: () => void copyAddress(bookmark.url),
      },
      {
        id: "bookmark-remove",
        label: "remove bookmark",
        icon: "trash",
        danger: true,
        separatorBefore: true,
        onSelect: () => dispatch({ type: "bookmark-remove", id: bookmark.id }),
      },
    ];

    const readMeta = async (tab: Tab): Promise<PageMeta | null> => {
      if (!bridge || internalPageOf(tab.url)) return null;
      return bridge.readPageMeta(tab.id);
    };

    const copyMeta = async (
      tab: Tab,
      build: (meta: PageMeta) => string | null,
      done: string,
      empty: string,
    ) => {
      const meta = await readMeta(tab);
      if (!meta) {
        dispatch({ type: "notice", text: "no page to read" });
        return;
      }
      const text = build(meta);
      if (!text) {
        dispatch({ type: "notice", text: empty });
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        dispatch({ type: "notice", text: done });
      } catch {
        dispatch({ type: "notice", text: "couldn't copy — select it on the page instead" });
      }
    };

    const keepWithDescription = async (tab: Tab) => {
      const meta = await readMeta(tab);
      if (!meta?.description) {
        dispatch({ type: "notice", text: "this page has no description to keep" });
        return;
      }
      dispatch({ type: "keep", tabId: tab.id, note: meta.description });
    };

    const openMeta = async (tab: Tab) => {
      const meta = await readMeta(tab);
      if (!meta) {
        dispatch({ type: "notice", text: "nothing to read on this page" });
        return;
      }
      setMetaSheet({ meta, tab });
    };

    const pageItems = (tab: Tab, extra?: Clip): MenuItem[] => {
      const current = stateRef.current;
      const items: MenuItem[] = [];
      const selection = extra?.selection?.trim();

      if (selection) {
        items.push({
          id: "keep-selection",
          label: "keep the selection on the shelf",
          icon: "quote",
          onSelect: () => clipToShelf(tab.url, tab.title, selection),
        });
      }

      if (extra?.srcURL && /^(image|video|audio)$/.test(extra.mediaType ?? "")) {
        const media =
          extra.mediaType === "video" ? "video" : extra.mediaType === "audio" ? "audio" : "image";
        items.push({
          id: "keep-media",
          label: `keep this ${media} on the shelf`,
          icon: media === "video" ? "video" : "image",
          onSelect: () => clipToShelf(extra.srcURL!, fileNameOf(extra.srcURL!), `from ${tab.title}`),
        });
      }

      if (extra?.linkURL && extra.linkURL !== tab.url) {
        items.push({
          id: "keep-link",
          label: "keep this link on the shelf",
          icon: "link",
          onSelect: () =>
            clipToShelf(
              extra.linkURL!,
              parseDomain(extra.linkURL!) || extra.linkURL!,
              `found on ${tab.title}`,
            ),
        });
      }

      const kept = current.shelf.some((page) => page.url === tab.url);
      if (internalPageOf(tab.url) === null) {
        const bookmarked = current.bookmarks.some((bookmark) => bookmark.url === tab.url);
        items.push({
          id: "bookmark",
          label: bookmarked ? "edit the bookmark" : "bookmark this page",
          icon: "star",
          hint: "⌘D",
          separatorBefore: items.length > 0,
          onSelect: () => {
            dispatch({ type: "bookmark-add", url: tab.url, title: tab.title });
            setBookmarkTabId(tab.id);
            setMenu(null);
          },
        });
        items.push({
          id: "keep",
          label: kept ? "update the note on the shelf" : "keep this page on the shelf",
          icon: "bookmark",
          hint: "⌘⇧D",
          separatorBefore: true,
          onSelect: () => keepFromMenu(tab.id),
        });
      }

      items.push({
        id: "copy",
        label: "copy address",
        icon: "copy",
        onSelect: () => void copyAddress(tab.url),
      });

      const held = current.reference?.url === tab.url;
      items.push({
        id: "hold",
        label: held ? "release the reference pane" : "hold as reference",
        icon: "pin",
        hint: "⌘⇧R",
        onSelect: () => {
          if (held) dispatch({ type: "unhold" });
          else dispatch({ type: "hold", tabId: tab.id });
          setMenu(null);
        },
      });

      if (bridge && internalPageOf(tab.url) === null) {
        const host = parseDomain(tab.url);
        const paused = Boolean(host && adblockRef.current?.allow.includes(host));
        items.push({
          id: "reader",
          label: "reader mode",
          icon: "reader",
          separatorBefore: true,
          onSelect: () => {
            setMenu(null);
            void openReader(tab);
          },
        });
        if (host) {
          items.push({
            id: "adblock-site",
            label: paused
              ? "resume ad blocking on this site"
              : "pause ad blocking on this site",
            icon: "shield",
            onSelect: async () => {
              setMenu(null);
              const next = await bridge!.setAdblockSite(host, !paused);
              setAdblock(next);
              dispatch({
                type: "notice",
                text: next.paused ? `paused on ${host}` : `blocking ${host} again`,
              });
            },
          });
        }
      }

      if (current.tabs.length > 1) {
        items.push({
          id: "close",
          label: "close tab",
          icon: "close",
          hint: "⌘W",
          danger: true,
          separatorBefore: true,
          onSelect: () => dispatch({ type: "close-tab", id: tab.id }),
        });
      }

      return items;
    };

    const referenceItems = (url: string, title: string): MenuItem[] => [
      {
        id: "keep",
        label: "keep this page on the shelf",
        icon: "bookmark",
        onSelect: () => clipToShelf(url, title, ""),
      },
      { id: "copy", label: "copy address", icon: "copy", onSelect: () => void copyAddress(url) },
      {
        id: "close",
        label: "close the pane",
        icon: "close",
        danger: true,
        separatorBefore: true,
        onSelect: () => dispatch({ type: "unhold" }),
      },
    ];

    // The shelf button is the shelf's own door: keep, open, export, show or hide.
    const shelfItems = (): MenuItem[] => {
      const current = stateRef.current;
      const active = current.tabs.find((item) => item.id === current.activeId) ?? current.tabs[0];
      const items: MenuItem[] = [];

      if (internalPageOf(active.url) === null) {
        items.push({
          id: "keep",
          label: "keep this page on the shelf",
          icon: "bookmark",
          hint: "⌘⇧D",
          onSelect: () => keepFromMenu(active.id),
        });
      }

      items.push({
        id: "open-shelf",
        label: "open the shelf page",
        icon: "arrow-up-right",
        separatorBefore: items.length > 0,
        onSelect: () => {
          dispatch({ type: "navigate", url: "scaffold://shelf" });
          setMenu(null);
        },
      });

      items.push({
        id: "export",
        label: "export markdown",
        icon: "export",
        onSelect: () => {
          if (current.shelf.length === 0) {
            dispatch({ type: "notice", text: "the shelf is empty" });
          } else {
            downloadMarkdown(
              `scaffold-shelf-${fileStamp(Date.now())}.md`,
              shelfToMarkdown(current.shelf),
            );
            dispatch({ type: "notice", text: "shelf exported as markdown" });
          }
          setMenu(null);
        },
      });

      items.push({
        id: "bar",
        label: current.shelfBarOpen ? "hide the shelf bar" : "show the shelf bar",
        icon: current.shelfBarOpen ? "chevron-down" : "chevron-up",
        separatorBefore: true,
        onSelect: () => {
          dispatch({ type: "shelf-bar", open: !current.shelfBarOpen });
          setMenu(null);
        },
      });

      return items;
    };

    const cardItems = (card: KeptPage): MenuItem[] => [
      {
        id: "open",
        label: "open on the shelf",
        icon: "arrow-up-right",
        onSelect: () => dispatch({ type: "open-tab", url: card.url }),
      },
      {
        id: "copy",
        label: "copy address",
        icon: "copy",
        onSelect: () => void copyAddress(card.url),
      },
      {
        id: "remove",
        label: "remove from the shelf",
        icon: "trash",
        danger: true,
        separatorBefore: true,
        onSelect: () => dispatch({ type: "remove-card", id: card.id }),
      },
    ];

    /*
     * A tab is a thing you arrange, not only a page you read, so its menu is
     * about the tab first — duplicate, clear the neighbours — then the page's
     * own words: description, card, citation, and the sheet with all of it.
     */
    const tabItems = (tab: Tab): MenuItem[] => {
      const current = stateRef.current;
      const index = current.tabs.findIndex((item) => item.id === tab.id);
      const items: MenuItem[] = [
        {
          id: "duplicate",
          label: "duplicate tab",
          icon: "copy",
          onSelect: () => dispatch({ type: "duplicate-tab", id: tab.id }),
        },
      ];

      if (current.tabs.length > 1) {
        items.push({
          id: "close-others",
          label: "close the other tabs",
          icon: "tab",
          onSelect: () => dispatch({ type: "close-others", id: tab.id }),
        });
      }

      if (index > -1 && index < current.tabs.length - 1) {
        items.push({
          id: "close-after",
          label: "close the tabs to the right",
          icon: "ungroup",
          onSelect: () => dispatch({ type: "close-after", id: tab.id }),
        });
      }

      items.push({
        id: "copy",
        label: "copy address",
        icon: "link",
        onSelect: () => void copyAddress(tab.url),
      });

      // Metadata lives in the page's DOM, which only the native shell can read.
      if (bridge && internalPageOf(tab.url) === null) {
        items.push({
          id: "keep-with-description",
          label: "keep with its description",
          icon: "bookmark",
          separatorBefore: true,
          onSelect: () => void keepWithDescription(tab),
        });
        items.push({
          id: "copy-description",
          label: "copy the description",
          icon: "quote",
          onSelect: () =>
            void copyMeta(
              tab,
              (meta) => meta.description || null,
              "description copied",
              "this page has no description",
            ),
        });
        items.push({
          id: "copy-card",
          label: "copy the social card",
          icon: "globe",
          onSelect: () => void copyMeta(tab, socialCardOf, "social card copied", "this page has no social card"),
        });
        items.push({
          id: "copy-citation",
          label: "copy a citation",
          icon: "copy",
          onSelect: () =>
            void copyMeta(
              tab,
              (meta) => citationOf(meta, tab.url),
              "citation copied",
              "this page has nothing to cite",
            ),
        });
        items.push({
          id: "details",
          label: "page details",
          icon: "info",
          onSelect: () => void openMeta(tab),
        });
      }

      items.push({
        id: "close",
        label: "close tab",
        icon: "close",
        hint: "⌘W",
        danger: true,
        separatorBefore: true,
        onSelect: () => dispatch({ type: "close-tab", id: tab.id }),
      });

      return items;
    };

    const onContextMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      // Inputs keep the platform's own menu: cut, copy, paste.
      if (target.closest("input, textarea, [contenteditable='true']")) return;

      const current = stateRef.current;
      const tabEl = target.closest<HTMLElement>("[data-tab-id]");
      const cardEl = target.closest<HTMLElement>("[data-card-id]");
      const bookmarkEl = target.closest<HTMLElement>("[data-bookmark-id]");
      const shelfButton = target.closest<HTMLElement>("[data-shelf-button]");
      let items: MenuItem[] | null = null;

      if (tabEl) {
        const tab = current.tabs.find((item) => item.id === tabEl.dataset.tabId);
        if (tab) items = tabItems(tab);
      } else if (cardEl) {
        const card = current.shelf.find((page) => page.id === cardEl.dataset.cardId);
        if (card) items = cardItems(card);
      } else if (bookmarkEl) {
        const bookmark = current.bookmarks.find(
          (item) => item.id === bookmarkEl.dataset.bookmarkId,
        );
        if (bookmark) items = bookmarkItems(bookmark);
      } else if (shelfButton) {
        items = shelfItems();
      } else if (target.closest(".reference") && current.reference) {
        items = referenceItems(current.reference.url, current.reference.title);
      } else if (target.closest(".desk")) {
        const active = current.tabs.find((item) => item.id === current.activeId) ?? current.tabs[0];
        const selection = window.getSelection()?.toString() ?? "";
        items = pageItems(active, { selection });
      }

      if (!items || items.length === 0) return;
      event.preventDefault();
      setMenu({ x: event.clientX, y: event.clientY, items });
    };

    document.addEventListener("contextmenu", onContextMenu);
    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, [dispatch]);

  // Menu items arrive as commands; the chrome already knows how to do each one.
  useEffect(() => {
    if (!bridge) return;
    return bridge.onCommand((command: BrowserCommand) => {
      const current = stateRef.current;
      const tab = current.tabs.find((item) => item.id === current.activeId) ?? current.tabs[0];
      switch (command) {
        case "new-tab":
          dispatch({ type: "open-tab", url: newTabUrl(current.settings.newTab) });
          break;
        case "close-tab":
          dispatch({ type: "close-tab", id: tab.id });
          break;
        case "keep":
          setKeepTabId(null);
          setKeepOpen(true);
          break;
        case "shelf":
          dispatch({ type: "navigate", url: "scaffold://shelf" });
          break;
        case "address":
          window.dispatchEvent(new CustomEvent("scaffold:address"));
          break;
        case "palette":
          setPaletteOpen(true);
          break;
        case "back":
          dispatch({ type: "back", tabId: tab.id });
          break;
        case "forward":
          dispatch({ type: "forward", tabId: tab.id });
          break;
        case "reload":
          dispatch({ type: "reload", tabId: tab.id });
          break;
        case "reference":
          if (current.reference?.url === tab.url) dispatch({ type: "unhold" });
          else dispatch({ type: "hold", tabId: tab.id });
          break;
      }
    });
  }, [dispatch]);

  useEffect(() => {
    if (!bridge) return;
    return bridge.onViewEvent((event) => {
      if (event.kind === "title" && event.tabId && event.title) {
        dispatch({ type: "tab-title", tabId: event.tabId, title: event.title });
      }
      if (event.kind === "favicon" && event.tabId) {
        dispatch({ type: "tab-favicon", tabId: event.tabId, url: event.url ?? null });
      }
      if (event.kind === "loading" && event.tabId) {
        dispatch({ type: "tab-loading", tabId: event.tabId, loading: Boolean(event.loading) });
      }
      if (event.kind === "open" && event.url) {
        dispatch({ type: "open-tab", url: event.url });
      }
      if (event.kind === "url" && event.tabId && event.url) {
        dispatch({ type: "tab-url", tabId: event.tabId, url: event.url });
      }
      // The native context menu hands back a clip the chrome never saw.
      if (event.kind === "context-keep" && event.url) {
        dispatch({
          type: "keep-clip",
          url: event.url,
          title: event.title ?? event.url,
          note: event.note ?? "",
        });
      }
      if (event.kind === "keep-request" && event.tabId) {
        setKeepTabId(event.tabId);
        setKeepOpen(true);
      }
      if (event.kind === "hold" && event.url) {
        dispatch({ type: "hold", url: event.url, title: event.title });
      }
      if (event.kind === "download" && event.title) {
        dispatch({ type: "notice", text: `saving ${event.title}` });
      }
    });
  }, [dispatch]);

  // Native views sit above the chrome, so the shell raises the chrome and makes
  // its stage transparent while a surface floats; the page stays visible behind.
  useEffect(() => {
    bridge?.setOverlay(floating);
  }, [floating]);

  useEffect(() => {
    document.documentElement.classList.toggle("is-overlay", overlaysNative);
    return () => document.documentElement.classList.remove("is-overlay");
  }, [overlaysNative]);

  useEffect(() => {
    if (!bridge) return;
    const stage = stageRef.current;
    const reference = referenceRef.current;
    if (!stage) return;

    const sync = () => {
      const sheet = stage.querySelector<HTMLElement>("[data-sheet='active']");
      const pane = reference?.querySelector<HTMLElement>("[data-sheet='reference']");
      const activeRect = rectOf(sheet);
      const referenceRect = rectOf(pane);
      // Internal pages are chrome, not pages: no native view may cover them.
      bridge!.syncLayout({
        activeTab:
          activeRect && activeTab && internalPageOf(activeTab.url) === null
            ? { id: activeTab.id, url: activeTab.url, rect: activeRect }
            : null,
        reference:
          referenceRect && state.reference && !state.reference.url.startsWith("scaffold://")
            ? { url: state.reference.url, rect: referenceRect }
            : null,
      });
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(stage);
    // An animated width has to reach the native view frame by frame.
    const stageSheet = stage.querySelector<HTMLElement>("[data-sheet='active']");
    if (stageSheet) observer.observe(stageSheet);
    if (reference) observer.observe(reference);
    window.addEventListener("resize", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [activeTab, state.reference]);

  const constrained = activeTab.width !== "fit";

  return (
    <div
      className={
        "app" +
        (bridge?.platform === "darwin" ? " is-mac" : "") +
        (overlaysNative ? " is-overlay" : "") +
        (state.settings.animations === "reduced" ? " is-calm" : "")
      }
    >
      <TabStrip />
      <Toolbar
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenTurbo={(box) =>
          setTurbo({
            x: Math.min(Math.max(12, box.right - 328), window.innerWidth - 340),
            y: box.bottom + 8,
          })
        }
        onMenuChange={setToolsOpen}
        onAdblockOpen={setAdblockOpen}
        update={update}
        onOpenUpdate={() => setUpdateOpen(true)}
        adblock={adblock}
      />

      <BookmarksBar />

      <main className="desk">
        {state.reference && (
          <ReferencePane reference={state.reference} containerRef={referenceRef} />
        )}
        <section
          className={"stage" + (constrained ? " is-ruled" : "")}
          ref={stageRef}
          aria-label={activeTab.title}
        >
          <PageView tab={activeTab} />
        </section>
      </main>

      <ShelfBar />

      {state.notice && (
        <p className="notice tnum" role="status">
          {state.notice}
        </p>
      )}

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />
      )}

      {keepOpen && (
        <KeepDialog
          tab={keepTab}
          onClose={() => {
            setKeepOpen(false);
            setKeepTabId(null);
          }}
        />
      )}
      {bookmarkTab && (
        <BookmarkDialog tab={bookmarkTab} onClose={() => setBookmarkTabId(null)} />
      )}
      {update && updateOpen && (
        <UpdateDialog
          update={update}
          onClose={dismissUpdate}
          onOpenUpdates={() => {
            dismissUpdate();
            dispatch({ type: "navigate", url: "scaffold://updates" });
          }}
        />
      )}
      {paletteOpen && <Palette onClose={() => setPaletteOpen(false)} />}
      {turbo && <TurboNote x={turbo.x} y={turbo.y} onClose={() => setTurbo(null)} />}
      {metaSheet && (
        <MetaSheet
          tab={metaSheet.tab}
          meta={metaSheet.meta}
          onClose={() => setMetaSheet(null)}
        />
      )}
      {reader && <ReaderDialog article={reader} onClose={() => setReader(null)} />}
    </div>
  );
}
