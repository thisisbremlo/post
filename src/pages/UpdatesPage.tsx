import { useEffect, useState } from "react";

import { Mark } from "../components/Mark";
import { bridge } from "../lib/bridge";
import { APP_VERSION, checkForUpdate, latestUpdate, type UpdateInfo } from "../lib/updates";
import { useInstall } from "../lib/useInstall";

/** The changelog as prose lines. A page you can read, not a diff you can audit. */
function additionsOf(update: UpdateInfo): string[] {
  const titles = update.entries.map((entry) => entry.title).filter(Boolean);
  return titles.length > 0 ? titles : update.notes ? [update.notes] : [];
}

/**
 * The update site, set like the reference: a large headline, a bordered panel of
 * changes, filled actions, hairlines between sections. No versions to compare,
 * no shas, no diff. The paper follows the system's light or dark setting.
 */
export function UpdatesPage() {
  const [update, setUpdate] = useState<UpdateInfo | null>(latestUpdate());
  const [copied, setCopied] = useState(false);
  const { stage, install, copyLog, busy } = useInstall();

  // The harness has no shell to push a notice, so the page asks for itself.
  useEffect(() => {
    if (update || bridge) return;
    let live = true;
    checkForUpdate().then((found) => {
      if (live) setUpdate(found);
    });
    return () => {
      live = false;
    };
  }, [update]);

  const additions = update ? additionsOf(update) : [];

  const handOverLog = async () => {
    setCopied(await copyLog());
  };

  return (
    <div className="page updates">
      <div className="updates-shell">
        <header className="updates-head">
          <span className="updates-brand">
            <Mark size={18} />
            Post
          </span>
          <span className="updates-where">updates</span>
        </header>

        <div className="updates-hero">
          <div className="updates-copy">
            <p className="updates-kicker">release notes</p>
            <h1 className="updates-title">What changed in Post.</h1>
            <p className="updates-lede">
              The newest additions, newest first. Installing reopens the app where you left off;
              your tabs, shelf and settings stay where they are.
            </p>

            <div className="updates-actions">
              {bridge ? (
                <button
                  type="button"
                  className="updates-primary"
                  disabled={busy || stage === "ready"}
                  onClick={() => void install()}
                >
                  {busy ? "installing…" : stage === "failed" ? "try again" : "install and relaunch"}
                </button>
              ) : (
                <span className="updates-quiet">This preview cannot update itself.</span>
              )}
            </div>

            {busy && <p className="updates-status">Post reopens when it is done.</p>}
            {stage === "ready" && <p className="updates-status">Reopening on the new build.</p>}

            {stage === "failed" && (
              <p className="updates-fail">
                It stopped before it finished.
                <button
                  type="button"
                  className="updates-secondary"
                  onClick={() => void handOverLog()}
                >
                  {copied ? "log copied" : "copy the log"}
                </button>
              </p>
            )}
          </div>

          <section className="updates-panel" aria-label="newest additions">
            <p className="updates-label">{additions.length > 0 ? "Newest" : "Latest"}</p>
            {additions.length > 0 ? (
              <ol className="updates-list">
                {additions.map((title, index) => (
                  <li key={`${index}-${title}`}>
                    <span className="updates-count tnum" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>{title}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="updates-empty">
                This copy is level with the newest build. Nothing to read here until something
                lands.
              </p>
            )}
          </section>
        </div>

        <section className="updates-section">
          <h2 className="updates-heading">Installing</h2>
          <p className="updates-body">
            Post updates itself from the copy it was built from, then reopens. Nothing is sent
            anywhere, and no account is involved.
          </p>
        </section>

        <footer className="updates-foot">
          <span className="tnum">v{APP_VERSION}</span>
          <Mark size={14} />
        </footer>
      </div>
    </div>
  );
}
