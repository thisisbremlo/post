import type { InternalPage } from "../state/types";

const INTERNAL_TITLES: Record<InternalPage, string> = {
  start: "a blank sheet",
  history: "history",
  shelf: "shelf",
  sittings: "sittings",
  passwords: "passwords",
};

const INTERNAL_PAGES = Object.keys(INTERNAL_TITLES) as InternalPage[];

export const SEARCH_URL = "https://duckduckgo.com/?q=";

/** A search is the fallback, so this only has to recognise addresses. */
export function looksLikeAddress(input: string): boolean {
  const value = input.trim();
  if (!value || /\s/.test(value)) return false;
  if (/^[a-z]+:\/\//i.test(value)) return true;
  return /^[^\s/]+\.[^\s]{2,}(\/.*)?$/i.test(value) || /^localhost(:\d+)?(\/.*)?$/.test(value);
}

export function normalizeAddress(input: string): string {
  const value = input.trim();
  if (!value) return "scaffold://start";
  if (value.startsWith("scaffold://")) return value;
  if (/^[a-z]+:\/\//i.test(value)) return value;
  if (/^localhost(:\d+)?(\/.*)?$/.test(value)) return `http://${value}`;
  return `https://${value}`;
}

export function addressToUrl(input: string): string {
  const value = input.trim();
  return looksLikeAddress(value) ? normalizeAddress(value) : SEARCH_URL + encodeURIComponent(value);
}

export function internalPageOf(url: string): InternalPage | null {
  if (!url.startsWith("scaffold://")) return null;
  const name = url.slice("scaffold://".length).replace(/\/$/, "") as InternalPage;
  return INTERNAL_PAGES.includes(name) ? name : "start";
}

export function internalUrl(page: InternalPage): string {
  return `scaffold://${page}`;
}

export function parseDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^scaffold:\/\//, "");
  }
}

export function titleFor(url: string): string {
  const internal = internalPageOf(url);
  if (internal) return INTERNAL_TITLES[internal];
  return parseDomain(url);
}

export function displayAddress(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function isWebUrl(url: string): boolean {
  return /^https?:/i.test(url);
}
