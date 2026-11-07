import { useEffect, useMemo, useRef, useState } from "react";

import { relativeTime } from "../lib/time";
import { addressToUrl, looksLikeAddress, normalizeAddress, parseDomain } from "../lib/url";
import { useStore } from "../state/store";
import type { IconName } from "./Icon";
import { Icon } from "./Icon";

type ResultKind = "address" | "tab" | "shelf" | "history";

interface Result {
  key: string;
  kind: ResultKind;
  title: string;
  meta: string;
  url: string;
  tabId?: string;
}

const ICONS: Record<ResultKind, IconName> = {
  address: "arrow-up-right",
  tab: "tab",
  shelf: "sheets",
  history: "clock",
};

const GROUPS: { kind: ResultKind; label: string }[] = [
  { kind: "tab", label: "open tabs" },
  { kind: "shelf", label: "shelf" },
  { kind: "history", label: "history" },
];

/**
 * ⌘K. Tabs, kept pages and history together, notes searchable, deduped by
 * address. When what you typed looks like an address, it sits at the top.
 */
export function Palette({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo<Result[]>(() => {
    const trimmed = query.trim();
    const q = trimmed.toLowerCase();
    const seen = new Set<string>();
    const out: Result[] = [];

    if (trimmed) {
      const address = looksLikeAddress(trimmed);
      out.push({
        key: "address",
        kind: "address",
        title: address ? normalizeAddress(trimmed) : `search for “${trimmed}”`,
        meta: address ? "address" : "search",
        url: addressToUrl(trimmed),
      });
    }

    const matches = (value: string) => value.toLowerCase().includes(q);

    for (const tab of state.tabs) {
      if (q && !matches(tab.title) && !matches(tab.url)) continue;
      if (seen.has(tab.url)) continue;
      seen.add(tab.url);
      out.push({
        key: `tab-${tab.id}`,
        kind: "tab",
        title: tab.title,
        meta: parseDomain(tab.url),
        url: tab.url,
        tabId: tab.id,
      });
    }

    for (const page of state.shelf) {
      if (q && !matches(page.title) && !matches(page.url) && !matches(page.note)) continue;
      if (seen.has(page.url)) continue;
      seen.add(page.url);
      out.push({
        key: `shelf-${page.id}`,
        kind: "shelf",
        title: page.title,
        meta: page.note || parseDomain(page.url),
        url: page.url,
      });
    }

    for (const entry of state.history) {
      if (q && !matches(entry.title) && !matches(entry.url)) continue;
      if (seen.has(entry.url)) continue;
      seen.add(entry.url);
      out.push({
        key: `history-${entry.id}`,
        kind: "history",
        title: entry.title,
        meta: `${parseDomain(entry.url)} · ${relativeTime(entry.visitedAt)}`,
        url: entry.url,
      });
      if (out.length > 40) break;
    }

    return out;
  }, [query, state.tabs, state.shelf, state.history]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  useEffect(() => {
    const current = listRef.current?.querySelector<HTMLElement>(".palette-row.is-current");
    current?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const go = (result: Result) => {
    if (result.kind === "tab" && result.tabId) {
      dispatch({ type: "activate-tab", id: result.tabId });
    } else if (result.kind === "address" || result.kind === "history") {
      dispatch({ type: "navigate", url: result.url });
    } else {
      dispatch({ type: "open-tab", url: result.url });
    }
    onClose();
  };

  const grouped = GROUPS.map((group) => ({
    ...group,
    items: results.filter((result) => result.kind === group.kind),
  })).filter((group) => group.items.length > 0);

  const addressResult = results.find((result) => result.kind === "address");
  const flat = [...(addressResult ? [addressResult] : []), ...grouped.flatMap((group) => group.items)];

  return (
    <div
      className="overlay overlay--palette"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label="catalogue">
        <div className="palette-input-row">
          <input
            ref={inputRef}
            className="palette-input"
            value={query}
            placeholder="tabs, shelf, history, or an address"
            aria-label="search the catalogue"
            spellCheck={false}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setIndex((value) => Math.min(value + 1, flat.length - 1));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setIndex((value) => Math.max(value - 1, 0));
              }
              if (event.key === "Enter" && flat[index]) {
                event.preventDefault();
                go(flat[index]);
              }
              if (event.key === "Escape") onClose();
            }}
          />
          <span className="palette-hint tnum">esc</span>
        </div>

        <div className="palette-groups" ref={listRef}>
          {addressResult && (
            <button
              type="button"
              className={"palette-row" + (index === 0 ? " is-current" : "")}
              onMouseEnter={() => setIndex(0)}
              onClick={() => go(addressResult)}
            >
              <span className="palette-icon">
                <Icon name={ICONS.address} size={16} />
              </span>
              <span className="palette-title">{addressResult.title}</span>
              <span className="palette-meta tnum">{addressResult.meta}</span>
            </button>
          )}

          {grouped.map((group) => (
            <div key={group.kind}>
              <p className="palette-group-label">{group.label}</p>
              {group.items.map((result) => {
                const position = flat.indexOf(result);
                return (
                  <button
                    key={result.key}
                    type="button"
                    className={"palette-row" + (position === index ? " is-current" : "")}
                    onMouseEnter={() => setIndex(position)}
                    onClick={() => go(result)}
                  >
                    <span className="palette-icon">
                      <Icon name={ICONS[result.kind]} size={16} />
                    </span>
                    <span className="palette-title">{result.title}</span>
                    {result.meta !== result.title && (
                      <span className="palette-meta tnum">{result.meta}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {flat.length === 0 && (
            <p className="palette-empty">
              {query ? `nothing matches “${query}”` : "nothing kept yet — no notes to search"}
            </p>
          )}
        </div>

        <div className="palette-foot tnum">
          <span>↑↓ move</span>
          <span>↵ open</span>
          <span>⌘D keep</span>
          <span>⌘⇧R hold</span>
          <span className="palette-foot-right">{state.shelf.length} on the shelf</span>
        </div>
      </div>
    </div>
  );
}

