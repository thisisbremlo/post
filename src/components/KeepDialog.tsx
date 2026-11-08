import { useEffect, useRef, useState } from "react";

import { Icon } from "./Icon";
import { displayAddress } from "../lib/url";
import { useStore } from "../state/store";
import type { Tab } from "../state/types";

/**
 * ⌘⇧D. The note is the product: a bookmark without a reason is a dead link
 * with extra steps. The editor opens with the note focused.
 */
export function KeepDialog({ tab, onClose }: { tab: Tab; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const existing = state.shelf.find((page) => page.url === tab.url);
  const [note, setNote] = useState(existing?.note ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const address = displayAddress(tab.url);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const keep = () => {
    dispatch({ type: "keep", tabId: tab.id, note });
    onClose();
  };

  return (
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="keep editor-dialog keep-note-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="keep-dialog-title"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        <header className="editor-dialog-head">
          <span className="editor-dialog-mark">
            <Icon name="library" size={15} />
          </span>
          <div className="editor-dialog-heading">
            <p className="editor-kicker">The Shelf</p>
            <h2 className="editor-dialog-title" id="keep-dialog-title">
              {existing ? "Edit Note" : "Keep This Page"}
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
            {address !== tab.title && (
              <p className="editor-source-url tnum">{address}</p>
            )}
          </div>
        </div>

        <div className="editor-form">
          <label className="editor-field">
            <span className="editor-label">Note</span>
            <input
              ref={inputRef}
              className="setting-input"
              value={note}
              placeholder="Why This Page?"
              onChange={(event) => setNote(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  keep();
                }
              }}
            />
            <span className="editor-field-note">
              Notes stay with the page on your shelf.
            </span>
          </label>
        </div>

        <footer className="editor-actions">
          <div className="editor-actions-meta">
            <span className="editor-hint tnum">
              {existing ? "↵ Save · Esc to Close" : "↵ Keep · Esc to Close"}
            </span>
            <span className="keep-shelf-count tnum">
              {state.shelf.length} {state.shelf.length === 1 ? "page" : "pages"} on the shelf
            </span>
          </div>
          <button type="button" className="setting-action" onClick={keep}>
            {existing ? "Save Note" : "Keep"}
          </button>
        </footer>
      </div>
    </div>
  );
}
