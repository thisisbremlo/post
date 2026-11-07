# Post for Chromium

This folder is the new shell: Post on a real Chromium backend, with the Post desk as its
frontend. It is a separate project from the Electron app in `electron/`; that app stays
where it is until this one can take its place.

## What is already real

```bash
npm run shell:build    # builds the desk and the service worker into dist-shell/
npm run shell          # opens Chromium with a dedicated Post profile and the desk inside
```

`npm run shell` launches a Chromium binary you already have (set `POST_CHROMIUM` to pick
one), loads `dist-shell/` as an unpacked extension, and opens the desk. In that window:

- the tab strip is Chromium's own tab list, read and driven through `chrome.tabs`;
- the omnibox navigates the tab you were last on, or opens one;
- the star writes Chromium's real bookmarks, which also appear in Chromium's own bar;
- history is `chrome.history`, extensions are `chrome.management`;
- **extensions are Chromium's extensions.** The Web Store installs them natively, any MV2
  or MV3 extension that works in Chromium works here, and Post does not mediate them;
- keep, the shelf, notes, desks set aside and the markdown export live in
  `chrome.storage.local` in the Post profile.

You can also load `dist-shell/` by hand: `chrome://extensions` → developer mode → **Load
unpacked**. The manifest pins a public key, so the extension ID is stable:
`fbbamoikdpfmnmiagolifmekjpbeipbo`.

## What is not built yet

The window around the desk is still Chromium's. Chromium draws its own toolbar and tab
strip, and this build does not replace them. That replacement is the fork milestone: a
small patch series over ungoogled-chromium that swaps `chrome/browser/ui`'s toolbar and
frame for a `chrome://post` WebUI and keeps every other layer untouched — including the
extension system, which is the reason for the whole move.

[docs/architecture.md](docs/architecture.md) records why CEF is not the path,
[docs/build.md](docs/build.md) is the macOS fork recipe, and
[docs/parity.md](docs/parity.md) maps every Electron surface to its Chromium
replacement and its status.

## When Chrome says no

The package is load-tested: in headless Chromium 158 the worker registers, the desk opens
with `demo: false`, `chrome.tabs` reports the real window's tabs, and bookmark, storage and
`chrome.management` round-trips succeed with no console errors. `npm run shell:check`
repeats the static half of that test on any machine — service worker, module type, icons,
new-tab page and every asset it references.

- **Branded Google Chrome ignores `--load-extension` since version 137.** `npm run shell`
  refuses to start it and prints the manual path instead. Install Chromium or
  ungoogled-chromium for the one-command launch.
- **"Load unpacked" is the reliable route on any Chrome.** `chrome://extensions` →
  developer mode on → Load unpacked → the `dist-shell` folder (not `chromium/shell`).
- **The extension does not appear at all** after Load unpacked: read the error on the
  Post card. A manifest key that is not valid base64, a missing icon or a service worker
  that is ESM while the manifest says `classic` all fail there, before any Post code runs.
- **The desk opens but shows the demo ribbon**: the page is not running as the extension.
  Open it through `chrome-extension://<id>/index.html` or the new tab, not as a file.
- **Another extension owns the new tab** and hides Post's override; the action button and
  `post` in the address bar still open the desk.

The extension ID is derived from the pinned key, so it stays
`fbbamoikdpfmnmiagolifmekjpbeipbo` across reloads and profiles.

## Layout

| path | what it is |
| --- | --- |
| `shell/src/App.tsx` | the desk: tab strip, toolbar, omnibox, keep dialog |
| `shell/src/panels.tsx` | shelf, history, bookmarks, extensions, settings |
| `shell/src/bridge.ts` | `chrome.*` calls that replace the Electron IPC bridge |
| `shell/src/store.ts` | shelf, sittings and settings in `chrome.storage.local` |
| `shell/src/background.ts` | action, commands, page menu, `post` omnibox keyword |
| `shell/public/manifest.json` | MV3 manifest, pinned key, new-tab override |
| `scripts/post-chromium.mjs` | launches Chromium with the Post profile and the desk |

## The design did not move

Cream, Pantone blue `#0033a0`, Instrument Sans, sentence case, one blue band at the foot.
The desk is a page here instead of a native view, so the same tokens are a stylesheet
rather than a window's backing colour — but nothing about the posture changed: the note is
still the product, the shelf is still local, and nothing is sent anywhere.
