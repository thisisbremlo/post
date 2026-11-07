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
  Capture and fill in the password vault only run in the desktop app.

State lives in the chrome: tabs, back stacks, tab groups, the shelf, sittings, the
reference pane. It persists to the profile on disk and, in the desktop app, syncs the
layout to main. Tab groups are part of that state, not a view setting: fold the window
and every group comes back as it was, collapsed ones included.

## The six behaviours

| | |
|---|---|
| **Keep** `⌘D` | one focused note field, address above it. The note is the product |
| **Hold** `⌘⇧R` | a reference pane that belongs to the browser, not to a tab |
| **Measure** | 360 / 768 / fit, applied to the live page, width stated in mono |
| **Recall** `⌘K` | tabs, shelf and history together, notes searchable, deduped |
| **Set aside** | name the desk, close it, restore it with its order intact |
| **Leave** | the shelf exports as Markdown: title, URL, note |

Keys: `⌘T` `⌘W` `⌘L` `⌘R` `⌘D` `⌘K` `⌘⇧R` `⌘⇧G` `⌘⇧H` `⌘1…9`. Browser keys only.

The start sheet is not a tab: it sits on the home button beside back, forward and
reload, so the strip only ever holds pages you went somewhere to reach. There is one
start sheet, never two.

Breakpoints move like a window edge, not like a toggle: 360, 768 and fit are a real
viewport width, so the sheet is animated to its new width (Motion) and the native view
follows it frame by frame through the layout sync. A window resize follows the window
with no easing, because nothing there should lag behind the pointer.

Updates are Chrome's, minus the store: a build bakes the commit it came from, main is
the release channel, and the app checks the tip of main at launch and every six hours.
In the shell that check goes through the checkout's own git remote, which is what lets a
private repo work without a token; the web harness asks the public feed and stays quiet
when it cannot answer.
When main has moved past the running build, a small `update` chip appears in the
toolbar; it says which build is on main, gives the pull command, and offers to
relaunch. Nothing installs behind your back, and nothing of yours moves.

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

What the shell does: no Google services (Electron ships without Google API keys,
sign-in, sync or the Chrome password manager), no telemetry of ours, no account, no
server, no analytics SDK. A local profile on disk; export is a file you own.

The credentials vault is one file in the profile, sealed with the OS keystore through
`safeStorage` (Keychain, DPAPI, libsecret/KWallet). Without a keyring it falls back to
an AES-256-GCM key file with `0600` permissions, and the passwords page says so rather
than pretending. The chrome only ever learns origin and username; capture and fill go
through the page's isolated preload.

What this engine cannot do, on the tin: this is Electron's Chromium, not
ungoogled-chromium. It does not use Google services, but it cannot remove their code
from the binary. There is no Safe Browsing, no sync, no Web Store, and DRM video is
not guaranteed. The engine path in the concept — CEF built from ungoogled-chromium —
is the next move, and it is weeks-per-release work, not a weekend.

## Not built yet

- Favicons, tab drag-reorder, downloads, find-in-page, packaging and signing.
- Capture and fill are wired in the shell but not exercised here: this environment has
  no display, so the Electron path is unverified beyond review.
- Contact-sheet export, import from bookmarks, per-site width memory, annotation.
- Extension support is deliberately absent for now; it quietly undermines the posture.
