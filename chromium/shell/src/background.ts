import { keepOnShelf } from "./store";

const SHELL_PATH = "index.html";
const shellUrl = () => chrome.runtime.getURL(SHELL_PATH);

/** One desk tab, not a pile: an existing shell is focused before a new one opens. */
async function openShell(find?: string): Promise<void> {
  const base = shellUrl();
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((tab) => tab.url?.startsWith(base));
  if (existing?.id !== undefined) {
    await chrome.tabs.update(existing.id, {
      active: true,
      ...(find ? { url: `${base}?find=${encodeURIComponent(find)}` } : {}),
    });
    if (existing.windowId !== undefined) {
      await chrome.windows.update(existing.windowId, { focused: true });
    }
    return;
  }
  await chrome.tabs.create({ url: find ? `${base}?find=${encodeURIComponent(find)}` : base });
}

function pageMenu(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "post-keep-page",
      title: "Keep this page in Post",
      contexts: ["page"],
    });
    chrome.contextMenus.create({
      id: "post-keep-selection",
      title: "Keep this selection in Post",
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: "post-open-desk",
      title: "Open the Post desk",
      contexts: ["page", "selection"],
    });
  });
}

chrome.runtime.onInstalled.addListener((details) => {
  pageMenu();
  if (details.reason === "install") void openShell();
});

chrome.runtime.onStartup.addListener(pageMenu);
pageMenu();

chrome.action.onClicked.addListener(() => {
  void openShell();
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "open-post") {
    void openShell();
    return;
  }
  if (command === "keep-page") {
    void chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
      if (!tab) return;
      await keepOnShelf(tab, "");
      await chrome.action.setBadgeBackgroundColor({ color: "#0033a0" });
      await chrome.action.setBadgeText({ text: "kept" });
      setTimeout(() => void chrome.action.setBadgeText({ text: "" }), 1800);
    });
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "post-open-desk") {
    void openShell();
    return;
  }
  if (info.menuItemId === "post-keep-page" || info.menuItemId === "post-keep-selection") {
    const target = {
      url: info.pageUrl ?? tab?.url,
      title: tab?.title ?? info.pageUrl,
    };
    void keepOnShelf(target, info.selectionText ?? "");
  }
});

/**
 * `post <words>` in Chromium's own address bar: it searches the desk, because
 * the desk is the thing Chromium cannot do on its own.
 */
chrome.omnibox.setDefaultSuggestion({ description: "Search the Post shelf" });
chrome.omnibox.onInputChanged.addListener((text, suggest) => {
  suggest([{ content: text, description: `Search the Post shelf for “${text}”` }]);
});
chrome.omnibox.onInputEntered.addListener((text) => {
  void openShell(text);
});

