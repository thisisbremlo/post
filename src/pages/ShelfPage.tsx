import { useState } from "react";

import { downloadMarkdown, shelfToMarkdown } from "../lib/markdown";
import { fileStamp, shortDate } from "../lib/time";
import { displayAddress, parseDomain } from "../lib/url";
import { useStore } from "../state/store";
import type { KeptPage } from "../state/types";
import { Icon } from "../components/Icon";

function NoteField({ page, compact = false }: { page: KeptPage; compact?: boolean }) {
  const { dispatch } = useStore();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(page.note);

  const save = () => {
    dispatch({ type: "update-note", id: page.id, note: value.trim() });
    setEditing(false);
  };

  if (editing) {
    return (
      <textarea
        className="note-edit"
        autoFocus
        value={value}
        aria-label="note"
        onChange={(event) => setValue(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            save();
          }
          if (event.key === "Escape") {
            setValue(page.note);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <p
      className={"catalogue-note" + (page.note ? "" : " is-empty") + (compact ? " is-compact" : "")}
      title="click to edit the note"
      onClick={() => {
        setValue(page.note);
        setEditing(true);
      }}
    >
      {page.note || "no reason recorded — click to add one"}
    </p>
  );
}

export function ShelfPage() {
  const { state, dispatch } = useStore();
  const [query, setQuery] = useState("");
  const withNotes = state.shelf.filter((page) => page.note.trim().length > 0).length;
  const ratio = state.shelf.length > 0 ? Math.round((withNotes / state.shelf.length) * 100) : 0;
  const needle = query.trim().toLowerCase();
  const pages = state.shelf.filter(
    (page) =>
      !needle ||
      page.title.toLowerCase().includes(needle) ||
      page.url.toLowerCase().includes(needle) ||
      page.note.toLowerCase().includes(needle),
  );

  const exportShelf = () => {
    downloadMarkdown(`scaffold-shelf-${fileStamp(Date.now())}.md`, shelfToMarkdown(state.shelf));
    dispatch({ type: "notice", text: "shelf exported as markdown" });
  };

  return (
    <div className="page">
      <div className="page-inner">
        <header className="page-head">
          <div>
            <h1 className="page-title">shelf</h1>
            <p className="page-meta tnum">
              {state.shelf.length} kept · {ratio}% with a note
            </p>
          </div>
          {state.shelf.length > 0 && (
            <div className="page-actions">
              <button type="button" className="text-action" onClick={exportShelf}>
                <Icon name="export" size={14} />
                export markdown
              </button>
            </div>
          )}
        </header>

        {state.shelf.length === 0 ? (
          <p className="empty">
            Nothing kept yet. Press ⌘⇧D on a page worth remembering, and say why in one line.
          </p>
        ) : (
          <>
            <div className="bookmark-search page-search">
              <Icon name="search" size={14} />
              <input
                className="bookmark-search-input"
                value={query}
                placeholder="search the shelf"
                aria-label="search the shelf"
                spellCheck={false}
                onChange={(event) => setQuery(event.target.value)}
              />
              <span className="bookmark-search-count tnum">
                {pages.length} of {state.shelf.length}
              </span>
            </div>
            {pages.length === 0 ? (
              <p className="empty">Nothing on the shelf matches “{query.trim()}”.</p>
            ) : (
              <div className="catalogue">
                {pages.map((page) => (
              <article className="catalogue-card" key={page.id}>
                <div className="catalogue-top">
                  <span className="catalogue-domain tnum">{parseDomain(page.url)}</span>
                  <button
                    type="button"
                    className="icon-btn catalogue-remove"
                    aria-label={`remove ${page.title}`}
                    title="remove from the shelf"
                    onClick={() => dispatch({ type: "remove-card", id: page.id })}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
                <h2 className="catalogue-title">
                  <button
                    type="button"
                    className="catalogue-link"
                    onClick={() => dispatch({ type: "open-tab", url: page.url })}
                  >
                    {page.title}
                  </button>
                </h2>
                {displayAddress(page.url) !== parseDomain(page.url) && (
                  <p className="catalogue-url tnum">{displayAddress(page.url)}</p>
                )}
                <NoteField page={page} />
                <p className="catalogue-foot tnum">kept {shortDate(page.keptAt)}</p>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
