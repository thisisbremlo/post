/**
 * The slice of Chromium's extension API this shell uses, declared here so the
 * project needs no @types/chrome pin. Chromium is the source of truth; these
 * signatures only describe what the desk calls.
 */
declare namespace chrome {
  interface ChromeEvent<T extends Function> {
    addListener(callback: T): void;
    removeListener(callback: T): void;
    hasListener(callback: T): boolean;
  }

  namespace runtime {
    const id: string;
    function getURL(path: string): string;
    interface InstalledDetails {
      reason: "install" | "update" | "chrome_update" | "shared_module_update";
    }
    const onInstalled: ChromeEvent<(details: InstalledDetails) => void>;
    const onStartup: ChromeEvent<() => void>;
  }

  namespace windows {
    interface Window {
      id?: number;
      focused: boolean;
    }
    function getCurrent(): Promise<Window>;
    function update(id: number, info: { focused?: boolean }): Promise<Window>;
  }

  namespace tabs {
    interface Tab {
      id?: number;
      windowId?: number;
      index: number;
      active: boolean;
      pinned?: boolean;
      highlighted?: boolean;
      url?: string;
      pendingUrl?: string;
      title?: string;
      favIconUrl?: string;
      status?: "unloaded" | "loading" | "complete";
      audible?: boolean;
    }
    interface QueryInfo {
      active?: boolean;
      currentWindow?: boolean;
      windowId?: number;
      url?: string | string[];
    }
    interface CreateProperties {
      url?: string;
      active?: boolean;
      windowId?: number;
      index?: number;
    }
    interface UpdateProperties {
      url?: string;
      active?: boolean;
    }
    function query(info?: QueryInfo): Promise<Tab[]>;
    function get(id: number): Promise<Tab>;
    function getCurrent(): Promise<Tab | undefined>;
    function create(props: CreateProperties): Promise<Tab>;
    function update(id: number, props: UpdateProperties): Promise<Tab>;
    function remove(ids: number | number[]): Promise<void>;
    function reload(id?: number): Promise<void>;
    function goBack(id?: number): Promise<void>;
    function goForward(id?: number): Promise<void>;

    const onCreated: ChromeEvent<(tab: Tab) => void>;
    const onRemoved: ChromeEvent<(tabId: number, info: { windowId: number; isWindowClosing: boolean }) => void>;
    const onMoved: ChromeEvent<(tabId: number, info: { windowId: number; fromIndex: number; toIndex: number }) => void>;
    const onActivated: ChromeEvent<(info: { tabId: number; windowId: number }) => void>;
    const onUpdated: ChromeEvent<
      (tabId: number, changeInfo: { url?: string; title?: string; status?: string }, tab: Tab) => void
    >;
  }

  namespace bookmarks {
    interface BookmarkTreeNode {
      id: string;
      parentId?: string;
      title: string;
      url?: string;
      dateAdded?: number;
      children?: BookmarkTreeNode[];
    }
    function getTree(): Promise<BookmarkTreeNode[]>;
    function search(query: string | { url?: string; title?: string }): Promise<BookmarkTreeNode[]>;
    function create(bookmark: {
      title: string;
      url?: string;
      parentId?: string;
      index?: number;
    }): Promise<BookmarkTreeNode>;
    function remove(id: string): Promise<void>;
    const onCreated: ChromeEvent<(id: string, bookmark: BookmarkTreeNode) => void>;
    const onRemoved: ChromeEvent<(id: string, info: { parentId: string; index: number }) => void>;
    const onChanged: ChromeEvent<(id: string, info: { title?: string; url?: string }) => void>;
  }

  namespace history {
    interface HistoryItem {
      id: string;
      url?: string;
      title?: string;
      lastVisitTime?: number;
      visitCount?: number;
    }
    function search(query: {
      text: string;
      startTime?: number;
      endTime?: number;
      maxResults?: number;
    }): Promise<HistoryItem[]>;
  }

  namespace management {
    interface ExtensionInfo {
      id: string;
      name: string;
      shortName?: string;
      description?: string;
      version: string;
      enabled: boolean;
      mayDisable: boolean;
      type: string;
      installType?: string;
      homepageUrl?: string;
      icons?: { size: number; url: string }[];
    }
    function getAll(): Promise<ExtensionInfo[]>;
    function setEnabled(id: string, enabled: boolean): Promise<void>;
    function uninstall(id: string, options?: { showConfirmDialog?: boolean }): Promise<void>;
  }

  namespace storage {
    interface StorageArea {
      get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
    }
    const local: StorageArea;
    const onChanged: ChromeEvent<
      (changes: Record<string, { newValue?: unknown; oldValue?: unknown }>, areaName: string) => void
    >;
  }

  namespace contextMenus {
    interface CreateProperties {
      id?: string;
      title?: string;
      contexts?: ("page" | "selection" | "link" | "image" | "video" | "audio")[];
    }
    interface OnClickData {
      menuItemId: string | number;
      selectionText?: string;
      linkUrl?: string;
      pageUrl?: string;
    }
    function create(props: CreateProperties): string | number;
    function removeAll(callback?: () => void): void;
    const onClicked: ChromeEvent<(info: OnClickData, tab?: tabs.Tab) => void>;
  }

  namespace omnibox {
    interface SuggestResult {
      content: string;
      description: string;
    }
    function setDefaultSuggestion(suggestion: { description: string }): void;
    const onInputChanged: ChromeEvent<
      (text: string, suggest: (results: SuggestResult[]) => void) => void
    >;
    const onInputEntered: ChromeEvent<(text: string, disposition: string) => void>;
  }

  namespace commands {
    const onCommand: ChromeEvent<(command: string) => void>;
  }

  namespace action {
    const onClicked: ChromeEvent<(tab: tabs.Tab) => void>;
    function setBadgeText(details: { text: string; tabId?: number }): Promise<void>;
    function setBadgeBackgroundColor(details: { color: string }): Promise<void>;
  }
}
