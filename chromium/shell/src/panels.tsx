import { useEffect, useState } from "react";
import { Download, ExternalLink, Trash2 } from "lucide-react";

import {
  domainOf,
  faviconFor,
  formatWhen,
  listBookmarks,
  listExtensions,
  listHistory,
  removeBookmark,
  removeExtension,
  setExtensionEnabled,
} from "./bridge";
import type { FlatBookmark } from "./bridge";
import { demoBookmarks, demoExtensions, demoHistory } from "./demo";
import { hasChrome } from "./store";
import type { DeskSettings, ShelfEntry, Sitting } from "./store";

function Mark({ url }: { url: string }) {
  const [broken, setBroken] = useState<string | null>(null);
  const source = faviconFor(url, 16);
  if (source && broken !== source) {
    return <img className="row-favicon" src={source} alt="" onError={() => setBroken(source)} />;
  }
  return <span className="row-letter" aria-hidden="true">{domainOf(url).charAt(0).toUpperCase() || "·"}</span>;
}

export function ShelfView({
  shelf,
  sittings,
  find,
  onFind,
  onOpen,
  onRemove,
  onSetAside,
  onRestore,
  onDeleteSitting,
  onExport,
}: {
  shelf: ShelfEntry[];
  sittings: Sitting[];
  find: string;
  onFind: (value: string) => void;
  onOpen: (url: string) => void;
  onRemove: (id: string) => void;
  onSetAside: () => void;
  onRestore: (sitting: Sitting) => void;
  onDeleteSitting: (id: string) => void;
  onExport: () => void;
}) {
  const needle = find.trim().toLowerCase();
  const shown = needle
    ? shelf.filter((entry) =>
        `${entry.title} ${entry.url} ${entry.note}`.toLowerCase().includes(needle),
      )
    : shelf;

  return (
    <section className="view-body">
      <div className="view-head">
        <div>
          <h1>Your shelf</h1>
          <p className="view-sub">
            {shelf.length === 0
              ? "Nothing kept yet. Keep the page you are reading and say why."
              : `${shelf.length} kept ${shelf.length === 1 ? "page" : "pages"}, each with the reason it stayed.`}
          </p>
        </div>
        <div className="view-tools">
          <label className="find">
            <input
              value={find}
              onChange={(event) => onFind(event.target.value)}
              placeholder="search the shelf"
              aria-label="search the shelf"
              spellCheck={false}
            />
          </label>
          <button type="button" className="ghost-btn" onClick={onExport}>
            <Download size={14} />
            export markdown
          </button>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="empty">
          {needle
            ? `Nothing on the shelf says “${find.trim()}”.`
            : "Keep what you find, while you still know why. The note is the point."}
        </p>
      ) : (
        <ul className="shelf-grid">
          {shown.map((entry) => (
            <li key={entry.id} className="card">
              <div className="card-top">
                <button type="button" className="card-open" onClick={() => onOpen(entry.url)}>
                  <span className="card-title">{entry.title}</span>
                  <span className="card-domain">{domainOf(entry.url)}</span>
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="remove from the shelf"
                  aria-label="remove from the shelf"
                  onClick={() => onRemove(entry.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {entry.note.trim() && <p className="card-note">{entry.note}</p>}
              <div className="card-foot">
                <span className="card-when">kept {formatWhen(entry.keptAt)}</span>
                <button type="button" className="link-btn" onClick={() => onOpen(entry.url)}>
                  open
                  <ExternalLink size={12} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="sittings">
        <div className="sittings-head">
          <div>
            <h2>Desks set aside</h2>
            <p className="view-sub">Name the desk, close it, bring it back with its order intact.</p>
          </div>
          <button type="button" className="ghost-btn" onClick={onSetAside}>
            set this desk aside
          </button>
        </div>
        {sittings.length === 0 ? (
          <p className="empty empty--slim">No desk set aside yet. Today's tabs can wait here.</p>
        ) : (
          <ul className="sitting-list">
            {sittings.map((sitting) => (
              <li key={sitting.id} className="sitting">
                <div>
                  <span className="sitting-name">{sitting.name}</span>
                  <span className="sitting-meta">
                    {sitting.tabs.length} {sitting.tabs.length === 1 ? "tab" : "tabs"} · {formatWhen(sitting.createdAt)}
                  </span>
                </div>
                <div className="sitting-actions">
                  <button type="button" className="ghost-btn ghost-btn--small" onClick={() => onRestore(sitting)}>
                    restore
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title="forget this desk"
                    aria-label="forget this desk"
                    onClick={() => onDeleteSitting(sitting.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function HistoryView({ demo, onOpen }: { demo: boolean; onOpen: (url: string) => void }) {
  const [items, setItems] = useState<chrome.history.HistoryItem[]>(demo ? demoHistory : []);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (demo) return;
    let alive = true;
    void listHistory().then((history) => {
      if (alive) setItems(history);
    });
    return () => {
      alive = false;
    };
  }, [demo]);

  const needle = filter.trim().toLowerCase();
  const shown = needle
    ? items.filter((item) => `${item.title} ${item.url}`.toLowerCase().includes(needle))
    : items;

  return (
    <section className="view-body">
      <div className="view-head">
        <div>
          <h1>History</h1>
          <p className="view-sub">Chromium remembers every visit; Post only reads it.</p>
        </div>
        <label className="find">
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="search history"
            aria-label="search history"
            spellCheck={false}
          />
        </label>
      </div>
      {shown.length === 0 ? (
        <p className="empty">Nothing in the last ninety days matches.</p>
      ) : (
        <ul className="rows">
          {shown.map((item) => (
            <li key={item.id}>
              <button type="button" className="row" onClick={() => item.url && onOpen(item.url)}>
                <Mark url={item.url ?? ""} />
                <span className="row-main">
                  <span className="row-title">{item.title || item.url}</span>
                  <span className="row-sub">{domainOf(item.url)}</span>
                </span>
                <span className="row-when">{formatWhen(item.lastVisitTime ?? Date.now())}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function BookmarksView({ demo, onOpen }: { demo: boolean; onOpen: (url: string) => void }) {
  const [items, setItems] = useState<FlatBookmark[]>(demo ? demoBookmarks : []);

  useEffect(() => {
    if (demo) return;
    let alive = true;
    void listBookmarks().then((bookmarks) => {
      if (alive) setItems(bookmarks);
    });
    return () => {
      alive = false;
    };
  }, [demo]);

  const remove = (id: string) => {
    setItems((bookmarks) => bookmarks.filter((bookmark) => bookmark.id !== id));
    if (!demo) void removeBookmark(id);
  };

  return (
    <section className="view-body">
      <div className="view-head">
        <div>
          <h1>Bookmarks</h1>
          <p className="view-sub">
            Chromium's own bookmarks and bar. The star in the address bar is the same list.
          </p>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="empty">No bookmarks yet. The star beside the address is the whole editor.</p>
      ) : (
        <ul className="rows">
          {items.map((bookmark) => (
            <li key={bookmark.id} className="row-card">
              <button type="button" className="row" onClick={() => onOpen(bookmark.url)}>
                <Mark url={bookmark.url} />
                <span className="row-main">
                  <span className="row-title">{bookmark.title}</span>
                  <span className="row-sub">
                    {bookmark.folder ? `${bookmark.folder} · ` : ""}
                    {domainOf(bookmark.url)}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="icon-btn"
                title="remove bookmark"
                aria-label="remove bookmark"
                onClick={() => remove(bookmark.id)}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ExtensionsView({ demo }: { demo: boolean }) {
  const [items, setItems] = useState<chrome.management.ExtensionInfo[]>(demo ? demoExtensions : []);

  useEffect(() => {
    if (demo) return;
    let alive = true;
    void listExtensions().then((extensions) => {
      if (alive) setItems(extensions);
    });
    return () => {
      alive = false;
    };
  }, [demo]);

  const toggle = (extension: chrome.management.ExtensionInfo) => {
    const enabled = !extension.enabled;
    setItems((list) =>
      list.map((item) => (item.id === extension.id ? { ...item, enabled } : item)),
    );
    if (!demo) void setExtensionEnabled(extension.id, enabled);
  };

  const remove = (extension: chrome.management.ExtensionInfo) => {
    if (!demo) void removeExtension(extension.id);
  };

  return (
    <section className="view-body">
      <div className="view-head">
        <div>
          <h1>Extensions</h1>
          <p className="view-sub">
            These are Chromium's extensions, with Chromium's APIs behind them. Anything the Web
            Store installs runs here, and Post has no say in what it can do.
          </p>
        </div>
        <a
          className="ghost-btn"
          href="https://chromewebstore.google.com/"
          target="_blank"
          rel="noreferrer"
        >
          open the Web Store
          <ExternalLink size={13} />
        </a>
      </div>
      {items.length === 0 ? (
        <p className="empty">No extensions in this profile yet.</p>
      ) : (
        <ul className="rows">
          {items.map((extension) => (
            <li key={extension.id} className={`ext-row${extension.enabled ? "" : " is-off"}`}>
              <span className="ext-mark" aria-hidden="true">
                {extension.icons?.length ? (
                  <img src={extension.icons[extension.icons.length - 1].url} alt="" />
                ) : (
                  extension.name.charAt(0).toUpperCase()
                )}
              </span>
              <span className="row-main">
                <span className="row-title">
                  {extension.name}
                  <span className="ext-version tnum">{extension.version}</span>
                </span>
                <span className="row-sub">{extension.description || extension.id}</span>
              </span>
              <button type="button" className="ghost-btn ghost-btn--small" onClick={() => toggle(extension)}>
                {extension.enabled ? "turn off" : "turn on"}
              </button>
              {extension.mayDisable && (
                <button
                  type="button"
                  className="icon-btn"
                  title="remove extension"
                  aria-label="remove extension"
                  onClick={() => remove(extension)}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="footnote">
        Web Store installs are Chromium's, not Post's. That is the whole point of this shell: the
        engine underneath is the one that runs them.
      </p>
    </section>
  );
}

export function SettingsView({
  settings,
  onChange,
  shelfCount,
  onExport,
}: {
  settings: DeskSettings;
  onChange: (partial: Partial<DeskSettings>) => void;
  shelfCount: number;
  onExport: () => void;
}) {
  return (
    <section className="view-body">
      <div className="view-head">
        <div>
          <h1>Settings</h1>
          <p className="view-sub">The desk's few opinions. Everything else belongs to Chromium.</p>
        </div>
      </div>

      <div className="setting">
        <div>
          <h2>Search</h2>
          <p className="view-sub">Where words that are not an address go.</p>
        </div>
        <div className="segmented" role="group" aria-label="search engine">
          {(["duckduckgo", "google"] as const).map((engine) => (
            <button
              key={engine}
              type="button"
              className={settings.search === engine ? "is-on" : undefined}
              aria-pressed={settings.search === engine}
              onClick={() => onChange({ search: engine })}
            >
              {engine === "duckduckgo" ? "DuckDuckGo" : "Google"}
            </button>
          ))}
        </div>
      </div>

      <div className="setting">
        <div>
          <h2>Motion</h2>
          <p className="view-sub">The desk moves a little; it does not perform.</p>
        </div>
        <div className="segmented" role="group" aria-label="motion">
          {(["full", "reduced"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={settings.animations === mode ? "is-on" : undefined}
              aria-pressed={settings.animations === mode}
              onClick={() => onChange({ animations: mode })}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="setting">
        <div>
          <h2>The shelf</h2>
          <p className="view-sub">
            {shelfCount === 0
              ? "Nothing kept yet."
              : `${shelfCount} ${shelfCount === 1 ? "page" : "pages"} kept. The file is yours.`}
          </p>
        </div>
        <button type="button" className="ghost-btn" onClick={onExport}>
          <Download size={14} />
          export markdown
        </button>
      </div>

      <div className="setting setting--stack">
        <div>
          <h2>The engine</h2>
          <p className="view-sub">
            {hasChrome
              ? `The desk is inside Chromium, so every call goes to the engine itself. Extension ${chrome.runtime?.id ?? "unknown"}.`
              : "This is the demo: chrome.* is not available on this page, so nothing is saved. Load dist-shell in chrome://extensions (developer mode → Load unpacked), or start with npm run shell."}
          </p>
          <ul className="chips">
            {[
              ["tabs", "tabs"],
              ["bookmarks", "bookmarks"],
              ["history", "history"],
              ["extensions", "management"],
              ["storage", "storage"],
            ].map(([label, api]) => {
              const present =
                hasChrome &&
                typeof (chrome as unknown as Record<string, unknown>)[api] !== "undefined";
              return (
                <li key={label} className={`chip${present ? " is-on" : ""}`}>
                  {label}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="setting">
        <div>
          <h2>The window</h2>
          <p className="view-sub">
            Post is the new tab and the desk. The frame around it is Chromium's; the shell project
            replaces that frame next.
          </p>
        </div>
      </div>
    </section>
  );
}
