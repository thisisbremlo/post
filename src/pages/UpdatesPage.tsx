import { useEffect, useState } from "react";

import { bridge } from "../lib/bridge";
import {
  APP_COMMIT,
  APP_VERSION,
  changelogPlate,
  checkForUpdate,
  latestUpdate,
  type UpdateInfo,
} from "../lib/updates";
import { usePlateWidth } from "../lib/usePlateWidth";
import { Icon } from "../components/Icon";

const PULL = "git pull && npm install";

/** What main has that this copy does not, with the changelog and one door out. */
export function UpdatesPage() {
  const [update, setUpdate] = useState<UpdateInfo | null>(latestUpdate());
  const [line, setLine] = useState("");
  const [busy, setBusy] = useState(false);
  const columns = usePlateWidth(60, 40);

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

  useEffect(() => {
    if (!bridge) return;
    return bridge.onInstallEvent((event) => {
      setLine(event.line);
      setBusy(event.state !== "ready" && event.state !== "failed");
    });
  }, []);

  const install = async () => {
    if (!bridge) {
      try {
        await navigator.clipboard.writeText(PULL);
        setLine("command copied");
      } catch {
        setLine("couldn't copy — select the command instead");
      }
      return;
    }
    setBusy(true);
    setLine("starting…");
    try {
      if ((await bridge.installUpdate()) === "manual") {
        setBusy(false);
        setLine("this copy was not packaged from a checkout, so it pulls itself");
      }
    } catch {
      setBusy(false);
      setLine("couldn't start the installer");
    }
  };

  return (
    <div className="page">
      <div className="page-inner">
        <header className="page-head">
          <div>
            <h1 className="page-title">updates</h1>
            <p className="page-meta tnum">
              this build {APP_VERSION} · {APP_COMMIT.slice(0, 7) || "unversioned"}
            </p>
          </div>
        </header>

        {update ? (
          <>
            <pre className="release-plate release-plate--page">
              {changelogPlate(update, columns)}
            </pre>

            <div className="updates-actions">
              <button type="button" className="release-primary" disabled={busy} onClick={() => void install()}>
                {bridge ? (busy ? "installing…" : "install and relaunch") : "copy the pull command"}
                <Icon name="export" size={13} />
              </button>
              <a className="release-link" href={update.url} target="_blank" rel="noreferrer noopener">
                the diff on GitHub
                <Icon name="arrow-up-right" size={12} />
              </a>
            </div>

            {line && <p className="release-progress tnum">{line}</p>}

            <ol className="changelog">
              {update.entries.map((entry, index) => (
                <li className="changelog-row" key={`${entry.sha}-${index}`}>
                  <span className="changelog-sha tnum">{entry.sha.slice(0, 7)}</span>
                  <span className="changelog-title">{entry.title || "no subject"}</span>
                  <span className="changelog-date tnum">
                    {entry.date ? entry.date.slice(0, 10) : ""}
                  </span>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="empty">
            This copy is level with main. Nothing to read here until a commit lands.
          </p>
        )}

        <p className="fineprint">
          Updates are read from the public repo, never from a store or an account. Installing
          builds from the checkout this copy was packaged from; your shelf, groups and sittings
          are untouched either way.
        </p>
      </div>
    </div>
  );
}
