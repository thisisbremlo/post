import { useRef, useState } from "react";
import type { ChangeEvent } from "react";

import { Icon } from "../components/Icon";
import { parseBookmarksHtml } from "../lib/bookmarks";
import { displayAddress } from "../lib/url";
import { useStore } from "../state/store";
import type { Bookmark } from "../state/types";

/** Chrome's bookmark manager, kept to what a designer actually does here. */
export function BookmarksPage() {
  const { state, dispatch } = useStore();
  const [query, setQuery] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const items = parseBookmarksHtml(await file.text());
      if (items.length === 0) {
        dispatch({ type: "notice", text: "no bookmarks found in that file" });
        return;
      }
      dispatch({ type: "bookmark-import", items });
    } catch {
      dispatch({ type: "notice", text: "couldn't read that bookmark file" });
    }
  };

  const needle = query.trim().toLowerCase();
  const matches = state.bookmarks.filter(
    (bookmark) =>
      !needle ||
      bookmark.title.toLowerCase().includes(needle) ||
      bookmark.url.toLowerCase().includes(needle) ||
      (bookmark.folder ?? "").toLowerCase().includes(needle),
  );

  const groups = new Map<string, Bookmark[]>();
  for (const bookmark of matches) {
    const folder = bookmark.folder?.trim() || "bookmarks bar";
    const list = groups.get(folder) ?? [];
    list.push(bookmark);
    groups.set(folder, list);
  }

  return (
    <div className="page">
      <div className="page-inner">
        <header className="page-head">
          <div>
            <h1 className="page-title">bookmarks</h1>
            <p className="page-meta">the pages you keep, without a note</p>
          </div>
          <div className="page-actions">
            <input
              ref={importRef}
              type="file"
              accept=".html,.htm,text/html"
              hidden
              onChange={(event) => void importFile(event)}
            />
            <button
              type="button"
              className="text-action"
              title="import a Chrome, Firefox or Safari bookmark file"
              onClick={() => importRef.current?.click()}
            >
              <Icon name="upload" size={14} />
              import html
            </button>
          </div>
        </header>

        {state.bookmarks.length === 0 ? (
          <p className="empty">
            No bookmarks yet. The star in the address bar keeps the page you are reading.
          </p>
        ) : (
          <>
            <div className="bookmark-search">
              <Icon name="search" size={14} />
              <input
                className="bookmark-search-input"
                value={query}
                placeholder="search bookmarks"
                aria-label="search bookmarks"
                spellCheck={false}
                onChange={(event) => setQuery(event.target.value)}
              />
              <span className="bookmark-search-count tnum">
                {state.bookmarks.length} {state.bookmarks.length === 1 ? "page" : "pages"}
              </span>
            </div>

            {matches.length === 0 ? (
              <p className="empty">Nothing matches “{query.trim()}”.</p>
            ) : (
              [...groups].map(([folder, bookmarks]) => (
                <section className="bookmark-folder" key={folder}>
                  <h2 className="bookmark-folder-title">
                    {folder}
                    <span className="tnum">{bookmarks.length}</span>
                  </h2>
                  <div className="bookmark-list">
                    {bookmarks.map((bookmark) => (
                      <div className="bookmark-row" key={bookmark.id}>
                        <button
                          type="button"
                          className="bookmark-open"
                          onClick={() => dispatch({ type: "navigate", url: bookmark.url })}
                        >
                          <span className="bookmark-name">{bookmark.title}</span>
                          <span className="bookmark-url tnum">{displayAddress(bookmark.url)}</span>
                        </button>
                        <button
                          type="button"
                          className="bookmark-remove"
                          aria-label={`remove ${bookmark.title}`}
                          title="remove bookmark"
                          onClick={() => dispatch({ type: "bookmark-remove", id: bookmark.id })}
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
