import { useEffect, useState } from "react";

import { bridge } from "../lib/bridge";
import type { UpdateInfo } from "../lib/updates";
import { useInstall } from "../lib/useInstall";
import { Icon } from "./Icon";

const SHOWN = 5;

/** The changelog as a list of words, not a receipt: no versions, no shas. */
function additionsOf(update: UpdateInfo): string[] {
  const titles = update.entries.map((entry) => entry.title).filter(Boolean);
  if (titles.length > 0) return titles.slice(0, SHOWN);
  return update.notes ? [update.notes] : [];
}

/**
 * An update is a small interruption: what is new, one button, and a way out.
 * The technical narration only appears if the install stops, and only as a log
 * to copy for whoever fixes it.
 */
export function UpdateDialog({
  update,
  onClose,
  onOpenUpdates,
}: {
  update: UpdateInfo;
  onClose: () => void;
  onOpenUpdates: () => void;
}) {
  const { stage, install, copyLog, busy } = useInstall();
  const [copied, setCopied] = useState(false);
  const additions = additionsOf(update);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handOverLog = async () => {
    setCopied(await copyLog());
  };

  return (
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="release-note" role="dialog" aria-modal="true" aria-label="an update is ready">
        <p className="release-note-kicker">update</p>
        <h2 className="release-note-title">An update is ready.</h2>
        <p className="release-note-body">
          Install it and Post comes back where you left off — your tabs, shelf and settings stay
          put.
        </p>

        {additions.length > 0 && (
          <>
            <p className="release-note-label">Newest</p>
            <ul className="release-note-list">
              {additions.map((title, index) => (
                <li key={`${index}-${title}`}>{title}</li>
              ))}
            </ul>
          </>
        )}

        {stage === "failed" && (
          <p className="release-note-fail">
            The update stopped before it finished.
            <button type="button" className="release-note-log" onClick={() => void handOverLog()}>
              {copied ? "log copied" : "copy the log"}
            </button>
          </p>
        )}

        {stage === "manual" && <p className="release-note-fail">This copy cannot install itself.</p>}

        <div className="release-note-actions">
          {bridge ? (
            <button
              type="button"
              className="release-note-primary"
              disabled={busy || stage === "ready"}
              onClick={() => void install()}
            >
              {busy ? "installing…" : stage === "failed" ? "try again" : "install and relaunch"}
            </button>
          ) : (
            <span className="release-note-quiet">This preview cannot update itself.</span>
          )}
          <button type="button" className="release-note-quiet" onClick={onOpenUpdates}>
            what changed
            <Icon name="arrow-up-right" size={11} />
          </button>
          <button type="button" className="release-note-quiet" onClick={onClose}>
            {stage === "ready" ? "close" : "later"}
          </button>
        </div>
      </div>
    </div>
  );
}
