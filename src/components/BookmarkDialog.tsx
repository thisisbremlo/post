import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { displayAddress } from "../lib/url";
import { useStore } from "../state/store";
import type { Tab } from "../state/types";

/**
 * Chrome's star, in Post's hand: the page is already bookmarked when this opens,
 * so the only decisions are its name and which folder it belongs in.
 */
export function BookmarkDialog({ tab, onClose }: { tab: Tab; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const existing = state.bookmarks.find((bookmark) => bookmark.url === tab.url);
  const [title, setTitle] = useState(existing?.title ?? tab.title);
  const [folder, setFolder] = useState(existing?.folder ?? "");
  const nameRef = useRef<HTMLInputElement>(null);

  const folders = [
    ...new Set(
      state.bookmarks
        .map((bookmark) => bookmark.folder)
        .filter((name): name is string => Boolean(name)),
    ),
  ];

  useEffect(() => {
    nameRef.current?.focus();
    nameRef.current?.select();
  }, []);

  const save = () => {
    if (existing) {
      dispatch({ type: "bookmark-update", id: existing.id, title, folder });
    } else {
      dispatch({ type: "bookmark-add", url: tab.url, title, folder });
    }
    onClose();
  };

  const remove = () => {
    if (existing) dispatch({ type: "bookmark-remove", id: existing.id });
    onClose();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      save();
    }
    if (event.key === "Escape") onClose();
  };

  return (
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="keep bookmark-dialog" role="dialog" aria-modal="true" aria-label="Bookmark">
        <p className="bookmark-kicker">{existing ? "Bookmark" : "New Bookmark"}</p>
        <p className="keep-title">{tab.title}</p>
        <p className="keep-address tnum">{displayAddress(tab.url)}</p>

        <div className="bookmark-fields">
          <label className="bookmark-field">
            <span className="bookmark-label">Name</span>
            <input
              ref={nameRef}
              className="keep-note bookmark-input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={onKeyDown}
            />
          </label>
          <label className="bookmark-field">
            <span className="bookmark-label">Folder</span>
            <input
              className="keep-note bookmark-input"
              value={folder}
              list="bookmark-folders"
              placeholder="Bookmarks Bar"
              onChange={(event) => setFolder(event.target.value)}
              onKeyDown={onKeyDown}
            />
          </label>
          <datalist id="bookmark-folders">
            {folders.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>

        <div className="bookmark-actions">
          {existing && (
            <button type="button" className="bookmark-delete" onClick={remove}>
              Remove
            </button>
          )}
          <span className="bookmark-hint tnum">↵ Save · Esc to Close</span>
          <button type="button" className="bookmark-save" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
