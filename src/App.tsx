import { useEffect, useRef, useState } from "react";

import { ContextMenu } from "./components/ContextMenu";
import type { MenuItem } from "./components/ContextMenu";
import { KeepDialog } from "./components/KeepDialog";
import { Palette } from "./components/Palette";
import { PageView } from "./components/PageView";
import { ReferencePane } from "./components/ReferencePane";
import { ShelfBar } from "./components/ShelfBar";
import { TabStrip } from "./components/TabStrip";
import { Toolbar } from "./components/Toolbar";
import { UpdateDialog } from "./components/UpdateDialog";
import { bridge, type BrowserCommand, type ViewRect } from "./lib/bridge";
import { downloadMarkdown, shelfToMarkdown } from "./lib/markdown";
import { fileStamp } from "./lib/time";
import { checkForUpdate, updateFromCommit, type UpdateInfo } from "./lib/updates";
import { internalPageOf, parseDomain } from "./lib/url";
import { useActiveTab, useStore } from "./state/store";
import type { KeptPage, Tab } from "./state/types";

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

export function App() {
  const { state, dispatch } = useStore();
  const activeTab = useActiveTab();
  const [keepOpen, setKeepOpen] = useState(false);
  const [keepTabId, setKeepTabId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [updateOpen, setUpdateOpen] = useState(false);

  const stageRef = useRef<HTMLElement>(null);
  const referenceRef = useRef<HTMLElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const keepTab = state.tabs.find((tab) => tab.id === keepTabId) ?? activeTab;

  // ⌘D, and the toolbar button, both open the same one-line note.
  useEffect(() => {
    const open = () => setKeepOpen(true);
    window.addEventListener("scaffold:keep", open);
    return () => window.removeEventListener("scaffold:keep", open);
  }, []);

  // The shell reads main through the checkout's own git remote, so a private
  // repo needs no token; the harness asks the public feed instead.
  useEffect(() => {
    if (!bridge) return;
    return bridge.onUpdate((notice) => {
      const found = notice ? updateFromCommit(notice) : null;
      if (found) setUpdate(found);
    });
  }, []);

  // A browser looks for a newer build quietly and says so once, in a small chip.
  useEffect(() => {
    if (bridge) return;
    let live = true;
    const look = () => {
      checkForUpdate().then((found) => {
        if (live && found) setUpdate(found);
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
        return;
      }
      if (!mod) return;

      switch (key) {
        case "d":
          event.preventDefault();
          setKeepOpen(true);
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
          dispatch({ type: "open-tab", url: "scaffold://start" });
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
        items.push({
          id: "keep",
          label: kept ? "update the note on the shelf" : "keep this page on the shelf",
          icon: "bookmark",
          hint: "⌘D",
          separatorBefore: items.length > 0,
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
          hint: "⌘D",
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

    const onContextMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      // Inputs keep the platform's own menu: cut, copy, paste.
      if (target.closest("input, textarea, [contenteditable='true']")) return;

      const current = stateRef.current;
      const tabEl = target.closest<HTMLElement>("[data-tab-id]");
      const cardEl = target.closest<HTMLElement>("[data-card-id]");
      const shelfButton = target.closest<HTMLElement>("[data-shelf-button]");
      let items: MenuItem[] | null = null;

      if (tabEl) {
        const tab = current.tabs.find((item) => item.id === tabEl.dataset.tabId);
        if (tab) items = pageItems(tab);
      } else if (cardEl) {
        const card = current.shelf.find((page) => page.id === cardEl.dataset.cardId);
        if (card) items = cardItems(card);
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
          dispatch({ type: "open-tab", url: "scaffold://start" });
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

  // The vault is the shell's, not the renderer's: only origin and username come back.
  useEffect(() => {
    if (!bridge) return;
    bridge.vault
      .list()
      .then((credentials) => dispatch({ type: "set-credentials", credentials }))
      .catch(() => undefined);
  }, [dispatch]);

  useEffect(() => {
    if (!bridge) return;
    return bridge.onViewEvent((event) => {
      if (event.kind === "title" && event.tabId && event.title) {
        dispatch({ type: "tab-title", tabId: event.tabId, title: event.title });
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

  // Native views sit above the chrome, so a modal must lift them out of the way.
  useEffect(() => {
    bridge?.setOverlay(keepOpen || paletteOpen || updateOpen);
  }, [keepOpen, paletteOpen, updateOpen]);

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
    <div className={"app" + (bridge?.platform === "darwin" ? " is-mac" : "")}>
      <TabStrip />
      <Toolbar
        onOpenPalette={() => setPaletteOpen(true)}
        update={update}
        onOpenUpdate={() => setUpdateOpen(true)}
      />

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
      {update && updateOpen && (
        <UpdateDialog update={update} onClose={() => setUpdateOpen(false)} />
      )}
      {paletteOpen && <Palette onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}
