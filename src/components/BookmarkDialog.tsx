import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { Icon } from "./Icon";
import { displayAddress } from "../lib/url";
import { useStore } from "../state/store";
import type { Tab } from "../state/types";

/**
 * The page is already bookmarked when this opens, so the only decisions are
 * its name and which folder it belongs in.
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
      <div
        className="keep editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-dialog-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        <header className="editor-dialog-head">
          <span className="editor-dialog-mark">
            <Icon name="bookmark" size={15} />
          </span>
          <div className="editor-dialog-heading">
            <p className="editor-kicker">Saved Pages</p>
            <h2 className="editor-dialog-title" id="editor-dialog-title">
              {existing ? "Edit Bookmark" : "New Bookmark"}
            </h2>
          </div>
          <button
            type="button"
            className="editor-close"
            aria-label="Close"
            title="Close"
            onClick={onClose}
          >
            <Icon name="close" size={14} />
          </button>
        </header>

        <div className="editor-source">
          <span className="editor-source-icon">
            <Icon name="globe" size={14} />
          </span>
          <div className="editor-source-copy">
            <p className="editor-source-title">{tab.title}</p>
            <p className="editor-source-url tnum">{displayAddress(tab.url)}</p>
          </div>
        </div>

        <div className="editor-form">
          <label className="editor-field">
            <span className="editor-label">Name</span>
            <input
              ref={nameRef}
              className="setting-input"
              value={title}
              placeholder="Page Name"
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={onKeyDown}
            />
          </label>
          <label className="editor-field">
            <span className="editor-label">Folder</span>
            <input
              className="setting-input"
              value={folder}
              list="bookmark-folders"
              placeholder="Bookmarks Bar"
              onChange={(event) => setFolder(event.target.value)}
              onKeyDown={onKeyDown}
            />
            <span className="editor-field-note">Leave blank to use the Bookmarks Bar.</span>
          </label>
          <datalist id="bookmark-folders">
            {folders.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>

        <footer className="editor-actions">
          <div className="editor-actions-meta">
            {existing && (
              <button
                type="button"
                className="setting-action is-secondary editor-delete"
                onClick={remove}
              >
                <Icon name="trash" size={13} />
                Remove
              </button>
            )}
            <span className="editor-hint tnum">↵ Save · Esc to Close</span>
          </div>
          <button type="button" className="setting-action" onClick={save}>
            Save
          </button>
        </footer>
      </div>
    </div>
  );
}
