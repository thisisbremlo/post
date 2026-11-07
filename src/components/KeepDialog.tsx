import { useEffect, useRef, useState } from "react";

import { displayAddress } from "../lib/url";
import { useStore } from "../state/store";
import type { Tab } from "../state/types";

/**
 * ⌘⇧D. One line, already focused, address above it. The note is the product:
 * a bookmark without a reason is a dead link with extra steps.
 */
export function KeepDialog({ tab, onClose }: { tab: Tab; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const existing = state.shelf.find((page) => page.url === tab.url);
  const [note, setNote] = useState(existing?.note ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

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
      <div className="keep" role="dialog" aria-modal="true" aria-label="keep this page">
        <p className="keep-title">{tab.title}</p>
        {displayAddress(tab.url) !== tab.title && (
          <p className="keep-address tnum">{displayAddress(tab.url)}</p>
        )}
        <div className="keep-field">
          <input
            ref={inputRef}
            className="keep-note"
            value={note}
            placeholder="why this one?"
            aria-label="why this one"
            onChange={(event) => setNote(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                keep();
              }
              if (event.key === "Escape") onClose();
            }}
          />
        </div>
        <div className="keep-foot">
          <span className="tnum">{existing ? "↵ update the note · esc cancel" : "↵ keep · esc cancel"}</span>
          <span className="tnum">
            {state.shelf.length} {state.shelf.length === 1 ? "page" : "pages"} on the shelf
          </span>
        </div>
      </div>
    </div>
  );
}
