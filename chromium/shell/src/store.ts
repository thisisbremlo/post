/**
 * Everything the desk remembers that Chromium does not already keep for us.
 * One storage area, three keys, so the service worker and the shell page can
 * both read and write without a channel between them.
 */

export interface ShelfEntry {
  id: string;
  url: string;
  title: string;
  /** Why it was kept. The note is the product. */
  note: string;
  keptAt: number;
}

export interface Sitting {
  id: string;
  name: string;
  createdAt: number;
  tabs: { url: string; title: string }[];
}

export interface DeskSettings {
  /** Where a non-address goes. */
  search: "duckduckgo" | "google";
  animations: "full" | "reduced";
}

export const DEFAULT_SETTINGS: DeskSettings = { search: "duckduckgo", animations: "full" };

const SHELF_KEY = "post.shelf.v1";
const SITTINGS_KEY = "post.sittings.v1";
const SETTINGS_KEY = "post.settings.v1";

/** True only on an extension page or in the service worker; false in a plain tab. */
export const hasChrome = typeof chrome !== "undefined" && typeof chrome.tabs !== "undefined";

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

async function read<T>(key: string, fallback: T): Promise<T> {
  if (!hasChrome) return fallback;
  const raw = await chrome.storage.local.get(key);
  const value = raw[key];
  return value === undefined ? fallback : (value as T);
}

async function write(key: string, value: unknown): Promise<void> {
  if (!hasChrome) return;
  await chrome.storage.local.set({ [key]: value });
}

export async function readShelf(): Promise<ShelfEntry[]> {
  const shelf = await read<ShelfEntry[]>(SHELF_KEY, []);
  if (!Array.isArray(shelf)) return [];
  return shelf
    .filter((entry) => entry && typeof entry.url === "string" && entry.url.startsWith("http"))
    .map((entry) => ({
      id: typeof entry.id === "string" ? entry.id : uid(),
      url: entry.url,
      title: typeof entry.title === "string" && entry.title.trim() ? entry.title : entry.url,
      note: typeof entry.note === "string" ? entry.note : "",
      keptAt: typeof entry.keptAt === "number" ? entry.keptAt : Date.now(),
    }));
}

export async function writeShelf(entries: ShelfEntry[]): Promise<void> {
  await write(SHELF_KEY, entries);
}

/** Keeping the same page twice updates the note instead of adding a card. */
export async function keepOnShelf(
  tab: { url?: string; title?: string },
  note: string,
): Promise<ShelfEntry[]> {
  if (!tab.url || !/^https?:/i.test(tab.url)) return readShelf();
  const shelf = await readShelf();
  const title = tab.title?.trim() || tab.url;
  const existing = shelf.find((entry) => entry.url === tab.url);
  const next = existing
    ? shelf.map((entry) =>
        entry.url === tab.url ? { ...entry, note: note.trim() || entry.note, keptAt: Date.now() } : entry,
      )
    : [{ id: uid(), url: tab.url, title, note: note.trim(), keptAt: Date.now() }, ...shelf];
  await writeShelf(next);
  return next;
}

export async function removeFromShelf(id: string): Promise<ShelfEntry[]> {
  const shelf = (await readShelf()).filter((entry) => entry.id !== id);
  await writeShelf(shelf);
  return shelf;
}

export async function readSittings(): Promise<Sitting[]> {
  const sittings = await read<Sitting[]>(SITTINGS_KEY, []);
  return Array.isArray(sittings) ? sittings.filter((sitting) => sitting && Array.isArray(sitting.tabs)) : [];
}

export async function writeSittings(sittings: Sitting[]): Promise<void> {
  await write(SITTINGS_KEY, sittings);
}

export async function readSettings(): Promise<DeskSettings> {
  const stored = await read<Partial<DeskSettings>>(SETTINGS_KEY, {});
  return {
    search: stored.search === "google" ? "google" : DEFAULT_SETTINGS.search,
    animations: stored.animations === "reduced" ? "reduced" : DEFAULT_SETTINGS.animations,
  };
}

export async function writeSettings(settings: DeskSettings): Promise<void> {
  await write(SETTINGS_KEY, settings);
}

/** Fires for every key we own, so a keep from the page menu lands on the desk live. */
export function onStorageChange(handler: (key: string) => void): () => void {
  if (!hasChrome) return () => {};
  const listener = (changes: Record<string, { newValue?: unknown }>) => {
    for (const key of [SHELF_KEY, SITTINGS_KEY, SETTINGS_KEY]) {
      if (key in changes) handler(key);
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
