<img src="build/icon.png" width="72" alt="Post" />

# Post

A browser for building on other people's work. Pages you find stay findable: kept
with a reason, held beside the page you are making, and never sent anywhere.

The loop is **find → keep → compare → cite → make**. Chrome owns *find*, Figma owns
*make*, and the middle — keep, compare, cite — is what this app is for.

## Run it

```bash
npm install            # once; Electron's binary downloads here too
npm run dev            # the web harness at http://localhost:3000
npm run desktop:dev    # the desktop shell, loading the harness (needs `npm run dev`)
npm run desktop        # build the chrome and open it in Electron
```

`npm run desktop` without a dev server builds the renderer to `dist/` first and loads
it from disk, which is the shipping shape.

### Install it as an app

```bash
npm install
npm run package:mac        # release/Post-0.2.0-arm64.dmg and the .app beside it
```

Open the dmg and drag **Post** to Applications; it launches on its own, with no
terminal and no dev server. The build is unsigned, so the first launch is right
click → Open, or clear the quarantine flag once:

```bash
xattr -dr com.apple.quarantine /Applications/Post.app
```

`npm run package` builds for whichever platform you are on, and `npm run package:dir`
skips the installer when you only want the unpacked app.

## Two targets, one codebase

- **Desktop (`electron/`)** — a `BaseWindow` with the chrome in one `WebContentsView`
  and one `WebContentsView` per tab, plus a browser-level reference view. Native views
  paint above the chrome, so the chrome renders a hole where the page goes and sends
  its layout down; the main process reconciles views, positions them and hides them
  while a modal is open.
- **Web harness (`src/`)** — the same chrome with no engine. Pages become a *held
  sheet* that says where the page would be, and offers to load a live frame (some
  sites refuse to be framed). It exists so the interface can be reviewed anywhere.
  Native page views and their context menus only run in the desktop app.
- **Chromium shell (`chromium/`)** — the next engine, in its own folder: the same desk,
  driven by `chrome.*` instead of Electron IPC, running as a real Chromium extension
  today and as `chrome://post` once the frame patch lands. See `chromium/README.md`.

State lives in the chrome: tabs, back stacks, tab groups, the shelf, sittings, the
reference pane. It persists to the profile on disk and, in the desktop app, syncs the
layout to main. Tab groups are part of that state, not a view setting: fold the window
and every group comes back as it was, collapsed ones included.

## The six behaviours

| | |
|---|---|
| **Keep** `⌘⇧D` | one focused note field, address above it. The note is the product |
| **Bookmark** `⌘D` | Chrome's star and bar: a name, a folder, no note required |
| **Hold** `⌘⇧R` | a reference pane that belongs to the browser, not to a tab |
| **Measure** | 360 / 768 / fit, applied to the live page, width stated in mono |
| **Recall** `⌘K` | tabs, shelf and history together, notes searchable, deduped |
| **Set aside** | name the desk, close it, restore it with its order intact |
| **Leave** | the shelf exports as Markdown: title, URL, note |

Keys: `⌘T` `⌘W` `⌘L` `⌘R` `⌘D` `⌘⇧D` `⌘⇧B` `⌘K` `⌘⇧R` `⌘⇧G` `⌘⇧H` `⌘1…9`. Browser keys only.

The start sheet is not a tab: it sits on the home button beside back, forward and
reload, so the strip only ever holds pages you went somewhere to reach. There is one
start sheet, never two.

Breakpoints move like a window edge, not like a toggle: 360, 768 and fit are a real
viewport width, so the sheet is animated to its new width (Motion) and the native view
follows it frame by frame through the layout sync. A window resize follows the window
with no easing, because nothing there should lag behind the pointer.

Updates are Chrome's, minus the store: a build bakes the version and commit it came
from, main is the release channel, and the app looks at the tip of main five seconds
after launch, every half hour, and whenever the window comes back to the front.

