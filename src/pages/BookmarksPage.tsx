import { useRef, useState } from "react";
import type { ChangeEvent } from "react";

import { Icon } from "../components/Icon";
import { parseBookmarksHtml } from "../lib/bookmarks";
import { displayAddress } from "../lib/url";
import { useStore } from "../state/store";
import type { Bookmark } from "../state/types";

const BOOKMARKS_BAR = "Bookmarks Bar";

function folderOf(bookmark: Bookmark): string {
  return bookmark.folder?.trim() || BOOKMARKS_BAR;
}

function BookmarkRow({ bookmark }: { bookmark: Bookmark }) {
  const { dispatch } = useStore();

  return (
    <div className="library-row">
      <button
        type="button"
        className="library-open"
        onClick={() => dispatch({ type: "navigate", url: bookmark.url })}
      >
        <span className="library-open-mark">
          <Icon name="bookmark" size={12} />
        </span>
        <span className="library-open-copy">
          <span className="library-open-title">{bookmark.title}</span>
          <span className="library-open-url tnum">{displayAddress(bookmark.url)}</span>
        </span>
        <span className="library-open-arrow">
          <Icon name="arrow-up-right" size={13} />
        </span>
      </button>
      <button
        type="button"
        className="library-remove"
        aria-label={`Remove ${bookmark.title}`}
        title="Remove Bookmark"
        onClick={() => dispatch({ type: "bookmark-remove", id: bookmark.id })}
      >
        <Icon name="trash" size={13} />
      </button>
    </div>
  );
}

