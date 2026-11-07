import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, PenLine, Plus, Puzzle, RotateCw, Search, Settings2, Star, X } from "lucide-react";

import {
  activateTab,
  addressToUrl,
  closeTab,
  currentWindowTabs,
  domainOf,
  exportShelf,
  faviconFor,
  isBookmarked,
  isWebUrl,
  navigate,
  newTab,
  pageAction,
  removeFromShelf,
  selfTabId,
  toggleBookmark,
} from "./bridge";
import { demoShelf, demoSittings, demoTabs } from "./demo";
import { BookmarksView, ExtensionsView, HistoryView, SettingsView, ShelfView } from "./panels";
import {
  DEFAULT_SETTINGS,
  hasChrome,
  keepOnShelf,
  onStorageChange,
  readSettings,
  readShelf,
  readSittings,
  uid,
  writeSettings,
  writeSittings,
} from "./store";
import type { DeskSettings, ShelfEntry, Sitting } from "./store";

type View = "shelf" | "history" | "bookmarks" | "extensions" | "settings";

const VIEWS: { id: View; label: string }[] = [
  { id: "shelf", label: "shelf" },
  { id: "history", label: "history" },
  { id: "bookmarks", label: "bookmarks" },
  { id: "extensions", label: "extensions" },
  { id: "settings", label: "settings" },
];

function TabMark({ url }: { url: string | undefined }) {
  const [broken, setBroken] = useState<string | null>(null);
  const source = faviconFor(url);

  if (source && broken !== source) {
    return <img className="tab-favicon" src={source} alt="" onError={() => setBroken(source)} />;
  }
  const letter = domainOf(url).charAt(0).toUpperCase();
  return (
    <span className="tab-letter" aria-hidden="true">
      {letter || "·"}
    </span>
  );
}

