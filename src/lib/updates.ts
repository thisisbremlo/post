/**
 * Updates the way a browser does it: never a store, never a server of ours.
 * main is the release channel. A build knows its version and the commit it came
 * from, so when the tip of main moves past either, there is something to pull.
 */
const REPO = "thisisbremlo/post";
const API = `https://api.github.com/repos/${REPO}`;

export const APP_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0";
const APP_COMMIT = typeof __APP_COMMIT__ === "string" ? __APP_COMMIT__ : "";

import type { UpdateNotice } from "./bridge";

export interface UpdateInfo {
  version: string;
  /** Short sha of the tip of main. */
  commit: string;
  /** Short sha this build came from, or empty when built outside git. */
  from: string;
  /** First line of that commit's message, so the chip has a reason. */
  notes: string;
  url: string;
}

/** The shell's answer, compared with the commit this build was made from. */
export function updateFromCommit(notice: UpdateNotice): UpdateInfo | null {
  if (!notice.sha || notice.sha === APP_COMMIT) return null;
  return {
    version: notice.version || APP_VERSION,
    commit: notice.sha.slice(0, 7),
    from: APP_COMMIT.slice(0, 7),
    notes: notice.notes,
    url: APP_COMMIT
      ? `https://github.com/${REPO}/compare/${APP_COMMIT}...${notice.sha}`
      : `https://github.com/${REPO}`,
  };
}

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
 * Silent by design: offline, rate limited and "nothing new" all look the same
 * from here, because none of them deserve a dialog.
 */
export async function checkForUpdate(signal?: AbortSignal): Promise<UpdateInfo | null> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
  const patience = signal ?? AbortSignal.timeout(8000);
  try {
    // The version manifest is a plain file: no rate limit, no token, always there.
    const manifest = await fetch(`https://raw.githubusercontent.com/${REPO}/main/package.json`, {
      cache: "no-store",
      signal: patience,
    });
    const version = manifest.ok
      ? (((await manifest.json()) as { version?: string }).version ?? "")
      : "";

    // The commit feed adds detail when GitHub answers; it is rate limited per IP,
    // so a shared network must not be able to switch updates off.
    let sha = "";
    let notes = "";
    try {
      const head = await fetch(`${API}/commits/main`, {
        headers: { accept: "application/vnd.github+json" },
        cache: "no-store",
        signal: patience,
      });
      if (head.ok) {
        const tip = (await head.json()) as { sha?: string; commit?: { message?: string } };
        sha = tip.sha ?? "";
        notes = (tip.commit?.message ?? "").split("\n")[0] ?? "";
      }
    } catch {
      /* the commit detail is a bonus, not the check */
    }

    const versionMoved = Boolean(version) && newer(version, APP_VERSION);
    const commitMoved = Boolean(sha) && sha !== APP_COMMIT;
    if (!versionMoved && !commitMoved) return null;

    return {
      version: version || APP_VERSION,
      commit: sha.slice(0, 7),
      from: APP_COMMIT.slice(0, 7),
      notes,
      url:
        sha && APP_COMMIT
          ? `https://github.com/${REPO}/compare/${APP_COMMIT}...${sha}`
          : `https://github.com/${REPO}`,
    };
  } catch {
    return null;
  }
}
