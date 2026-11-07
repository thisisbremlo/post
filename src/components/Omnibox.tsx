import { useEffect, useRef, useState } from "react";

import { addressToUrl } from "../lib/url";
import { useStore } from "../state/store";
import type { Tab } from "../state/types";
import { Icon } from "./Icon";

/**
 * The address bar shows the address, because that is what this browser is
 * about. Typing something that is not an address searches.
 */
export function Omnibox({ tab }: { tab: Tab }) {
  const { dispatch } = useStore();
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

  const commit = () => {
    const next = addressToUrl(value);
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
      <button
        type="button"
        className={"omnibox-copy" + (copied ? " is-copied" : "")}
        aria-label={copied ? "address copied" : "copy address"}
        title={copied ? "copied" : "copy address"}
        onClick={copyAddress}
      >
        <Icon name={copied ? "check" : "copy"} size={13} />
      </button>
      {/* The shelf, one click from the address: the icon saves, the tag says how. */}
      <button
        type="button"
        className="omnibox-save"
        aria-label="keep this page on the shelf"
        title="keep this page on the shelf (⌘D)"
        onClick={() => window.dispatchEvent(new CustomEvent("scaffold:keep"))}
      >
        <Icon name="bookmark" size={13} />
        <span className="omnibox-save-key tnum" aria-hidden="true">
          ⌘D
        </span>
      </button>
    </div>
  );
}
