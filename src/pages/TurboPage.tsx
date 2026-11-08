import { useState } from "react";

import { Icon } from "../components/Icon";
import { relativeTime } from "../lib/time";
import { useStore } from "../state/store";

/** Every turbo note, newest first: the page the bolt's count opens. */
export function TurboPage() {
  const { state, dispatch } = useStore();
  const [query, setQuery] = useState("");
  const { notes } = state;
  const needle = query.trim().toLowerCase();
  const shown = notes.filter((note) => !needle || note.text.toLowerCase().includes(needle));

  return (
    <div className="page">
      <div className="page-inner">
        <header className="page-head">
          <div>
            <h1 className="page-title">turbo notes</h1>
            <p className="page-meta tnum">
              {notes.length} {notes.length === 1 ? "note" : "notes"} · kept on this machine
            </p>
          </div>
        </header>

        {notes.length === 0 ? (
          <p className="empty">Nothing yet. The bolt in the toolbar writes the first one.</p>
        ) : (
          <>
            <div className="bookmark-search page-search">
              <Icon name="search" size={14} />
              <input
                className="bookmark-search-input"
                value={query}
                placeholder="search turbo notes"
                aria-label="search turbo notes"
                spellCheck={false}
                onChange={(event) => setQuery(event.target.value)}
              />
              <span className="bookmark-search-count tnum">
                {shown.length} of {notes.length}
              </span>
            </div>
            {shown.length === 0 ? (
              <p className="empty">No note matches “{query.trim()}”.</p>
            ) : (
              <ul className="note-list">
                {shown.map((note) => (
              <li className="note-row" key={note.id}>
                <p className="note-text">{note.text}</p>
                <span className="note-time tnum">{relativeTime(note.createdAt)}</span>
                <button
                  type="button"
                  className="icon-btn note-delete"
                  aria-label={`delete ${note.text}`}
                  title="delete this note"
                  onClick={() => dispatch({ type: "note-remove", id: note.id })}
                >
                  <Icon name="trash" size={13} />
                </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <p className="fineprint">
          One line each, saved the moment you press Enter. They live in this profile with the desk,
          so they are not synced, not shared, and gone if the profile is.
        </p>
      </div>
    </div>
  );
}
