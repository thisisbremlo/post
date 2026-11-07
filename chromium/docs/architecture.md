# Architecture: Post on ungoogled Chromium

## The requirement

Two sentences from the brief decide the engine:

> Everything that works in Chrome should work in this browser.
>
> Post should run every Chrome extension on the Chrome Web Store.

That rules out anything that only embeds Chromium's content layer. Chrome extensions are
not a content-layer feature: `chrome.tabs`, `chrome.bookmarks`, `chrome.management`,
`chrome.declarativeNetRequest`, `chrome.storage` and the rest are implemented in
Chromium's browser layer (`chrome/browser/extensions`, `extensions/browser/api`), on top
of the profiles, permission model and Web Store installer that also live there.

## Why not CEF

CEF embeds `//content`: Blink, V8, the network stack, the compositor. It exposes a C++
(and C) API for loading pages, intercepting requests and rendering off-screen. What it does
not ship is the browser layer, so it has no `chrome.*` API surface to hand an extension.
CEF's extension support is limited to loading extension resources and handlers; an
extension that calls `chrome.tabs.query` has nothing to call.

A CEF shell would therefore look like Post, but it would fail the one requirement that
started the migration: the Web Store would still not work. Building the whole browser
layer ourselves on top of CEF is the same work as forking Chromium, with more of it.

## Why not Electron 35 + a bridge

`electron-chrome-extensions` and `electron-chrome-web-store` reimplement a subset of the
extension APIs against Electron. That subset grows, but it is still a subset: the Web
Store's install flow, MV3 service worker lifetimes, `declarativeNetRequest` rules, native
messaging hosts and Chrome's own update path are not Electron's to give. It is a good
compatibility layer, not the engine.

## The chosen shape: fork ungoogled-chromium, keep `//chrome`

```
chrome/browser/ui/views/frame      ← replaced: Post's toolbar and tab strip
chrome/browser/ui/webui/post       ← added: the desk as a WebUI (chrome://post)
chrome/browser/extensions          ← untouched
extensions/browser/api             ← untouched
content/                           ← untouched
```

The base has to keep the Web Store. That is a correction to the first draft of this
document: ungoogled-chromium deliberately removes the store service, so a fork on
ungoogled fails the requirement that started the migration. The fork therefore bases on
Chromium — `//chrome` intact, store service intact — and takes ungoogled's patches
selectively where they remove telemetry, sync and RLZ without removing the store. The
alternative, staying on ungoogled and shipping chromium-web-store as a bundled
extension, works but adds a second extension manager and still talks to Google's CRX
endpoint; it is a fallback, not the plan.

The fork keeps the whole `//chrome` layer, so extensions, the Web Store, profiles,
permissions, bookmarks, history and downloads are Chromium's own code — not a
reimplementation. Keeping the store also means keeping Google's extension service as a
network dependency; that is the price of the requirement, stated plainly.

Post's interface is a Chromium **WebUI**: the same React desk, served from
`chrome://post`, mounted into the frame where the toolbar and tab strip used to be drawn
by Views. That is the "new shell code" in the brief: `chrome/browser/ui` changes, the
engine does not.

### Phase 0 (this folder, running today)

Before the fork can be built, the desk has to talk to a real Chromium. So the same React
app also ships as an MV3 extension page, driven by the same `chrome.*` calls the WebUI
will use:

```
Post desk (React)
      │
      ├── shell/src/bridge.ts   chrome.tabs / bookmarks / history / management / storage
      │
Chromium (stock, or ungoogled)
```

None of that bridge is throwaway. `chrome.tabs.query`, `chrome.tabs.update`,
`chrome.bookmarks.create`, `chrome.management.getAll` and `chrome.storage.local` behave
the same in a WebUI; only the page's origin and the frame around it change. What phase 0
buys is a real extension surface, real Web Store installs and a design that can be
reviewed before a Chromium build exists.

### Phase 1 (the fork)

1. `chrome/browser/ui/views/frame/browser_view.cc` — the toolbar and tab strip are not
   created; a `views::WebView` hosting `chrome://post` takes the top strip's place.
2. `chrome/browser/ui/webui/post/` — a `WebUIController` that serves the built desk
   bundle and a `Mojo`/`chrome.send` bridge for the handful of things a WebUI cannot do
   itself (window controls, the frame's drag region, native menus).
3. `chrome/browser/ui/browser_commands` — the desk's bridge calls the same `Browser`
   commands Chromium's own toolbar calls, so tab and window behaviour is Chromium's, not
   a parallel implementation.
4. `chrome/common/url_constants` + `chrome/browser/chrome_content_browser_client` — the
   `chrome://post` host, its CSP and its resource IDs.
5. The new tab page points at the desk; the extension in this folder is no longer needed
   for the product, but stays as the design harness.

The patch series lives in `patches/` with ungoogled-chromium's `series` file. Additions
(WebUI files, resources) are new files in the patch; the frame change is the only patch
that edits an existing Chromium file in a way that must be rebased per release.

## What Post keeps, and what Chromium owns

| concern | owner after the move |
| --- | --- |
| tabs, windows, tab groups, back/forward | Chromium (`Browser`, `TabStripModel`) |
| extensions, permissions, Web Store, updates | Chromium |
| bookmarks, history, downloads, passwords, cookies | Chromium profile |
| keep, notes, shelf, sittings, export | Post (`chrome.storage.local`) |
| omnibox, new tab, settings, extension list UI | Post |
| telemetry, accounts, sync | nobody; Post has none, ungoogled has none |

The trust boundary is the same as Chrome's: an extension the user installs can read the
pages it has host permissions for. Post does not add a proxy, a scanner or a permission
prompt of its own, because pretending to mediate Chromium's extension model would be a
lie. What Post adds is a plain statement in the extensions view: these are Chromium's
extensions, with Chromium's powers.

## Updates

The Electron app pulls a signed DMG and swaps itself. A Chromium fork cannot do that
cheaply: Chromium's own updater expects Google's infrastructure. The plan is the same
shape Post already uses — a signed, notarised DMG published from a GitHub release, with
the version baked into the build and an in-app check that points at the release — plus
Chromium's `--disable-background-networking` posture for everything else.

## What would make this the wrong call

If Chrome extension parity turns out to matter less than the frame's identity, the fork's
cost (a Chromium checkout, hours per build, a patch to rebase per release) is not repaid.
The phase-0 extension already proves the desk and the bridge; the fork is justified only
if "the frame is Post's" and "the engine is Chromium's" have to be true at the same time.
That is what was asked for, so that is what is being built.
