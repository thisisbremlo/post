import type { ReactNode } from "react";

import { bridge } from "../lib/bridge";
import { useStore } from "../state/store";
import type { Settings } from "../state/types";

/** A row of pills, one of which is always on: no dropdowns, no save button. */
function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (next: T) => void;
}) {
  return (
    <div className="choice" role="group" aria-label={label}>
      {options.map(([key, text]) => (
        <button
          key={key}
          type="button"
          className={"choice-pill" + (key === value ? " is-on" : "")}
          aria-pressed={key === value}
          onClick={() => onChange(key)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="settings-group">
      <h2 className="settings-group-title">{title}</h2>
      <div className="settings-list">{children}</div>
    </section>
  );
}

export function SettingsPage() {
  const { state, dispatch } = useStore();
  const { settings } = state;

  const set = (next: Partial<Settings>) => dispatch({ type: "settings", settings: next });

  const addExtension = async () => {
    if (!bridge) return;
    try {
      await bridge.addExtension();
      dispatch({ type: "notice", text: "extension added — it is in the toolbar" });
      window.dispatchEvent(new CustomEvent("scaffold:extensions-changed"));
    } catch {
      dispatch({ type: "notice", text: "that folder is not an unpacked extension" });
    }
  };

  return (
    <div className="page">
      <div className="page-inner">
        <header className="page-head">
          <div>
            <h1 className="page-title">settings</h1>
            <p className="page-meta">how this browser behaves, and what it lets through</p>
          </div>
        </header>

        <Group title="general">
          <section className="setting-row">
            <div className="setting-copy">
              <h3 className="setting-name">new tab</h3>
              <p className="setting-note">What the plus button and ⌘T open.</p>
            </div>
            <Choice
              label="new tab"
              value={settings.newTab}
              onChange={(newTab) => set({ newTab })}
              options={[
                ["google", "Google"],
                ["start", "start sheet"],
              ]}
            />
          </section>

          <section className="setting-row">
            <div className="setting-copy">
              <h3 className="setting-name">search</h3>
              <p className="setting-note">
                Where the address bar sends what is not an address, and where ⌘K does too.
              </p>
            </div>
            <Choice
              label="search"
              value={settings.search}
              onChange={(search) => set({ search })}
              options={[
                ["duckduckgo", "DuckDuckGo"],
                ["google", "Google"],
              ]}
            />
          </section>

          <section className="setting-row">
            <div className="setting-copy">
              <h3 className="setting-name">on launch</h3>
              <p className="setting-note">
                Continue the desk you left, or start each morning on a clean sheet.
              </p>
            </div>
            <Choice
              label="on launch"
              value={settings.startup}
              onChange={(startup) => set({ startup })}
              options={[
                ["restore", "carry on"],
                ["fresh", "clean sheet"],
              ]}
            />
          </section>
        </Group>

        <Group title="appearance">
          <section className="setting-row">
            <div className="setting-copy">
              <h3 className="setting-name">motion</h3>
              <p className="setting-note">
                Small movements on open, close and hover. Off is instant, everywhere.
              </p>
            </div>
            <Choice
              label="motion"
              value={settings.animations}
              onChange={(animations) => set({ animations })}
              options={[
                ["full", "full"],
                ["reduced", "off"],
              ]}
            />
          </section>

          <section className="setting-row">
            <div className="setting-copy">
              <h3 className="setting-name">page zoom</h3>
              <p className="setting-note">
                Every page opens at this size. ⌘+ and ⌘− still adjust a single page while you read.
              </p>
            </div>
            <Choice
              label="page zoom"
              value={String(settings.zoom)}
              onChange={(zoom) => set({ zoom: Number(zoom) as Settings["zoom"] })}
              options={[
                ["90", "90%"],
                ["100", "100%"],
                ["110", "110%"],
                ["125", "125%"],
              ]}
            />
          </section>

          <section className="setting-row">
            <div className="setting-copy">
              <h3 className="setting-name">bookmarks bar</h3>
              <p className="setting-note">
                The Chrome-style strip under the address bar. ⌘⇧B toggles it while you browse.
              </p>
            </div>
            <Choice
              label="bookmarks bar"
              value={settings.bookmarksBar ? "show" : "hide"}
              onChange={(value) => set({ bookmarksBar: value === "show" })}
              options={[
                ["show", "show"],
                ["hide", "hide"],
              ]}
            />
          </section>
        </Group>

        <Group title="downloads & privacy">
          <section className="setting-row">
            <div className="setting-copy">
              <h3 className="setting-name">downloads</h3>
              <p className="setting-note">
                Files land in the folder macOS calls Downloads. Nothing is opened for you.
              </p>
            </div>
            {bridge ? (
              <button
                type="button"
                className="setting-action"
                onClick={() => bridge?.openDownloads()}
              >
                open the folder
              </button>
            ) : (
              <span className="setting-static">desktop only</span>
            )}
          </section>

          <section className="setting-row">
            <div className="setting-copy">
              <h3 className="setting-name">do not track</h3>
              <p className="setting-note">
                Ask every page not to follow you across sites. Honest sites listen; the rest may
                not.
              </p>
            </div>
            <Choice
              label="do not track"
              value={settings.doNotTrack ? "on" : "off"}
              onChange={(value) => set({ doNotTrack: value === "on" })}
              options={[
                ["on", "on"],
                ["off", "off"],
              ]}
            />
          </section>

          <section className="setting-row">
            <div className="setting-copy">
              <h3 className="setting-name">site permissions</h3>
              <p className="setting-note">
                Camera, microphone, location and notifications are refused before a page can ask.
                There is no prompt to click through, and nothing is remembered per site.
              </p>
            </div>
            <span className="setting-static">denied</span>
          </section>
        </Group>

        <Group title="extensions">
          <section className="setting-row">
            <div className="setting-copy">
              <h3 className="setting-name">chrome extensions</h3>
              <p className="setting-note">
                Unpacked Chrome extensions run here, listed behind the puzzle in the toolbar.
                Install one from its folder.
              </p>
            </div>
            {bridge ? (
              <button type="button" className="setting-action" onClick={() => void addExtension()}>
                add an extension…
              </button>
            ) : (
              <span className="setting-static">desktop only</span>
            )}
          </section>
        </Group>

        <p className="fineprint">
          These live with the desk in this profile, so they come back with your sittings. Nothing
          here is sent anywhere, and there is no account to sync them to.
        </p>
      </div>
    </div>
  );
}
