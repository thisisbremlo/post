import { useEffect, useState } from "react";

import type { PageMeta } from "../lib/bridge";
import { displayAddress } from "../lib/url";
import type { Tab } from "../state/types";
import { Icon } from "./Icon";

/**
 * Every field the page declares about itself, in one place. The tab menu copies
 * the three that get used daily; this is for the rest — and for reading a page's
 * own account of itself without opening the inspector.
 */
export function MetaSheet({
  tab,
  meta,
  onClose,
}: {
  tab: Tab;
  meta: PageMeta;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const rows: { label: string; value: string }[] = [];
  const add = (label: string, value: string) => {
    if (value) rows.push({ label, value });
  };
  add("title", meta.title);
  add("address", tab.url);
  add("description", meta.description);
  add("canonical", meta.canonical);
  add("language", meta.lang);
  add("theme colour", meta.themeColor);
  for (const [key, value] of Object.entries(meta.openGraph)) add(`og:${key}`, value);
  for (const [key, value] of Object.entries(meta.twitter)) add(`twitter:${key}`, value);

  const all = JSON.stringify({ url: tab.url, ...meta }, null, 2);
  const structured = JSON.stringify(meta.jsonLd, null, 2);

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied((current) => (current === label ? null : current)), 1400);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="meta" role="dialog" aria-modal="true" aria-label="page details">
        <header className="meta-head">
          <div>
            <p className="meta-title">{meta.title || displayAddress(tab.url)}</p>
            <p className="meta-address tnum">{displayAddress(tab.url)}</p>
          </div>
          <button type="button" className="meta-close" aria-label="close" onClick={onClose}>
            <Icon name="close" size={13} />
          </button>
        </header>

        <div className="meta-scroll">
          {rows.length === 0 && <p className="meta-empty">this page declares nothing about itself.</p>}

          {rows.map((row) => (
            <div className="meta-row" key={row.label + row.value}>
              <span className="meta-label tnum">{row.label}</span>
              <p className="meta-value">{row.value}</p>
              <button
                type="button"
                className="meta-copy"
                aria-label={`copy ${row.label}`}
                onClick={() => void copy(row.value, row.label)}
              >
                <Icon name={copied === row.label ? "check" : "copy"} size={12} />
              </button>
            </div>
          ))}

          {meta.jsonLd.length > 0 && (
            <section className="meta-block">
              <span className="meta-label tnum">structured data</span>
              <pre className="meta-pre">{structured}</pre>
              <button
                type="button"
                className="meta-copy"
                aria-label="copy structured data"
                onClick={() => void copy(structured, "structured data")}
              >
                <Icon name={copied === "structured data" ? "check" : "copy"} size={12} />
              </button>
            </section>
          )}
        </div>

        <footer className="meta-foot">
          <span className="tnum">
            {rows.length} {rows.length === 1 ? "field" : "fields"}
          </span>
          <button type="button" className="meta-all" onClick={() => void copy(all, "everything")}>
            <Icon name={copied === "everything" ? "check" : "copy"} size={12} />
            {copied === "everything" ? "copied" : "copy all as JSON"}
          </button>
        </footer>
      </div>
    </div>
  );
}
