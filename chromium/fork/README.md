# The Chromium fork

This is the part that turns Post into the browser instead of a page inside one. It adds
`chrome://post` to a Chromium build and gives the desk a bridge to the browser's own tab
model, so nothing here is an extension.

**Status: not compiled.** There is no Chromium checkout in this workspace and no macOS
toolchain, so the C++ below is a first cut, not a verified build. Everything that can be
checked without Chromium (the desk bundle, the resource package, the integration script)
is checked; the compiler is the next authority. Expect a handful of API and GN fixes on
the first `autoninja`.

## What it installs

```
overlay/chrome/browser/ui/webui/post/
  post_ui.h/.cc        chrome://post: WebUI config, data source, handler
  post_handler.h/.cc   tab strip observer + chrome.send protocol
  resources/           desk bundle + webui-shim.js + generated post_resources.grd
```

The desk is the same React app that runs in the extension harness. It still calls
`chrome.tabs`, `chrome.storage` and friends; `webui-shim.js` maps those calls to
`chrome.send("post.call", …)`, and `PostHandler` answers them from the `TabStripModel`
and the profile's prefs. That is the point of this shape: the frontend is not rewritten
for the fork, only its transport changes.

Milestone 1 (`PostHandler`) covers:

| what | how |
| --- | --- |
| the real tab list, title, URL, active tab | `TabStripModel` + observer |
| activate, close, new tab | `TabStripModel`, `chrome::NewTab` |
| navigate, back, forward, reload | `WebContents` / `NavigationController` |
| keep, shelf, sittings, settings | JSON in profile prefs (`post.storage.*`) |

Bookmarks, history and `chrome.management` return empty in this milestone: the desk's
views render their empty states. They are the next handlers, and they are thin wrappers
over `BookmarkModel`, `HistoryService` and `ExtensionRegistry` — no new UI.

## Build it

```bash
# once, in the repo
npm run fork:assets              # builds the desk into the overlay and writes the .grd

# on the Mac, with depot_tools and a Chromium checkout that keeps the Web Store
python3 chromium/fork/integrate.py --src ~/chromium/src
cd ~/chromium/src
gn gen out/Post --args='is_debug=false is_component_build=false symbol_level=1'
autoninja -C out/Post chrome
```

The base must not be ungoogled-chromium as-is: it removes the Web Store, and with it the
extension installs this whole fork exists for. Use Chromium, or add
`chromium-web-store` to an ungoogled build.

`integrate.py` copies the overlay and edits exactly two existing files: it registers
`PostUIConfig` in `chrome/browser/ui/webui/chrome_web_ui_configs.cc` and adds the overlay
target to `chrome/browser/ui/webui/BUILD.gn`. It refuses to guess: if an anchor moved, it
prints the edit instead of corrupting the tree. Run it with `--check` for a dry run.

Then `out/Post/Chromium.app` has `chrome://post`. Open it once; the next step is pointing
the startup page and the frame at that host (`docs/build.md`, milestone 2).

## Milestones

1. **`chrome://post` compiles and serves the desk** — this directory.
2. **The window is Post** — `browser_view.cc` hosts the desk as the frame's top strip,
   the tab strip and toolbar are not created, the page area stays Chromium's.
3. **Bookmarks, history, extensions** — handlers for the remaining views.
4. **Sign, notarise, ship** — a `Post.app` whose updater is the release feed.

Each milestone is a build on the Mac. Nothing here claims otherwise.
