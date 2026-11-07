import type { ShelfEntry, Sitting } from "./store";

/**
 * Sample data for the design harness at ?demo. It is labelled in the page and
 * never written to storage, so a plain tab can be reviewed without Chromium.
 */

export const demoTabs: chrome.tabs.Tab[] = [
  {
    id: 11,
    index: 0,
    active: false,
    title: "Pantone 2965 — the blue, in print",
    url: "https://www.pantone.com/color/2965-c",
  },
  {
    id: 12,
    index: 1,
    active: false,
    title: "Figma — file, components and the type ramp",
    url: "https://www.figma.com/file/post",
  },
  {
    id: 13,
    index: 2,
    active: false,
    title: "Instrument Sans — a variable grotesque",
    url: "https://fonts.google.com/specimen/Instrument+Sans",
  },
];

export const demoShelf: ShelfEntry[] = [
  {
    id: "demo-1",
    url: "https://developer.chrome.com/docs/extensions/reference/api/tabs",
    title: "chrome.tabs — Chromium extension reference",
    note: "The tab strip is a projection of this API. Everything the desk does with tabs lands here.",
    keptAt: Date.now() - 1000 * 60 * 60 * 5,
  },
  {
    id: "demo-2",
    url: "https://www.are.na/",
    title: "Are.na",
    note: "Channels as a way to keep things without a feed. The shelf should feel this quiet.",
    keptAt: Date.now() - 1000 * 60 * 60 * 30,
  },
  {
    id: "demo-3",
    url: "https://www.unicode.org/reports/tr35/",
    title: "Unicode TR35 — date formats",
    note: "For the sitting names: “desk, 7 Nov”, never 2026-11-07.",
    keptAt: Date.now() - 1000 * 60 * 60 * 52,
  },
];

export const demoSittings: Sitting[] = [
  {
    id: "demo-sitting",
    name: "desk, 7 Nov",
    createdAt: Date.now() - 1000 * 60 * 60 * 20,
    tabs: [
      { url: "https://www.pantone.com/color/2965-c", title: "Pantone 2965" },
      { url: "https://www.are.na/", title: "Are.na" },
    ],
  },
];

export const demoHistory: chrome.history.HistoryItem[] = [
  {
    id: "h1",
    url: "https://developer.chrome.com/docs/extensions/develop/concepts/service-workers",
    title: "Service workers in extensions",
    lastVisitTime: Date.now() - 1000 * 60 * 12,
  },
  {
    id: "h2",
    url: "https://www.are.na/",
    title: "Are.na",
    lastVisitTime: Date.now() - 1000 * 60 * 90,
  },
  {
    id: "h3",
    url: "https://fonts.google.com/specimen/Instrument+Sans",
    title: "Instrument Sans",
    lastVisitTime: Date.now() - 1000 * 60 * 60 * 6,
  },
  {
    id: "h4",
    url: "https://www.pantone.com/color/2965-c",
    title: "Pantone 2965",
    lastVisitTime: Date.now() - 1000 * 60 * 60 * 26,
  },
];

export const demoBookmarks: {
  id: string;
  title: string;
  url: string;
  folder: string;
}[] = [
  {
    id: "b1",
    title: "Chromium extension API index",
    url: "https://developer.chrome.com/docs/extensions/reference/",
    folder: "Bookmarks bar",
  },
  {
    id: "b2",
    title: "ungoogled-chromium",
    url: "https://github.com/ungoogled-software/ungoogled-chromium",
    folder: "Bookmarks bar",
  },
  {
    id: "b3",
    title: "The Post shelf",
    url: "https://www.are.na/",
    folder: "Reading",
  },
];

export const demoExtensions: chrome.management.ExtensionInfo[] = [
  {
    id: "eimadpbcbfnmbkopoojfekhnkhdbieeh",
    name: "Dark Reader",
    version: "4.9.101",
    description: "Dark mode for every website.",
    enabled: true,
    mayDisable: true,
    type: "extension",
  },
  {
    id: "nngceckbapebfimnlniiiahkandclblb",
    name: "Bitwarden",
    version: "2026.10.1",
    description: "A secure and free password manager.",
    enabled: true,
    mayDisable: true,
    type: "extension",
  },
  {
    id: "fmkadmapgofadopljbjfkapdkoienihi",
    name: "React Developer Tools",
    version: "7.0.2",
    description: "Adds React debugging tools to the Chromium developer tools.",
    enabled: false,
    mayDisable: true,
    type: "extension",
  },
];
