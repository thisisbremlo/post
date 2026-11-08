import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { Icon } from "../components/Icon";
import { bridge, type AdblockState } from "../lib/bridge";
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
  const [adblock, setAdblock] = useState<AdblockState | null>(null);
  const [listInput, setListInput] = useState("");

  const set = (next: Partial<Settings>) => dispatch({ type: "settings", settings: next });

  useEffect(() => {
    if (!bridge) return;
    let live = true;
    bridge
      .getAdblockState()
      .then((next) => {
        if (live) setAdblock(next);
      })
      .catch(() => undefined);
    const off = bridge.onAdblock(setAdblock);
    return () => {
      live = false;
      off();
    };
  }, []);

  const setBlocking = async (enabled: boolean) => {
    if (!bridge) return;
    const next = await bridge.setAdblockEnabled(enabled);
    setAdblock(next);
    dispatch({ type: "notice", text: enabled ? "ad blocking on" : "ad blocking off" });
  };

  const allowHost = async (host: string, allowed: boolean) => {
    if (!bridge) return;
    const next = await bridge.setAdblockSite(host, allowed);
    setAdblock(next);
  };

  const refreshLists = async () => {
    if (!bridge) return;
    setAdblock(await bridge.refreshAdblock());
    dispatch({ type: "notice", text: "ad lists refreshed" });
  };

  const saveLists = async (lists: string[]) => {
    if (!bridge) return;
    setAdblock(await bridge.setAdblockLists(lists));
  };

  const addList = async () => {
    const url = listInput.trim();
    try {
      if (!/^https?:$/.test(new URL(url).protocol)) throw new Error("not a web address");
    } catch {
      dispatch({ type: "notice", text: "a filter list needs a complete https address" });
      return;
    }
    if (adblock?.lists.includes(url)) {
      dispatch({ type: "notice", text: "that list is already in the mix" });
      return;
    }
    await saveLists([...(adblock?.lists ?? []), url]);
    setListInput("");
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

        <Group title="blocking">
          <section className="setting-row">
            <div className="setting-copy">
              <h3 className="setting-name">ad blocking</h3>
              <p className="setting-note">
                Ghostery's ads, tracking and cookie-notice lists, enforced in the browser's network
                session — no extension, no page script.{" "}
                {adblock ? `${adblock.blocked} requests blocked this session.` : ""}
              </p>
            </div>
            {bridge ? (
              <Choice
                label="ad blocking"
                value={adblock?.enabled === false ? "off" : "on"}
                onChange={(value) => void setBlocking(value === "on")}
                options={[
                  ["on", "on"],
                  ["off", "off"],
                ]}
              />
            ) : (
              <span className="setting-static">desktop only</span>
            )}
          </section>

          <section className="setting-row">
            <div className="setting-copy">
              <h3 className="setting-name">block notices</h3>
              <p className="setting-note">
                A small “Removed 32 ads” line under the blocker when a page loses something. The
                panel stays available either way.
              </p>
            </div>
            <Choice
              label="block notices"
              value={settings.adblockNotices ? "show" : "hide"}
              onChange={(value) => set({ adblockNotices: value === "show" })}
              options={[
                ["show", "show"],
                ["hide", "hide"],
              ]}
            />
          </section>

          <section className="setting-row">
            <div className="setting-copy">
              <h3 className="setting-name">extra lists</h3>
              <p className="setting-note">
                EasyList-style URLs, merged with the built-in ads and tracking lists. A list that
                cannot be fetched leaves the built-in lists working.
              </p>
              {adblock && adblock.lists.length > 0 ? (
                <div className="adblock-allow">
                  {adblock.lists.map((url) => (
                    <button
                      key={url}
                      type="button"
                      className="allow-chip"
                      title="remove this list"
                      onClick={() =>
                        void saveLists(adblock.lists.filter((entry) => entry !== url))
                      }
                    >
                      {(() => {
                        try {
                          return new URL(url).hostname;
                        } catch {
                          return url;
                        }
                      })()}
                      <Icon name="close" size={11} />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="setting-static">None — built-in lists only.</p>
              )}
            </div>
            {bridge && (
              <form
                className="adblock-list-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void addList();
                }}
              >
                <input
                  className="text-input"
                  value={listInput}
                  placeholder="https://…/filters.txt"
                  aria-label="extra filter list address"
                  spellCheck={false}
                  onChange={(event) => setListInput(event.target.value)}
                />
                <button type="submit" className="setting-action">
                  add list
                </button>
              </form>
            )}
          </section>

          <section className="setting-row">
            <div className="setting-copy">
              <h3 className="setting-name">exceptions</h3>
              <p className="setting-note">
                Sites you let through. A pause follows the page in front; the rest stay blocked.
              </p>
              {adblock && adblock.allow.length > 0 ? (
                <div className="adblock-allow">
                  {adblock.allow.map((host) => (
                    <button
                      key={host}
                      type="button"
                      className="allow-chip"
                      title={`block ads on ${host} again`}
                      onClick={() => void allowHost(host, false)}
                    >
                      {host}
                      <Icon name="close" size={11} />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="setting-static">No exceptions.</p>
              )}
            </div>
            <div className="adblock-status">
              <span className="setting-static">
                {adblock?.error
                  ? "lists unavailable — the old cache is still in use"
                  : adblock?.updatedAt
                    ? `lists from ${new Date(adblock.updatedAt).toLocaleDateString("en", {
                        day: "numeric",
                        month: "short",
                      })}`
                    : adblock?.ready
                      ? "lists loaded"
                      : "loading lists…"}
              </span>
              {bridge && (
                <button type="button" className="setting-action" onClick={() => void refreshLists()}>
                  refresh lists
                </button>
              )}
            </div>
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

        <p className="fineprint">
          These live with the desk in this profile, so they come back with your sittings. Nothing
          here is sent anywhere, and there is no account to sync them to.
        </p>
      </div>
    </div>
  );
}
