# Parity: Electron surface → Chromium

Status is about the new shell, not the Electron app. **Ported** means it runs in the
phase-0 desk today. **Fork** means it needs the `chrome/browser/ui` patch.

| Post surface | Electron today | Chromium shell | status |
| --- | --- | --- | --- |
| Tabs, close, activate, new | `WebContentsView` per tab, state in React | `chrome.tabs` query/create/update/remove, events | ported |
| Tab strip | React, native views positioned under it | React over Chromium's tab list | ported |
| Tab groups | Post state, tinted pills | `chrome.tabGroups` (not yet wired) | next |
| Back / forward / reload | `webContents.navigationHistory` | `chrome.tabs.goBack/goForward/reload` | ported |
| Omnibox | React + `loadURL` | `chrome.tabs.update`, URL/search parsing | ported |
| Star / bookmarks bar | Post store + native bar | `chrome.bookmarks` (bar is Chromium's) | ported |
| Bookmark editor (name, folder) | Post dialog | Chromium's own star dialog | Chromium-owned |
| History | Post store | `chrome.history` | ported |
| Keep with a note | Post store | `chrome.storage.local` + keep dialog | ported |
| Keep a selection | native context menu → Post | `chrome.contextMenus` → shelf | ported |
| Shelf | Post page | desk, shelf view | ported |
| Set a desk aside / restore | Post store + native close | storage + `chrome.tabs` create/remove | ported |
| Markdown export | Blob download | Blob download from the desk | ported |
| Turbo notes | Post store | not ported yet (`chrome.storage.local`) | next |
| Do Not Track | `webPreferences` | `declarativeNetRequest` header rule, or Chromium setting | next |
| Zoom | `setZoomFactor` | `chrome.tabs.setZoom` / Chromium zoom | next |
| Page meta sheet | `executeJavaScript` in the page | `chrome.scripting.executeScript` (needs host access) | next |
| Extensions list | `session.loadExtension` | `chrome.management` | ported |
| Install from Web Store | CRX download + unzip | Chromium installs it natively | Chromium-owned |
| Update check / install | GitHub feed + DMG swap | feed kept; DMG install needs the fork's app bundle | fork |
| Window controls, frame, menus | Electron `BaseWindow` | Chromium `Browser` + Post frame | fork |
| Native page views | `WebContentsView` | Chromium renders tabs; the desk is chrome, not content | fork |

## Honest limits of phase 0

- The desk is a tab, so opening it moves you away from the page. In the fork it is the
  frame and the page stays put.
- Chromium's own toolbar and tab strip are still visible above the desk.
- Some things Chromium refuses to an extension page: it cannot open `chrome://` URLs,
  cannot read a page's DOM without host permission, and cannot draw over a page.
- Post's internal pages (`scaffold://start`, `shelf`, `turbo`) are views of the desk here,
  not addresses. The fork gives them a real `chrome://post/...` scheme.

## Extensions: what "works" means

Chromium's extension system is the backend, so the question is not whether an extension
runs but which Chromium version it targets. The matrix to test on the Mac:

| extension | kind | what it proves |
| --- | --- | --- |
| Dark Reader | MV3, content scripts, storage | injection and per-site state |
| Bitwarden | MV3, service worker, popup, native messaging | the hardest common shape |
| React DevTools | MV3, devtools page | devtools surfaces |
| uBlock Origin Lite | MV3, declarativeNetRequest | request filtering |
| uBlock Origin (MV2) | MV2 | only if the base still allows MV2 |

Any failure here is a Chromium/ungoogled-chromium question, not a Post one — which is the
point of moving the engine instead of faking its APIs.
