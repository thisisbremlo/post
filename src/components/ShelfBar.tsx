import { useState } from "react";

import { downloadMarkdown, shelfToMarkdown } from "../lib/markdown";
import { fileStamp, relativeTime } from "../lib/time";
import { parseDomain } from "../lib/url";
import { useStore } from "../state/store";
import type { KeptPage } from "../state/types";
import { Icon } from "./Icon";

export function ShelfBar() {
  const { state, dispatch } = useStore();
  const [editing, setEditing] = useState<string | null>(null);

  if (!state.shelfBarOpen || state.shelf.length === 0) return null;

  const exportShelf = () => {
    downloadMarkdown(`scaffold-shelf-${fileStamp(Date.now())}.md`, shelfToMarkdown(state.shelf));
    dispatch({ type: "notice", text: "shelf exported as markdown" });
  };

  return (
    <footer className="shelf" aria-label="shelf">
      <div className="shelf-head">
        <div className="shelf-head-row">
          <span className="shelf-label">shelf</span>
          <span className="shelf-count tnum">{state.shelf.length}</span>
          <button
            type="button"
            className="icon-btn shelf-hide"
            aria-label="hide shelf"
            title="hide the shelf bar"
            onClick={() => dispatch({ type: "shelf-bar", open: false })}
          >
            <Icon name="chevron-down" size={14} />
          </button>
        </div>
        <div className="shelf-head-row">
          <button
            type="button"
            className="text-action"
            onClick={() => dispatch({ type: "navigate", url: "scaffold://shelf" })}
          >
            open
          </button>
          <button type="button" className="text-action" onClick={exportShelf}>
            export
          </button>
        </div>
      </div>

      <div className="shelf-cards">
        {state.shelf.map((page: KeptPage) => (
          <article
            key={page.id}
            className="card"
            data-card-id={page.id}
            tabIndex={0}
            role="link"
            aria-label={`open ${page.title}`}
            onClick={() => dispatch({ type: "open-tab", url: page.url })}
            onKeyDown={(event) => {
              if (event.key === "Enter") dispatch({ type: "open-tab", url: page.url });
            }}
          >
            <div className="card-top">
              <h3 className="card-title">{page.title}</h3>
              <span className="card-domain tnum">{parseDomain(page.url)}</span>
            </div>
            {editing === page.id ? (
              <input
                className="card-note-edit"
                autoFocus
                defaultValue={page.note}
                aria-label="note"
                onClick={(event) => event.stopPropagation()}
                onBlur={(event) => {
                  dispatch({ type: "update-note", id: page.id, note: event.target.value });
                  setEditing(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                  if (event.key === "Escape") setEditing(null);
                }}
              />
            ) : (
              <p
                className={"card-note" + (page.note ? "" : " is-empty")}
                title="click to edit the note"
                onClick={(event) => {
                  event.stopPropagation();
                  setEditing(page.id);
                }}
              >
                {page.note || "add a reason"}
              </p>
            )}
            <p className="card-foot tnum">{relativeTime(page.keptAt)}</p>
          </article>
        ))}
      </div>
    </footer>
  );
}
