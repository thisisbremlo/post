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

export function SettingsPage() {
  const { state, dispatch } = useStore();
  const { settings } = state;

  const set = (next: Partial<Settings>) => dispatch({ type: "settings", settings: next });

  return (
    <div className="page">
      <div className="page-inner">
        <header className="page-head">
          <div>
            <h1 className="page-title">settings</h1>
            <p className="page-meta">what this browser does, not what it looks like</p>
          </div>
        </header>

        <div className="settings-list">
          <section className="setting-row">
            <div className="setting-copy">
              <h2 className="setting-name">new tab</h2>
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
              <h2 className="setting-name">search</h2>
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
              <h2 className="setting-name">motion</h2>
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
        </div>

        <p className="fineprint">
          These live with the desk in this profile, so they come back with your sittings. Nothing
          here is sent anywhere, and there is no account to sync them to.
        </p>
      </div>
    </div>
  );
}
