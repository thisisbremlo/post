import { useEffect, useRef, useState } from "react";

import { addressToUrl, internalPageOf } from "../lib/url";
import { useStore } from "../state/store";
import type { Tab } from "../state/types";
import { Icon } from "./Icon";

/**
 * The address bar shows the address, because that is what this browser is
 * about. Typing something that is not an address searches.
 */
export function Omnibox({ tab }: { tab: Tab }) {
  const { state, dispatch } = useStore();
  const [value, setValue] = useState(tab.url);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const copyTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!editing) setValue(tab.url);
  }, [tab.url, editing]);

  useEffect(() => () => {
    if (copyTimer.current) window.clearTimeout(copyTimer.current);
  }, []);

  // Copying is a plain text write. If the clipboard API is unavailable (an
  // unfocused document, an old shell), fall back to a hidden field and exec.
  // The confirmation only appears when one of the two actually worked.
  const copyAddress = async () => {
    let written = true;
    try {
      await navigator.clipboard.writeText(tab.url);
    } catch {
      const field = document.createElement("textarea");
      field.value = tab.url;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      written = document.execCommand("copy");
      field.remove();
    }
    if (!written) {
      dispatch({ type: "notice", text: "couldn't copy — select the address instead" });
      return;
    }
    setCopied(true);
    dispatch({ type: "notice", text: "address copied" });
    if (copyTimer.current) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), 1400);
  };

  useEffect(() => {
    const focus = () => {
      setEditing(true);
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener("scaffold:address", focus);
    return () => window.removeEventListener("scaffold:address", focus);
  }, []);

  const internal = internalPageOf(tab.url) !== null;
  const kept = state.shelf.some((page) => page.url === tab.url);
  const bookmarked = state.bookmarks.some((bookmark) => bookmark.url === tab.url);

  const commit = () => {
    const next = addressToUrl(value, state.settings.search);
    if (next !== tab.url) dispatch({ type: "navigate", tabId: tab.id, url: next });
    else if (next.startsWith("http")) dispatch({ type: "reload", tabId: tab.id });
    setEditing(false);
    inputRef.current?.blur();
  };

  return (
    <div className="omnibox">
      <input
        ref={inputRef}
        className="omnibox-input"
        value={value}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect="off"
        aria-label="address"
        placeholder="type an address"
        onChange={(event) => setValue(event.target.value)}
        onFocus={(event) => {
          setEditing(true);
          event.currentTarget.select();
        }}
        onBlur={() => {
          setEditing(false);
          setValue(tab.url);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
          if (event.key === "Escape") {
            setValue(tab.url);
            setEditing(false);
            inputRef.current?.blur();
          }
        }}
      />
      {/*
       * The shelf sits in the address, but it says what it does: a word, not a
       * keycap. Kept pages say so, and open the note again instead of re-saving.
       */}
      <div className="omnibox-actions">
        {!internal && (
          <button
            type="button"
            className={"omnibox-save" + (kept ? " is-kept" : "")}
            aria-label={kept ? "on the shelf — edit the note" : "keep this page on the shelf"}
            title={kept ? "on the shelf — edit the note (⌘⇧D)" : "keep this page on the shelf (⌘⇧D)"}
            onClick={() => window.dispatchEvent(new CustomEvent("scaffold:keep"))}
          >
            <Icon name="bookmark" size={12} />
            <span className="omnibox-save-word">{kept ? "kept" : "keep"}</span>
          </button>
        )}
        <button
          type="button"
          className={"omnibox-copy" + (copied ? " is-copied" : "")}
          aria-label={copied ? "address copied" : "copy address"}
          title={copied ? "copied" : "copy address"}
          onClick={copyAddress}
        >
          <Icon name={copied ? "check" : "copy"} size={13} />
        </button>
        {!internal && (
          <button
            type="button"
            className={"omnibox-star" + (bookmarked ? " is-bookmarked" : "")}
            aria-label={bookmarked ? "edit this bookmark" : "bookmark this page"}
            aria-pressed={bookmarked}
            title={bookmarked ? "edit this bookmark (⌘D)" : "bookmark this page (⌘D)"}
            onClick={() => window.dispatchEvent(new CustomEvent("scaffold:bookmark"))}
          >
            <Icon name="star" size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