export function BookmarksPage() {
  const { state, dispatch } = useStore();
  const [query, setQuery] = useState("");
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const items = parseBookmarksHtml(await file.text());
      if (items.length === 0) {
        dispatch({ type: "notice", text: "No bookmarks found in that file." });
        return;
      }
      dispatch({ type: "bookmark-import", items });
    } catch {
      dispatch({ type: "notice", text: "Could not read that bookmarks file." });
    }
  };

  const folderCounts = new Map<string, number>();
  for (const bookmark of state.bookmarks) {
    const folder = folderOf(bookmark);
    folderCounts.set(folder, (folderCounts.get(folder) ?? 0) + 1);
  }

  const folders = [...folderCounts.entries()]
    .sort(([left], [right]) => {
      if (left === BOOKMARKS_BAR) return -1;
      if (right === BOOKMARKS_BAR) return 1;
      return left.localeCompare(right);
    })
    .map(([name, count]) => ({ name, count }));

  const needle = query.trim().toLowerCase();
  const matches = state.bookmarks.filter(
    (bookmark) =>
      !needle ||
      bookmark.title.toLowerCase().includes(needle) ||
      bookmark.url.toLowerCase().includes(needle) ||
      folderOf(bookmark).toLowerCase().includes(needle),
  );

  const groups = folders
    .map(({ name }) => ({
      folder: name,
      bookmarks: matches.filter((bookmark) => folderOf(bookmark) === name),
    }))
    .filter((group) => group.bookmarks.length > 0);

  const selectedFolder =
    folderFilter !== null && folders.some((folder) => folder.name === folderFilter)
      ? folderFilter
      : null;
  const visibleGroups =
    selectedFolder === null
      ? groups
      : groups.filter((group) => group.folder === selectedFolder);

  const total = state.bookmarks.length;

  return (
    <div className="page settings-page">
      <div className="settings-shell">
        <header className="settings-header">
          <div className="settings-heading">
            <p className="settings-kicker">Saved Pages</p>
            <h1 className="settings-title">Bookmarks</h1>
            <p className="settings-intro">
              The pages you keep, gathered by folder and ready to open again. Everything stays on
              this device.
            </p>
          </div>
          <aside className="settings-local">
            <span className="settings-local-icon">
              <Icon name="bookmark" size={14} />
            </span>
            <div>
              <strong>
                {total} {total === 1 ? "Bookmark" : "Bookmarks"}
              </strong>
              <span>
                {folders.length === 0
                  ? "Nothing saved on this device yet."
                  : `${folders.length} ${folders.length === 1 ? "folder" : "folders"} on this device.`}
              </span>
            </div>
          </aside>
        </header>

        <div className="settings-layout">
          <nav className="settings-nav" aria-label="Bookmark folders">
            <button
              type="button"
              className={"settings-nav-item" + (selectedFolder === null ? " is-active" : "")}
              aria-pressed={selectedFolder === null}
              onClick={() => setFolderFilter(null)}
            >
              <Icon name="bookmark" size={15} />
              <span className="library-nav-label">All Bookmarks</span>
              <span className="library-nav-count tnum">{total}</span>
            </button>
            {folders.map((folder) => (
              <button
                key={folder.name}
                type="button"
                className={
                  "settings-nav-item" + (selectedFolder === folder.name ? " is-active" : "")
                }
                aria-pressed={selectedFolder === folder.name}
                onClick={() => setFolderFilter(folder.name)}
              >
                <Icon name="library" size={15} />
                <span className="library-nav-label">{folder.name}</span>
                <span className="library-nav-count tnum">{folder.count}</span>
              </button>
            ))}
          </nav>

          <div className="settings-content">
            <section className="settings-group library-toolbar-card">
              <div className="library-toolbar">
                {total > 0 ? (
                  <div className="library-search" role="search">
                    <Icon name="search" size={14} />
                    <input
                      value={query}
                      placeholder="Search Bookmarks"
                      aria-label="Search Bookmarks"
                      spellCheck={false}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                    {query.trim() && (
                      <>
                        <span className="library-count tnum">
                          {matches.length} of {total}
                        </span>
                        <button
                          type="button"
                          className="library-search-clear"
                          aria-label="Clear Search"
                          title="Clear Search"
                          onClick={() => setQuery("")}
                        >
                          <Icon name="close" size={12} />
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="library-toolbar-note">
                    Save a page with Keep to begin your library.
                  </p>
                )}
                <input
                  ref={importRef}
                  type="file"
                  accept=".html,.htm,text/html"
                  hidden
                  onChange={(event) => void importFile(event)}
                />
                <button
                  type="button"
                  className="setting-action is-secondary"
                  title="Import a Chrome, Firefox, or Safari bookmarks file"
                  onClick={() => importRef.current?.click()}
                >
                  <Icon name="upload" size={13} />
                  Import HTML
                </button>
              </div>
            </section>

            {total === 0 ? (
              <section className="settings-group library-state">
                <span className="library-state-icon">
                  <Icon name="bookmark" size={22} />
                </span>
                <h2>No Bookmarks Yet</h2>
                <p>
                  Press Keep in the address bar, or use ⌘D, to save the page in front of you.
                </p>
              </section>
            ) : visibleGroups.length === 0 ? (
              <section className="settings-group library-state">
                <span className="library-state-icon">
                  <Icon name="search" size={22} />
                </span>
                <h2>No Matching Bookmarks</h2>
                <p>Nothing in your library matches “{query.trim()}”.</p>
                <button
                  type="button"
                  className="setting-action"
                  onClick={() => setQuery("")}
                >
                  Clear Search
                </button>
              </section>
            ) : (
              visibleGroups.map((group, index) => (
                <section className="settings-group" key={group.folder}>
                  <header className="settings-group-head">
                    <span className="settings-group-index tnum">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h2>{group.folder}</h2>
                      <p>
                        {group.bookmarks.length}{" "}
                        {group.bookmarks.length === 1 ? "page" : "pages"}
                        {query.trim() ? " matching your search." : " in this folder."}
                      </p>
                    </div>
                  </header>
                  <div className="settings-list">
                    {group.bookmarks.map((bookmark) => (
                      <BookmarkRow key={bookmark.id} bookmark={bookmark} />
                    ))}
                  </div>
                </section>
              ))
            )}

            <p className="settings-fineprint">
              Bookmarks are stored with this desk and stay on this device.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
