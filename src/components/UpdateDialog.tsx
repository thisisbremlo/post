import { useEffect, useState } from "react";

import { bridge } from "../lib/bridge";
import type { UpdateInfo } from "../lib/updates";
import { Icon } from "./Icon";

const PULL = "git pull && npm install";

/** What Chrome's "update ready · relaunch" bubble would say if it were honest. */
export function UpdateDialog({ update, onClose }: { update: UpdateInfo; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(PULL);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="keep update" role="dialog" aria-modal="true" aria-label="an update is ready">
        <p className="update-kicker tnum">
          Scaffold {update.version}
          {update.notes ? ` · ${update.notes}` : ""}
        </p>
        <p className="update-title">A newer build is on main</p>
        <p className="update-line">
          This build is from {update.from || "an older commit"}; main is{" "}
          {update.commit ? `at ${update.commit}` : `on ${update.version}`}. Pull it, then relaunch.
          Nothing of yours moves — the shelf, the groups and the sittings live on this machine.
        </p>

        <div className="update-cmd">
          <code>{PULL}</code>
          <button
            type="button"
            className="icon-btn"
            aria-label="copy the update command"
            title={copied ? "copied" : "copy the command"}
            onClick={() => void copy()}
          >
            <Icon name={copied ? "check" : "copy"} size={14} />
          </button>
        </div>

        <div className="update-foot">
          <button type="button" className="text-action" onClick={onClose}>
            later
          </button>
          {bridge ? (
            <button
              type="button"
              className="update-go"
              onClick={() => {
                onClose();
                bridge!.relaunch();
              }}
            >
              relaunch
              <Icon name="reload" size={13} />
            </button>
          ) : (
            <a
              className="update-go"
              href={update.url}
              target="_blank"
              rel="noreferrer noopener"
            >
              see the change
              <Icon name="arrow-up-right" size={13} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
