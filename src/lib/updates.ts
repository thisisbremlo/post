/**
 * Updates the way a browser does it: no store, no server of ours, no token.
 * The build knows its version and the commit it came from; the repo publishes a
 * small `update.json` and GitHub publishes the tip of main, so a newer commit is
 * visible even when nobody remembered to bump the version.
 */
const REPO = "thisisbremlo/post";
const API = `https://api.github.com/repos/${REPO}`;
const FEED = `https://raw.githubusercontent.com/${REPO}/main/update.json`;

export const APP_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0";
const APP_COMMIT = typeof __APP_COMMIT__ === "string" ? __APP_COMMIT__ : "";

export interface UpdateInfo {
  version: string;
  /** Short sha of the tip of main, when GitHub answered. */
  commit: string;
  /** Short sha this build came from, or empty when built outside git. */
  from: string;
  /** The line the repo published about it. */
  notes: string;
  url: string;
}

import type { UpdateNotice } from "./bridge";

function newer(remote: string, local: string): boolean {
  const a = remote.split(".").map((part) => Number(part) || 0);
  const b = local.split(".").map((part) => Number(part) || 0);
  for (let index = 0; index < 3; index += 1) {
    if ((a[index] ?? 0) > (b[index] ?? 0)) return true;
    if ((a[index] ?? 0) < (b[index] ?? 0)) return false;
  }
  return false;
}

/**
 * Commits are the real signal; the published version is the fallback for a
 * network where the commit feed is rate limited or blocked.
 */
export function updateFromCommit(notice: UpdateNotice): UpdateInfo | null {
  const commitMoved = Boolean(notice.sha) && notice.sha !== APP_COMMIT;
  const versionMoved = Boolean(notice.version) && newer(notice.version, APP_VERSION);
  if (!commitMoved && !versionMoved) return null;

  return {
    version: notice.version || APP_VERSION,
    commit: notice.sha.slice(0, 7),
    from: APP_COMMIT.slice(0, 7),
    notes: notice.notes,
    url:
      notice.sha && APP_COMMIT
        ? `https://github.com/${REPO}/compare/${APP_COMMIT}...${notice.sha}`
        : `https://github.com/${REPO}`,
  };
}

/** What main is, for the harness. Silent about offline, rate limits and nothing new. */
export async function checkForUpdate(signal?: AbortSignal): Promise<UpdateInfo | null> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
  const patience = signal ?? AbortSignal.timeout(8000);
  try {
    const [feed, head] = await Promise.all([
      fetch(FEED, { cache: "no-store", signal: patience })
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null),
      fetch(`${API}/commits/main`, {
        headers: { accept: "application/vnd.github+json" },
        cache: "no-store",
        signal: patience,
      })
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null),
    ]);

    return updateFromCommit({
      sha: (head as { sha?: string } | null)?.sha ?? "",
      version: (feed as { version?: string } | null)?.version ?? "",
      notes:
        (feed as { notes?: string } | null)?.notes ??
        ((head as { commit?: { message?: string } } | null)?.commit?.message ?? "").split("\n")[0] ??
        "",
    });
  } catch {
    return null;
  }
}
