import { useEffect, useState } from "react";

import { bridge } from "./bridge";

export type InstallStage = "idle" | "running" | "failed" | "ready" | "manual";

/**
 * The shell narrates a pull and a build; none of that belongs on screen. What a
 * person needs is whether it is working, whether it stopped, and a log to hand
 * over when it did.
 */
export function useInstall() {
  const [stage, setStage] = useState<InstallStage>("idle");
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    if (!bridge) return;
    return bridge.onInstallEvent((event) => {
      setLog((lines) => [...lines, event.line].filter(Boolean));
      if (event.state === "failed") setStage("failed");
      else if (event.state === "ready") setStage("ready");
      else setStage("running");
    });
  }, []);

  const install = async () => {
    if (!bridge) return;
    setStage("running");
    try {
      if ((await bridge.installUpdate()) === "manual") setStage("manual");
    } catch {
      setStage("failed");
    }
  };

  const copyLog = async () => {
    try {
      await navigator.clipboard.writeText(log.join("\n") || "nothing was logged");
      return true;
    } catch {
      return false;
    }
  };

  return { stage, log, install, copyLog, busy: stage === "running" };
}