export function App() {
  const demo = !hasChrome;
  const [tabs, setTabs] = useState<chrome.tabs.Tab[]>(demo ? demoTabs : []);
  const [selfId, setSelfId] = useState<number | null>(null);
  const [recentId, setRecentId] = useState<number | null>(null);
  const [shelf, setShelf] = useState<ShelfEntry[]>(demo ? demoShelf : []);
  const [sittings, setSittings] = useState<Sitting[]>(demo ? demoSittings : []);
  const [settings, setSettings] = useState<DeskSettings>(DEFAULT_SETTINGS);
  const [view, setView] = useState<View>("shelf");
  const [find, setFind] = useState("");
  const [address, setAddress] = useState("");
  const [editing, setEditing] = useState(false);
  const [starred, setStarred] = useState(false);
  const [keepFor, setKeepFor] = useState<chrome.tabs.Tab | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const say = (text: string) => setNotice(text);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // First paint: which tab is the desk, what Chromium has open, what we kept.
  useEffect(() => {
    if (!hasChrome) return;
    let alive = true;
    void (async () => {
      const [self, list, storedShelf, storedSittings, storedSettings] = await Promise.all([
        selfTabId(),
        currentWindowTabs(),
        readShelf(),
        readSittings(),
        readSettings(),
      ]);
      if (!alive) return;
      setSelfId(self);
      setTabs(list);
      setShelf(storedShelf);
      setSittings(storedSittings);
      setSettings(storedSettings);
      const desk = list.find((tab) => tab.id === self);
      const pages = list.filter((tab) => tab.id !== self);
      const before = desk
        ? pages.filter((tab) => tab.index < (desk.index ?? 0)).at(-1)
        : undefined;
      setRecentId(before?.id ?? pages.at(-1)?.id ?? null);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // A keep from the page menu, or a restored desk, arrives while the desk is open.
  useEffect(() => {
    if (!hasChrome) return;
    return onStorageChange((key) => {
      if (key === "post.shelf.v1") void readShelf().then(setShelf);
      if (key === "post.sittings.v1") void readSittings().then(setSittings);
      if (key === "post.settings.v1") void readSettings().then(setSettings);
    });
  }, []);

  useEffect(() => {
    if (!hasChrome || selfId === null) return;
    const refresh = () => {
      void currentWindowTabs().then(setTabs).catch(() => {});
    };
    chrome.tabs.onCreated.addListener(refresh);
    chrome.tabs.onRemoved.addListener(refresh);
    chrome.tabs.onMoved.addListener(refresh);
    chrome.tabs.onUpdated.addListener(refresh);
    const onActivated = (info: { tabId: number }) => {
      if (info.tabId !== selfId) setRecentId(info.tabId);
    };
    chrome.tabs.onActivated.addListener(onActivated);
    return () => {
      chrome.tabs.onCreated.removeListener(refresh);
      chrome.tabs.onRemoved.removeListener(refresh);
      chrome.tabs.onMoved.removeListener(refresh);
      chrome.tabs.onUpdated.removeListener(refresh);
      chrome.tabs.onActivated.removeListener(onActivated);
    };
  }, [selfId]);

  // `post <words>` in Chromium's own address bar opens the desk filtered.
  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get("find");
    if (query) {
      setFind(query);
      setView("shelf");
    }
  }, []);

  const pageTabs = tabs.filter((tab) => tab.id !== selfId);
  const selfIndex = tabs.find((tab) => tab.id === selfId)?.index ?? pageTabs.length;
  const activePage =
    pageTabs.find((tab) => tab.id === recentId) ??
    pageTabs[Math.max(0, selfIndex - 1)] ??
    pageTabs[0] ??
    null;
  const activeUrl = activePage?.url ?? "";

  useEffect(() => {
    if (!editing) setAddress(activeUrl);
  }, [activeUrl, editing]);

  useEffect(() => {
    let alive = true;
    void isBookmarked(activeUrl).then((value) => {
      if (alive) setStarred(value);
    });
    return () => {
      alive = false;
    };
  }, [activeUrl]);

  const openPage = (url: string) => {
    if (!hasChrome) {
      say("Pages open inside Chromium.");
      return;
    }
    void navigate(activePage?.id ?? null, url);
  };

  const submitAddress = () => {
    const url = addressToUrl(address, settings.search);
    if (!url) return;
    if (!hasChrome) {
      say("The desk browses inside Chromium.");
      return;
    }
    void navigate(activePage?.id ?? null, url);
    setEditing(false);
    (document.activeElement as HTMLElement | null)?.blur();
  };

  const star = () => {
    if (!isWebUrl(activeUrl)) {
      say("Only real pages get a bookmark.");
      return;
    }
    if (!hasChrome) {
      setStarred((value) => !value);
      return;
    }
    void toggleBookmark(activeUrl, activePage?.title).then((now) => {
      setStarred(now);
      say(now ? "bookmarked" : "bookmark removed");
    });
  };

  const askKeep = () => {
    if (!activePage || !isWebUrl(activePage.url)) {
      say("Open a page first — Post's own pages stay out of the shelf.");
      return;
    }
    setKeepFor(activePage);
  };

  const saveKeep = (note: string) => {
    if (!keepFor) return;
    if (!hasChrome) {
      setShelf((entries) => [
        {
          id: uid(),
          url: keepFor.url ?? "",
          title: keepFor.title ?? "page",
          note,
          keptAt: Date.now(),
        },
        ...entries,
      ]);
      setKeepFor(null);
      say("kept — in the demo only");
      return;
    }
    void keepOnShelf(keepFor, note).then((next) => {
      setShelf(next);
      setKeepFor(null);
      say(note.trim() ? "kept — the note is the point" : "kept, without a note");
    });
  };

  const setAside = () => {
    const open = pageTabs.filter((tab) => isWebUrl(tab.url));
    if (!hasChrome) {
      say("Nothing to set aside in the demo.");
      return;
    }
    if (open.length === 0) {
      say("No pages on the desk to set aside.");
      return;
    }
    const sitting: Sitting = {
      id: uid(),
      name: `desk, ${new Date().toLocaleDateString(undefined, { day: "numeric", month: "short" })}`,
      createdAt: Date.now(),
      tabs: open.map((tab) => ({ url: tab.url!, title: tab.title || tab.url! })),
    };
    const next = [sitting, ...sittings];
    void writeSittings(next).then(async () => {
      setSittings(next);
      await Promise.all(open.map((tab) => (tab.id === undefined ? Promise.resolve() : closeTab(tab.id))));
      say(`set aside — ${open.length} ${open.length === 1 ? "tab" : "tabs"}`);
    });
  };

  const restore = (sitting: Sitting) => {
    if (!hasChrome) {
      say("Restoring needs Chromium.");
      return;
    }
    void (async () => {
      for (const entry of sitting.tabs) await newTab(entry.url);
      say(`restored ${sitting.name}`);
    })();
  };

  const deleteSitting = (id: string) => {
    const next = sittings.filter((sitting) => sitting.id !== id);
    setSittings(next);
    if (hasChrome) void writeSittings(next);
  };

  const changeSettings = (partial: Partial<DeskSettings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    if (hasChrome) void writeSettings(next);
  };

  const pullShelfExport = () => {
    if (shelf.length === 0) {
      say("The shelf is empty — nothing to export.");
      return;
    }
    exportShelf(shelf);
    say("the shelf left as a markdown file");
  };

  return (
    <div className={`shell${settings.animations === "reduced" ? " is-still" : ""}`}>
      {demo && (
        <p className="demo-ribbon">
          Demo data — chrome.* is not available on this page. Load dist-shell in chrome://extensions
          (developer mode → Load unpacked), or start with npm run shell.
        </p>
      )}

      <header className="tabstrip">
        <span className="wordmark">Post</span>
        <div className="tabs">
          {pageTabs.map((tab) => (
            <div key={tab.id ?? tab.index} className={`tab${tab.id === activePage?.id ? " is-recent" : ""}`}>
              <button
                type="button"
                className="tab-main"
                title={tab.title || tab.url}
                onClick={() => (tab.id === undefined ? undefined : void activateTab(tab.id))}
              >
                <TabMark url={tab.url} />
                <span className="tab-title">{tab.title || domainOf(tab.url) || "new tab"}</span>
              </button>
              <button
                type="button"
                className="tab-close"
                aria-label="close tab"
                title="close tab"
                onClick={() => (tab.id === undefined ? undefined : void closeTab(tab.id))}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="icon-btn" title="new tab" aria-label="new tab" onClick={() => void newTab()}>
          <Plus size={16} />
        </button>
      </header>

      <div className="toolbar">
        <div className="nav">
          <button
            type="button"
            className="icon-btn"
            title="back"
            aria-label="back"
            onClick={() => void pageAction(activePage?.id ?? null, "back")}
          >
            <ArrowLeft size={16} />
          </button>
          <button
            type="button"
            className="icon-btn"
            title="forward"
            aria-label="forward"
            onClick={() => void pageAction(activePage?.id ?? null, "forward")}
          >
            <ArrowRight size={16} />
          </button>
          <button
            type="button"
            className="icon-btn"
            title="reload"
            aria-label="reload"
            onClick={() => void pageAction(activePage?.id ?? null, "reload")}
          >
            <RotateCw size={15} />
          </button>
        </div>

        <form
          className="omnibox"
          onSubmit={(event) => {
            event.preventDefault();
            submitAddress();
          }}
        >
          <Search size={14} className="omnibox-lead" aria-hidden="true" />
          <input
            className="omnibox-input"
            value={address}
            spellCheck={false}
            placeholder="Search or enter an address"
            aria-label="address"
            onChange={(event) => setAddress(event.target.value)}
            onFocus={() => setEditing(true)}
            onBlur={() => setEditing(false)}
          />
          <button
            type="button"
            className={`omnibox-star${starred ? " is-on" : ""}`}
            title={starred ? "remove bookmark" : "bookmark this page"}
            aria-label={starred ? "remove bookmark" : "bookmark this page"}
            onClick={star}
          >
            <Star size={14} fill={starred ? "currentColor" : "none"} />
          </button>
        </form>

        <button type="button" className="keep-btn" title="keep this page" onClick={askKeep}>
          <PenLine size={14} />
          keep
        </button>
        <button
          type="button"
          className="icon-btn"
          title="extensions"
          aria-label="extensions"
          onClick={() => setView("extensions")}
        >
          <Puzzle size={16} />
        </button>
        <button
          type="button"
          className="icon-btn"
          title="settings"
          aria-label="settings"
          onClick={() => setView("settings")}
        >
          <Settings2 size={16} />
        </button>
      </div>

      <main className="desk">
        <div className="desk-inner">
          <nav className="views" aria-label="desk">
            {VIEWS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={view === entry.id ? "is-on" : undefined}
                aria-current={view === entry.id ? "page" : undefined}
                onClick={() => setView(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </nav>

          {view === "shelf" && (
            <ShelfView
              shelf={shelf}
              sittings={sittings}
              find={find}
              onFind={setFind}
              onOpen={openPage}
              onRemove={(id) => {
                if (!hasChrome) {
                  setShelf((entries) => entries.filter((entry) => entry.id !== id));
                  return;
                }
                void removeFromShelf(id).then(setShelf);
              }}
              onSetAside={setAside}
              onRestore={restore}
              onDeleteSitting={deleteSitting}
              onExport={pullShelfExport}
            />
          )}
          {view === "history" && <HistoryView demo={demo} onOpen={openPage} />}
          {view === "bookmarks" && <BookmarksView demo={demo} onOpen={openPage} />}
          {view === "extensions" && <ExtensionsView demo={demo} />}
          {view === "settings" && (
            <SettingsView
              settings={settings}
              onChange={changeSettings}
              shelfCount={shelf.length}
              onExport={pullShelfExport}
            />
          )}
        </div>
      </main>

      <footer className="band" aria-hidden="true" />

      {keepFor && <KeepDialog tab={keepFor} onCancel={() => setKeepFor(null)} onSave={saveKeep} />}

      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}

/** One field, one reason, and the page it is about above it. */
function KeepDialog({
  tab,
  onCancel,
  onSave,
}: {
  tab: chrome.tabs.Tab;
  onCancel: () => void;
  onSave: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const noteRef = useRef(note);
  const saveRef = useRef(onSave);
  noteRef.current = note;
  saveRef.current = onSave;

  useEffect(() => {
    fieldRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) saveRef.current(noteRef.current);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="keep" role="dialog" aria-modal="true" aria-label="keep this page">
      <div className="keep-sheet">
        <p className="keep-eyebrow">keep</p>
        <h2 className="keep-title">{tab.title || domainOf(tab.url) || "this page"}</h2>
        <p className="keep-url">{tab.url}</p>
        <textarea
          ref={fieldRef}
          className="keep-field"
          value={note}
          rows={4}
          placeholder="Why is it worth keeping?"
          onChange={(event) => setNote(event.target.value)}
        />
        <div className="keep-actions">
          <button type="button" className="ghost-btn" onClick={onCancel}>
            cancel
          </button>
          <button type="button" className="keep-btn" onClick={() => onSave(note)}>
            save to the shelf
          </button>
        </div>
      </div>
    </div>
  );
}
