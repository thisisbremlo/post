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
 * An update is a small interruption: a headline, what changed, one filled
 * button, and a way out. The log only appears when the install stops.
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
      <div
        className="keep editor-dialog update-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-dialog-title"
        aria-describedby="update-dialog-intro"
      >
        <header className="editor-dialog-head">
          <span className="editor-dialog-mark">
            <Icon name="reload" size={15} />
          </span>
          <div className="editor-dialog-heading">
            <p className="editor-kicker">Update</p>
            <h2 className="editor-dialog-title" id="update-dialog-title">
              An Update Is Ready
            </h2>
          </div>
          <button
            type="button"
            className="editor-close"
            aria-label="Close"
            title="Close"
            onClick={onClose}
          >
            <Icon name="close" size={14} />
          </button>
        </header>

        <div className="editor-form update-dialog-body">
          <p className="update-dialog-intro" id="update-dialog-intro">
            A newer build of Post is here. Installing reopens it where you left off — your tabs,
            shelf and settings stay put.
          </p>

          {additions.length > 0 && (
            <section className="update-changes" aria-labelledby="update-changes-title">
              <header className="update-changes-head">
                <h3 className="update-changes-title" id="update-changes-title">
                  What Changed
                </h3>
                <span className="update-changes-count tnum">
                  {additions.length} {additions.length === 1 ? "Change" : "Changes"}
                </span>
              </header>
              <ol className="update-changes-list">
                {additions.map((title, index) => (
                  <li key={`${index}-${title}`}>
                    <span className="update-change-index tnum" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>{title}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {busy && (
            <p className="update-status" role="status">
              Installing. Post reopens when it is done.
            </p>
          )}
          {stage === "ready" && (
            <p className="update-status" role="status">
              Reopening on the new build.
            </p>
          )}

          {stage === "failed" && (
            <div className="update-fail" role="alert">
              <p>The update stopped before it finished.</p>
              <button
                type="button"
                className="setting-action is-secondary update-log"
                onClick={() => void handOverLog()}
              >
                <Icon name="copy" size={13} />
                {copied ? "Log Copied" : "Copy the Log"}
              </button>
            </div>
          )}

          {stage === "manual" && (
            <p className="update-fail">This copy cannot install itself.</p>
          )}
        </div>

        <footer className="editor-actions">
          <div className="editor-actions-meta">
            <button type="button" className="update-later" onClick={onClose}>
              {stage === "ready" ? "Close" : "Later"}
            </button>
            {!bridge && (
              <span className="editor-hint">This preview cannot update itself.</span>
            )}
          </div>
          <div className="update-dialog-buttons">
            <button
              type="button"
              className="setting-action is-secondary"
              onClick={onOpenUpdates}
            >
              Release Notes
              <Icon name="arrow-up-right" size={12} />
            </button>
            {bridge && (
              <button
                type="button"
                className="setting-action"
                disabled={busy || stage === "ready"}
                onClick={() => void install()}
              >
                {busy
                  ? "Installing…"
                  : stage === "failed"
                    ? "Try Again"
                    : stage === "ready"
                      ? "Installed"
                      : "Install and Relaunch"}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