The shell reads GitHub's commit Atom feed for the head of main (no token, no rate
limit, works from a packaged app) and the repo's own `update.json` for the version and
the one-line note; the harness asks the same files over the public API. Every commit is
therefore visible, whether or not the version moved. `npm run stamp` refreshes
`update.json`; `SCAFFOLD_VERSION=0.2.0 npm run dev` pretends to be an older build when
you want to see the chip.
When main has moved past the running build, the dialog opens once per commit and a
small `update` chip stays in the toolbar for reopening it. In a packaged app the
button downloads the signed, notarised zip from the latest GitHub release, verifies
its signature with `codesign`, swaps the `.app` and reopens — no checkout, no node,
no npm. A build with a baked checkout (`electron/checkout.json`) but no reachable
release falls back to pulling and rebuilding; the harness keeps the pull command.
Nothing installs behind your back, and nothing of yours moves.

## Signing and releases

`.github/workflows/release.yml` builds, signs, notarises and publishes on every push
to main. The version is `0.3.<run number>`, so builds only move forward; the tag is
`v<version>`, and the assets keep stable names — `Post-arm64.zip`, `Post-x64.zip` and
the dmg — because `releases/latest/download/Post-arm64.zip` is what the updater asks
for. Each run verifies the signature with `codesign --verify --deep --strict`, checks
Gatekeeper with `spctl`, and staples the notarisation ticket before re-zipping, so the
copy the app downloads is the copy Apple already approved.

The workflow needs five repository secrets (Settings → Secrets and variables →
Actions). Without them it fails at the `signing secrets` step rather than publishing
an unsigned build:

| secret | what it is |
| --- | --- |
| `MAC_CERTIFICATE_P12` | base64 of a Developer ID Application certificate and key (`.p12`) |
| `MAC_CERTIFICATE_PASSWORD` | the password you set when exporting that `.p12` |
| `APPLE_ID` | the Apple ID on the developer account |
| `APPLE_APP_SPECIFIC_PASSWORD` | an app-specific password for `notarytool` |
| `APPLE_TEAM_ID` | the ten-character team identifier |

Signing needs a paid Apple Developer account. Export the certificate from Keychain
Access as a `.p12`, then `base64 -i cert.p12 | pbcopy` and paste it into the secret.

Tab groups: drag one tab onto another and both land in a tinted group named after the
target's domain. Click the group's chip to fold it away, double-click to rename it, the
mark beside it lets the tabs out. New tabs opened from inside a group join it. `⌘⇧G`
does the same with the tab beside the current one, no pointer needed.

Right click is the shelf's: keep the page, a selection of its text, an image, a video or
a link, and the clip becomes a shelf entry whose note is the quote. On a shelf card it
is open, copy and remove, and the shelf button in the toolbar has its own: keep the
current page, open the shelf, export markdown, show or hide the bar. The desktop app
builds page menus natively for the real page,
so a selection keeps with its own words and an image keeps by its source URL; the web
harness offers the same actions for the text it actually renders.

## Privacy, stated plainly

What the shell does: no Google services inside the app (Electron ships without Google
API keys, sign-in, sync or Chrome's password manager), no telemetry of ours, no account,
no server, no analytics SDK. A local profile on disk; export is a file you own.

Turbo notes are the bolt in the toolbar: one line, Enter to save, kept in the profile
with the desk and listed at `scaffold://turbo`. There is no vault, no capture and no
account behind them; a note is a line you wrote, on this machine, and nowhere else.

What this engine cannot do, on the tin: this is Electron's Chromium, not
ungoogled-chromium. It does not use Google services, but it cannot remove their code
from the binary. There is no Safe Browsing, no sync, no Web Store, and DRM video is
not guaranteed.

The engine path is ungoogled Chromium, and it is not CEF: CEF embeds Chromium's content
layer, while `chrome.tabs`, `chrome.management` and the Web Store live in the browser
layer above it, so a CEF shell could never run store extensions. `chromium/` is the new
shell — the desk on `chrome.*`, working today as a real Chromium extension, with the
frame replacement (`chrome://post` inside Chromium's own `Browser`) as the next
milestone. It is weeks-per-release work, not a weekend.

## Not built yet

- Tab drag-reorder, find-in-page, and Windows/Linux updates: the release workflow
  covers macOS only, and the unpacked Windows and Linux targets have no updater.
- Turbo notes cannot be searched or pinned yet; the list is chronological, newest first.
- Contact-sheet export, import from bookmarks, per-site width memory, annotation.
- Full Chromium extension support is not in this Electron build; it is the reason for
  the separate shell in `chromium/`, where extensions and the Web Store are Chromium's
  own and need no reimplementation.
