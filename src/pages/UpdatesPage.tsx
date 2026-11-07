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
 * The update site, set like a small black page: one narrow column, plain words,
 * the newest additions, and one quiet action. No versions to compare, no shas,
 * no diff — a designer does not need any of it.
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
      <div className="updates-column">
        <header className="updates-head">
          <Mark size={20} />
          <span className="updates-where">updates</span>
        </header>

        <p className="updates-name">(Post) updates</p>
        <p className="updates-body">
          The newest additions to Post, newest first. Installing reopens the app where you left
          off; your tabs, shelf and settings stay where they are.
        </p>

        {additions.length > 0 ? (
          <section className="updates-section">
            <h1 className="updates-heading">Latest</h1>
            <ul className="updates-list">
              {additions.map((title, index) => (
                <li key={`${index}-${title}`}>{title}</li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="updates-body updates-level">
            This copy is level with the newest build. Nothing to read here until something lands.
          </p>
        )}

        <section className="updates-section">
          <h2 className="updates-heading">Installing</h2>
          <p className="updates-body">
            Post rebuilds itself from the copy it was packaged from, then reopens. Nothing is sent
            anywhere, and no account is involved.
          </p>

          {bridge ? (
            <p className="updates-run">
              <button
                type="button"
                className="updates-action"
                disabled={busy || stage === "ready"}
                onClick={() => void install()}
              >
                {busy ? "installing…" : stage === "failed" ? "try again" : "install and relaunch"}
              </button>
              {stage === "ready" && <span className="updates-quiet">reopening…</span>}
            </p>
          ) : (
            <p className="updates-quiet">This preview cannot update itself.</p>
          )}

          {stage === "failed" && (
            <p className="updates-fail">
              It stopped before it finished.
              <button type="button" className="updates-action" onClick={() => void handOverLog()}>
                {copied ? "log copied" : "copy the log"}
              </button>
            </p>
          )}
        </section>

        <footer className="updates-foot">
          <span className="tnum">v{APP_VERSION}</span>
          <Mark size={14} />
        </footer>
      </div>
    </div>
  );
}
