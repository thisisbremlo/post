# Building the Chromium shell (macOS)

Nothing in this document has been run in the cloud workspace: it has no macOS, no
Chromium checkout and no graphical session. Treat it as the recipe to run on the Mac,
not as a verified build. Phase 0 (`npm run shell`) is the part that runs today.

## What you need

- macOS 14 or newer, Xcode 16 with the command line tools, 16 GB RAM, ~120 GB free disk.
- Chromium's `depot_tools` on `PATH`.
- Python 3.11+ and Node 20+ for the desk bundle.
- An Apple Developer ID for signing; notarisation needs a paid account.

A clean build of Chromium on an M-series laptop is a few hours. Incremental builds after
a UI patch are minutes; the first one is not.

## 1. The base

```bash
mkdir -p ~/post-chromium && cd ~/post-chromium
git clone https://github.com/ungoogled-software/ungoogled-chromium.git
cd ungoogled-chromium
python3 utils/downloads.py retrieve -p macos
python3 utils/downloads.py unpack -p macos
```

ungoogled-chromium documents the exact flags for its current release in
`docs/building.md`; follow that file rather than any command copied from here, because
the domain substitution and pruning steps move between releases.

## 2. Post's patch series

```
patches/
  series                     one patch file per line, applied in order
  0001-post-webui.patch      new: chrome/browser/ui/webui/post/**, resources, BUILD.gn
  0002-post-frame.patch      edit: browser_view.cc, toolbar_view.cc, tab_strip_region_view
  0003-post-new-tab.patch    edit: the new tab page's URL and its WebUI registration
```

The fork applies its series on top of ungoogled-chromium's own, not instead of it:

```bash
python3 utils/patches.py apply -p macos
git apply --3way ../post/patches/*.patch
```

Keep `0002` small and mechanical. Every release rebases it, and the smaller it is, the
cheaper the rebase. New files (the desk's WebUI, its resources, its `BUILD.gn` target) do
not conflict; edits to `browser_view.cc` do.

## 3. The desk bundle

`npm run shell:build` already produces `dist-shell/`. The WebUI target copies the same
assets into the Chromium tree and registers them as resources:

```
chrome/browser/ui/webui/post/
  BUILD.gn
  post_ui.cc
  post_ui.h
  resources/
    index.html
    assets/*.js
    assets/*.css
```

`post_ui.cc` registers `chrome://post`, points it at `IDR_POST_UI_HTML`, and adds the
`chrome.send` handlers the frame needs: window controls, drag region, and the native
menu anchors. Everything else — tabs, bookmarks, extensions, history — goes through
`chrome.*`, exactly as `shell/src/bridge.ts` does today, so the desk does not grow a
second data layer.

Build arguments:

```bash
gn gen out/Post --args='
  is_official_build=true
  is_debug=false
  symbol_level=1
  enable_nacl=false
  chrome_pgo_phase=0
  use_unofficial_version_number=false
  is_component_build=false
'
autoninja -C out/Post chrome
```

## 4. Sign, notarise, publish

Chromium produces `out/Post/Chromium.app`. Rename the bundle to `Post.app`, set
`CFBundleIdentifier` to `com.thisisbremlo.post`, and sign inside-out — frameworks first,
then helpers, then the app — before notarising the zip:

```bash
codesign --force --deep --options runtime --sign "Developer ID Application: …" Post.app
ditto -c -k --keepParent Post.app Post-arm64.zip
xcrun notarytool submit Post-arm64.zip --apple-id … --team-id … --password … --wait
xcrun stapler staple Post.app
```

The existing release workflow's five secrets and its verification steps apply unchanged;
only the artefact name and the bundle path move.

## 5. What to test first on the Mac

1. Launch, and confirm the frame is the desk: no Chromium toolbar, no Chromium tab strip.
2. Open ten tabs, close some, restore a desk; the strip must stay in step with
   `TabStripModel`.
3. Install Dark Reader, then Bitwarden, from the Web Store; both must behave as they do in
   Chrome, including their popups.
4. Keep a page from the page's context menu and from the desk; both must land on the shelf.
5. Restart; the shelf, the sittings and the profile must come back.
6. Check a page with DRM, a PDF, and a `chrome://` page — the three places forks usually
   break.

Until step 1 passes on the Mac, phase 0 is the honest description of what runs.
