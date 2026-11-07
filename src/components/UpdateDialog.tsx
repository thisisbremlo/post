import { useEffect, useState } from "react";

import { bridge } from "../lib/bridge";
import { changelogPlate, type UpdateInfo } from "../lib/updates";
import { usePlateWidth } from "../lib/usePlateWidth";
import { Icon } from "./Icon";

const PULL = "git pull && npm install";

/**
 * The release, as a printed sheet: a rail with the version on the left, the
 * changelog set in an ASCII plate on the right, one action that installs it and
 * one quiet door to the updates page. Nothing here glows or explains itself twice.
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
  const [copied, setCopied] = useState(false);
  const [stage, setStage] = useState<"idle" | "running" | "failed" | "ready" | "manual">("idle");
  const [line, setLine] = useState("");
  const columns = usePlateWidth(52, 40);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // The shell reports pull, install and build as they happen, then the swap.
  useEffect(() => {
    if (!bridge) return;
    return bridge.onInstallEvent((event) => {
      setLine(event.line);
      if (event.state === "failed") setStage("failed");
      else if (event.state === "ready") setStage("ready");
      else setStage("running");
    });
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(PULL);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const install = async () => {
    if (!bridge) {
      void copy();
      return;
    }
    setStage("running");
    setLine("starting…");
    try {
      if ((await bridge.installUpdate()) === "manual") {
        setStage("manual");
        setLine("this copy was not packaged from a checkout, so it pulls itself");
      }
    } catch {
      setStage("manual");
      setLine("couldn't start the installer");
    }
  };

  const working = stage === "running";
  const primary = !bridge
    ? copied
      ? "command copied"
      : "copy the pull command"
    : working
      ? "installing…"
      : stage === "failed"
        ? "try again"
        : stage === "ready"
          ? "reopening…"
          : "install and relaunch";

  return (
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="release" role="dialog" aria-modal="true" aria-label="a newer build is on main">
        <aside className="release-rail">
          <p className="release-label">release</p>
          <p className="release-version tnum">{update.version}</p>
          <p className="release-sha tnum">{update.commit || "main"}</p>
          <span className="release-stamp">on main</span>
        </aside>

        <div className="release-body">
          <h2 className="release-title">a newer build is on main</h2>
          <pre className="release-plate">{changelogPlate(update, columns)}</pre>

          <p className="release-line">
            {bridge
              ? "Installing pulls main, rebuilds, replaces this copy and reopens. Your shelf and sittings stay on this machine."
              : "This preview cannot install. Pull the checkout, then relaunch."}
          </p>

          {(stage !== "idle" || line) && (
            <p className={"release-progress tnum" + (stage === "failed" ? " is-failed" : "")}>
              {line}
            </p>
          )}

          <div className="release-actions">
            <button
              type="button"
              className="release-primary"
              disabled={working || stage === "ready"}
              onClick={() => void install()}
            >
              {primary}
              {!working && stage !== "ready" && <Icon name="export" size={13} />}
            </button>
            <button type="button" className="release-link" onClick={onOpenUpdates}>
              what changed
              <Icon name="arrow-up-right" size={12} />
            </button>
            <button type="button" className="release-later" onClick={onClose}>
              {stage === "ready" ? "close" : "later"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
