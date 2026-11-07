import { hasChrome } from "./store";

export { hasChrome, removeFromShelf } from "./store";
export type { DeskSettings, ShelfEntry, Sitting } from "./store";

export interface FlatBookmark {
  id: string;
  title: string;
  url: string;
  folder: string;
}

export async function currentWindowTabs(): Promise<chrome.tabs.Tab[]> {
  if (!hasChrome) return [];
  const win = await chrome.windows.getCurrent();
  return win.id === undefined ? chrome.tabs.query({ currentWindow: true }) : chrome.tabs.query({ windowId: win.id });
}

export async function selfTabId(): Promise<number | null> {
  if (!hasChrome) return null;
  const tab = await chrome.tabs.getCurrent();
  return tab?.id ?? null;
}

export function onTabsChanged(handler: () => void): () => void {
  if (!hasChrome) return () => {};
  const fire = () => handler();
  chrome.tabs.onCreated.addListener(fire);
  chrome.tabs.onRemoved.addListener(fire);
  chrome.tabs.onMoved.addListener(fire);
  chrome.tabs.onUpdated.addListener(fire);
  return () => {
    chrome.tabs.onCreated.removeListener(fire);
    chrome.tabs.onRemoved.removeListener(fire);
    chrome.tabs.onMoved.removeListener(fire);
    chrome.tabs.onUpdated.removeListener(fire);
  };
}

export async function activateTab(id: number): Promise<void> {
  if (!hasChrome) return;
  await chrome.tabs.update(id, { active: true });
}

export async function closeTab(id: number): Promise<void> {
  if (!hasChrome) return;
  await chrome.tabs.remove(id);
}

export async function newTab(url?: string): Promise<void> {
  if (!hasChrome) return;
  await chrome.tabs.create({ url: url ?? chrome.runtime.getURL("index.html") });
}

export async function navigate(tabId: number | null, url: string): Promise<void> {
  if (!hasChrome) return;
  if (tabId === null) {
    await chrome.tabs.create({ url });
    return;
  }
  // Navigating from the desk is a browser navigation: the page comes to the front.
  await chrome.tabs.update(tabId, { url, active: true });
}

export async function pageAction(tabId: number | null, action: "back" | "forward" | "reload"): Promise<void> {
  if (!hasChrome || tabId === null) return;
  try {
    if (action === "back") await chrome.tabs.goBack(tabId);
    if (action === "forward") await chrome.tabs.goForward(tabId);
    if (action === "reload") await chrome.tabs.reload(tabId);
  } catch {
    /* Chromium throws when the stack is empty; a dead button is the honest answer. */
  }
}

export function faviconFor(url: string | undefined, size = 32): string | null {
  if (!hasChrome || !url || !/^https?:/i.test(url)) return null;
  return `${chrome.runtime.getURL("_favicon/")}?pageUrl=${encodeURIComponent(url)}&size=${size}`;
}

export function domainOf(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function isWebUrl(url: string | undefined): boolean {
  return typeof url === "string" && /^https?:/i.test(url);
}

export function addressToUrl(value: string, search: "duckduckgo" | "google"): string {
  const text = value.trim();
  if (!text) return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return text;
  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(text)) return `http://${text}`;
  const looksLikeHost = /^[^\s/]+\.[a-z]{2,}(?::\d+)?(\/\S*)?$/i.test(text);
  if (looksLikeHost) return `https://${text}`;
  const query = encodeURIComponent(text);
  return search === "google"
    ? `https://www.google.com/search?q=${query}`
    : `https://duckduckgo.com/?q=${query}`;
}

export async function isBookmarked(url: string | undefined): Promise<boolean> {
  if (!hasChrome || !isWebUrl(url)) return false;
  const matches = await chrome.bookmarks.search({ url });
  return matches.some((bookmark) => bookmark.url === url);
}

/** Chrome's star: one click adds or removes, no dialog in the way. */
export async function toggleBookmark(url: string | undefined, title: string | undefined): Promise<boolean> {
  if (!hasChrome || !isWebUrl(url)) return false;
  const matches = await chrome.bookmarks.search({ url });
  const existing = matches.find((bookmark) => bookmark.url === url);
  if (existing) {
    await chrome.bookmarks.remove(existing.id);
    return false;
  }
  await chrome.bookmarks.create({ title: title?.trim() || url!.trim(), url });
  return true;
}

export async function listBookmarks(): Promise<FlatBookmark[]> {
  if (!hasChrome) return [];
  const tree = await chrome.bookmarks.getTree();
  const flat: FlatBookmark[] = [];
  const walk = (node: chrome.bookmarks.BookmarkTreeNode, folder: string) => {
    if (node.url) {
      flat.push({ id: node.id, title: node.title || node.url, url: node.url, folder });
      return;
    }
    const nextFolder = node.title?.trim() || folder;
    for (const child of node.children ?? []) walk(child, nextFolder);
  };
  for (const node of tree) walk(node, "");
  return flat;
}

export async function removeBookmark(id: string): Promise<void> {
  if (hasChrome) await chrome.bookmarks.remove(id);
}

export async function listHistory(maxResults = 120): Promise<chrome.history.HistoryItem[]> {
  if (!hasChrome) return [];
  const items = await chrome.history.search({
    text: "",
    startTime: Date.now() - 1000 * 60 * 60 * 24 * 90,
    maxResults,
  });
  return items.filter((item) => isWebUrl(item.url));
}

export async function listExtensions(): Promise<chrome.management.ExtensionInfo[]> {
  if (!hasChrome) return [];
  const all = await chrome.management.getAll();
  return all
    .filter((extension) => extension.type === "extension" && extension.id !== chrome.runtime.id)
    .sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name));
}

export async function setExtensionEnabled(id: string, enabled: boolean): Promise<void> {
  if (hasChrome) await chrome.management.setEnabled(id, enabled);
}

export async function removeExtension(id: string): Promise<void> {
  if (hasChrome) await chrome.management.uninstall(id, { showConfirmDialog: true });
}

/** The shelf leaves as a file you own: title, address, note. */
export function exportShelf(entries: { title: string; url: string; note: string }[]): void {
  const lines = ["# Post shelf", "", `${entries.length} kept pages.`, ""];
  for (const entry of entries) {
    lines.push(`## ${entry.title}`, "", entry.url, "");
    if (entry.note.trim()) lines.push(`> ${entry.note.trim()}`, "");
  }
  const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "post-shelf.md";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 4000);
}

export function formatWhen(time: number): string {
  const date = new Date(time);
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
