import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Icon } from "../components/Icon";
import type { IconName } from "../components/Icon";
import { bridge, type AdblockState } from "../lib/bridge";
import { useStore } from "../state/store";
import type { Settings } from "../state/types";

const SECTIONS: { id: string; label: string; icon: IconName }[] = [
  { id: "general", label: "General", icon: "settings" },
  { id: "appearance", label: "Appearance", icon: "monitor" },
  { id: "blocking", label: "Blocking", icon: "shield" },
  { id: "privacy", label: "Privacy and Downloads", icon: "key" },
];

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** A segmented control with a filled option in every state. */
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

function Group({
  id,
  index,
  title,
  description,
  children,
}: {
  id: string;
  index: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="settings-group" id={`settings-${id}`}>
      <header className="settings-group-head">
        <span className="settings-group-index tnum">{index}</span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </header>
      <div className="settings-list">{children}</div>
    </section>
  );
}

export function SettingsPage() {
  const { state, dispatch } = useStore();
  const { settings } = state;
  const [adblock, setAdblock] = useState<AdblockState | null>(null);
  const [listInput, setListInput] = useState("");
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);
  const pageRef = useRef<HTMLDivElement>(null);

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

  // The side index follows the section the reader is actually looking at.
  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    const inspect = () => {
      const cutoff = page.getBoundingClientRect().top + 150;
      let current = SECTIONS[0].id;
      for (const section of SECTIONS) {
        const node = document.getElementById(`settings-${section.id}`);
        if (node && node.getBoundingClientRect().top <= cutoff) current = section.id;
      }
      setActiveSection(current);
    };
    page.addEventListener("scroll", inspect, { passive: true });
    inspect();
    return () => page.removeEventListener("scroll", inspect);
  }, []);

  const goToSection = (id: string) => {
    const target = document.getElementById(`settings-${id}`);
    if (!target) return;
    setActiveSection(id);
    target.scrollIntoView({
      behavior: settings.animations === "reduced" ? "auto" : "smooth",
      block: "start",
    });
  };

  const setBlocking = async (enabled: boolean) => {
    if (!bridge) return;
    const next = await bridge.setAdblockEnabled(enabled);
    setAdblock(next);
    dispatch({ type: "notice", text: enabled ? "Ad blocking enabled" : "Ad blocking disabled" });
  };

  const allowHost = async (host: string, allowed: boolean) => {
    if (!bridge) return;
    const next = await bridge.setAdblockSite(host, allowed);
    setAdblock(next);
  };

  const refreshLists = async () => {
    if (!bridge) return;
    setAdblock(await bridge.refreshAdblock());
    dispatch({ type: "notice", text: "Filter lists refreshed" });
  };

  const saveLists = async (lists: string[]) => {
    if (!bridge) return;
    setAdblock(await bridge.setAdblockLists(lists));
  };

  const addList = async () => {
    const url = listInput.trim();
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      dispatch({ type: "notice", text: "Enter a complete web address for the filter list" });
      return;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      dispatch({ type: "notice", text: "Filter lists must use an HTTP or HTTPS address" });
      return;
    }
    if (adblock?.lists.includes(url)) {
      dispatch({ type: "notice", text: "This filter list is already added" });
      return;
    }
    await saveLists([...(adblock?.lists ?? []), url]);
    setListInput("");
  };

  const listStatus = !bridge
    ? "Desktop Only"
    : adblock?.error
      ? "Lists unavailable. The previous cache is still blocking."
      : adblock?.updatedAt
        ? `Lists updated ${new Date(adblock.updatedAt).toLocaleDateString("en", {
            day: "numeric",
            month: "short",
          })}`
        : adblock?.ready
          ? "Lists loaded"
          : "Loading lists…";

  return (
    <div className="page settings-page" ref={pageRef}>
      <div className="settings-shell">
        <header className="settings-header">
          <div className="settings-heading">
            <p className="settings-kicker">Post Preferences</p>
            <h1 className="settings-title">Settings</h1>
            <p className="settings-intro">
              Choose how Post opens pages, looks, blocks content, and protects your reading.
            </p>
          </div>
          <aside className="settings-local">
            <span className="settings-local-icon">
              <Icon name="check" size={14} />
            </span>
            <div>
              <strong>Saved on this device</strong>
              <span>Your preferences stay with this desk.</span>
            </div>
          </aside>
        </header>

        <div className="settings-layout">
          <nav className="settings-nav" aria-label="Settings sections">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                className={
                  "settings-nav-item" + (activeSection === section.id ? " is-active" : "")
                }
                aria-current={activeSection === section.id ? "true" : undefined}
                onClick={() => goToSection(section.id)}
              >
                <Icon name={section.icon} size={16} />
                <span>{section.label}</span>
              </button>
            ))}
          </nav>

          <div className="settings-content">
            <Group
              id="general"
              index="01"
              title="General"
              description="How Post opens new tabs and searches from the address bar."
            >
              <section className="setting-row">
                <div className="setting-copy">
                  <h3 className="setting-name">New Tab</h3>
                  <p className="setting-note">
                    Choose what opens when you create a new tab or press ⌘T.
                  </p>
                </div>
                <div className="setting-control">
                  <Choice
                    label="New Tab"
                    value={settings.newTab}
                    onChange={(newTab) => set({ newTab })}
                    options={[
                      ["google", "Google"],
                      ["start", "Start Page"],
                    ]}
                  />
                </div>
              </section>

              <section className="setting-row">
                <div className="setting-copy">
                  <h3 className="setting-name">Search Engine</h3>
                  <p className="setting-note">
                    The address bar uses this engine when the text is not a web address.
                  </p>
                </div>
                <div className="setting-control">
                  <Choice
                    label="Search Engine"
                    value={settings.search}
                    onChange={(search) => set({ search })}
                    options={[
                      ["duckduckgo", "DuckDuckGo"],
                      ["google", "Google"],
                    ]}
                  />
                </div>
              </section>

              <section className="setting-row">
                <div className="setting-copy">
                  <h3 className="setting-name">On Launch</h3>
                  <p className="setting-note">
                    Restore the desk you left, or begin with a clean sheet each time.
                  </p>
                </div>
                <div className="setting-control">
                  <Choice
                    label="On Launch"
                    value={settings.startup}
                    onChange={(startup) => set({ startup })}
                    options={[
                      ["restore", "Restore Desk"],
                      ["fresh", "Start Fresh"],
                    ]}
                  />
                </div>
              </section>
            </Group>

            <Group
              id="appearance"
              index="02"
              title="Appearance"
              description="How the browser looks and moves while you work."
            >
              <section className="setting-row">
                <div className="setting-copy">
                  <h3 className="setting-name">Motion</h3>
                  <p className="setting-note">
                    Use full movement for menus and pages, or reduce it everywhere.
                  </p>
                </div>
                <div className="setting-control">
                  <Choice
                    label="Motion"
                    value={settings.animations}
                    onChange={(animations) => set({ animations })}
                    options={[
                      ["full", "Full"],
                      ["reduced", "Reduced"],
                    ]}
                  />
                </div>
              </section>

              <section className="setting-row">
                <div className="setting-copy">
                  <h3 className="setting-name">Page Zoom</h3>
                  <p className="setting-note">
                    Every page opens at this size. Use ⌘+ and ⌘− to adjust one page while you read.
                  </p>
                </div>
                <div className="setting-control">
                  <Choice
                    label="Page Zoom"
                    value={String(settings.zoom)}
                    onChange={(zoom) => set({ zoom: Number(zoom) as Settings["zoom"] })}
                    options={[
                      ["90", "90%"],
                      ["100", "100%"],
                      ["110", "110%"],
                      ["125", "125%"],
                    ]}
                  />
                </div>
              </section>

              <section className="setting-row">
                <div className="setting-copy">
                  <h3 className="setting-name">Bookmarks Bar</h3>
                  <p className="setting-note">
                    Keep saved pages one click away below the address bar. Press ⌘⇧B to toggle it
                    while you browse.
                  </p>
                </div>
                <div className="setting-control">
                  <Choice
                    label="Bookmarks Bar"
                    value={settings.bookmarksBar ? "show" : "hide"}
                    onChange={(value) => set({ bookmarksBar: value === "show" })}
                    options={[
                      ["show", "Show"],
                      ["hide", "Hide"],
                    ]}
                  />
                </div>
              </section>
            </Group>

            <Group
              id="blocking"
              index="03"
              title="Blocking"
              description="What Post stops before a page can load it."
            >
              <section className="setting-row">
                <div className="setting-copy">
                  <h3 className="setting-name">Ad Blocking</h3>
                  <p className="setting-note">
                    Ghostery's ad, tracking, and cookie-notice lists run in the browser's network
                    session. No extension or page script is involved.{" "}
                    {adblock
                      ? `${adblock.blocked.toLocaleString("en")} requests blocked this session.`
                      : ""}
                  </p>
                </div>
                <div className="setting-control">
                  {bridge ? (
                    <Choice
                      label="Ad Blocking"
                      value={adblock?.enabled === false ? "off" : "on"}
                      onChange={(value) => void setBlocking(value === "on")}
                      options={[
                        ["on", "On"],
                        ["off", "Off"],
                      ]}
                    />
                  ) : (
                    <span className="setting-static">Desktop Only</span>
                  )}
                </div>
              </section>

              <section className="setting-row">
                <div className="setting-copy">
                  <h3 className="setting-name">Block Notices</h3>
                  <p className="setting-note">
                    Show a short “Removed 32 ads” message below the blocker. The full panel remains
                    available either way.
                  </p>
                </div>
                <div className="setting-control">
                  <Choice
                    label="Block Notices"
                    value={settings.adblockNotices ? "show" : "hide"}
                    onChange={(value) => set({ adblockNotices: value === "show" })}
                    options={[
                      ["show", "Show"],
                      ["hide", "Hide"],
                    ]}
                  />
                </div>
              </section>

              <section className="setting-row is-stacked">
                <div className="setting-copy">
                  <h3 className="setting-name">Extra Filter Lists</h3>
                  <p className="setting-note">
                    Add EasyList-style URLs to the built-in lists. If one cannot be loaded, the
                    built-in lists keep working.
                  </p>
                </div>
                <div className="setting-control is-wide">
                  {adblock && adblock.lists.length > 0 ? (
                    <div className="settings-list-chips">
                      {adblock.lists.map((url) => (
                        <button
                          key={url}
                          type="button"
                          className="allow-chip"
                          title={`Remove ${hostLabel(url)}`}
                          onClick={() =>
                            void saveLists(adblock.lists.filter((entry) => entry !== url))
                          }
                        >
                          {hostLabel(url)}
                          <Icon name="close" size={11} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="setting-static">No extra lists. Built-in lists are active.</p>
                  )}
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
                        placeholder="https://example.com/filters.txt"
                        aria-label="Filter list address"
                        spellCheck={false}
                        onChange={(event) => setListInput(event.target.value)}
                      />
                      <button type="submit" className="setting-action">
                        Add List
                      </button>
                    </form>
                  )}
                  <div className="settings-list-status">
                    <span>{listStatus}</span>
                    {bridge && (
                      <button
                        type="button"
                        className="setting-action is-secondary"
                        onClick={() => void refreshLists()}
                      >
                        Refresh Lists
                      </button>
                    )}
                  </div>
                </div>
              </section>

              <section className="setting-row is-stacked">
                <div className="setting-copy">
                  <h3 className="setting-name">Exceptions</h3>
                  <p className="setting-note">
                    Sites you allow through the blocker. A pause applies only to the page in front;
                    every other page stays blocked.
                  </p>
                </div>
                <div className="setting-control is-wide">
                  {adblock && adblock.allow.length > 0 ? (
                    <div className="settings-list-chips">
                      {adblock.allow.map((host) => (
                        <button
                          key={host}
                          type="button"
                          className="allow-chip"
                          title={`Block ads on ${host} again`}
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
              </section>
            </Group>

            <Group
              id="privacy"
              index="04"
              title="Privacy and Downloads"
              description="What sites may ask for, and where saved files go."
            >
              <section className="setting-row">
                <div className="setting-copy">
                  <h3 className="setting-name">Downloads</h3>
                  <p className="setting-note">
                    Files are saved to your Downloads folder. Post does not open them automatically.
                  </p>
                </div>
                <div className="setting-control">
                  {bridge ? (
                    <button
                      type="button"
                      className="setting-action"
                      onClick={() => bridge?.openDownloads()}
                    >
                      Open Downloads Folder
                    </button>
                  ) : (
                    <span className="setting-static">Desktop Only</span>
                  )}
                </div>
              </section>

              <section className="setting-row">
                <div className="setting-copy">
                  <h3 className="setting-name">Do Not Track</h3>
                  <p className="setting-note">
                    Ask every site not to follow you across the web. Sites may ignore the request.
                  </p>
                </div>
                <div className="setting-control">
                  <Choice
                    label="Do Not Track"
                    value={settings.doNotTrack ? "on" : "off"}
                    onChange={(value) => set({ doNotTrack: value === "on" })}
                    options={[
                      ["on", "On"],
                      ["off", "Off"],
                    ]}
                  />
                </div>
              </section>

              <section className="setting-row">
                <div className="setting-copy">
                  <h3 className="setting-name">Site Permissions</h3>
                  <p className="setting-note">
                    Camera, microphone, location, and notifications are denied before a site can
                    ask. Nothing is remembered per site.
                  </p>
                </div>
                <div className="setting-control">
                  <span className="setting-static">Denied</span>
                </div>
              </section>
            </Group>

            <p className="settings-fineprint">
              These settings are stored with this desk and return with your sittings. Nothing is
              sent to an account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
