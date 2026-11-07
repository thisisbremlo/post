/**
 * Updates the way a browser does it: no store, no server of ours, no token.
 * The build knows its version and the commit it came from; the repo publishes a
 * small `update.json` and GitHub publishes the tip of main, so a newer commit is
 * visible even when nobody remembered to bump the version. The commit subjects
 * travel with it, because a changelog is what people actually read.
 */
import type { ChangelogEntry, UpdateNotice } from "./bridge";

const REPO = "thisisbremlo/post";
const API = `https://api.github.com/repos/${REPO}`;
const FEED = `https://raw.githubusercontent.com/${REPO}/main/update.json`;

export const APP_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0";
export const APP_COMMIT = typeof __APP_COMMIT__ === "string" ? __APP_COMMIT__ : "";

export interface UpdateInfo {
  version: string;
  /** Short sha of the tip of main, when GitHub answered. */
  commit: string;
  /** Short sha this build came from, or empty when built outside git. */
  from: string;
  /** The line the repo published about it. */
  notes: string;
  /** The changelog: commit subjects, newest first. */
  entries: ChangelogEntry[];
  url: string;
}

/** The last thing a check found, so the updates page can read it without asking again. */
let latest: UpdateInfo | null = null;

export function latestUpdate(): UpdateInfo | null {
  return latest;
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
 * Commits are the real signal; the published version is the fallback for a
 * network where the commit feed is rate limited or blocked.
 */
export function updateFromCommit(notice: UpdateNotice): UpdateInfo | null {
  const commitMoved = Boolean(notice.sha) && notice.sha !== APP_COMMIT;
  const versionMoved = Boolean(notice.version) && newer(notice.version, APP_VERSION);
  if (!commitMoved && !versionMoved) return null;

  const entries =
    notice.entries && notice.entries.length > 0
      ? notice.entries
      : notice.sha || notice.notes
        ? [{ sha: notice.sha, title: notice.notes, date: "" }]
        : [];

  latest = {
    version: notice.version || APP_VERSION,
    commit: notice.sha.slice(0, 7),
    from: APP_COMMIT.slice(0, 7),
    notes: notice.notes,
    entries,
    url:
      notice.sha && APP_COMMIT && notice.sha !== APP_COMMIT
        ? `https://github.com/${REPO}/compare/${APP_COMMIT}...${notice.sha}`
        : `https://github.com/${REPO}`,
  };
  return latest;
}

interface GhCommit {
  sha?: string;
  commit?: { message?: string; committer?: { date?: string } };
}

/** What main is, for the harness. Silent about offline, rate limits and nothing new. */
export async function checkForUpdate(signal?: AbortSignal): Promise<UpdateInfo | null> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return null;
  const patience = signal ?? AbortSignal.timeout(8000);
  try {
    const [feed, commits] = await Promise.all([
      fetch(FEED, { cache: "no-store", signal: patience })
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null),
      fetch(`${API}/commits?per_page=8`, {
        headers: { accept: "application/vnd.github+json" },
        cache: "no-store",
        signal: patience,
      })
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null),
    ]);

    const list = (Array.isArray(commits) ? commits : []) as GhCommit[];
    const head = list[0];
    if (!head && !feed) return null;

    return updateFromCommit({
      sha: head?.sha ?? "",
      version: (feed as { version?: string } | null)?.version ?? "",
      notes:
        (feed as { notes?: string } | null)?.notes ??
        (head?.commit?.message ?? "").split("\n")[0] ??
        "",
      entries: list.map((commit) => ({
        sha: commit.sha ?? "",
        title: (commit.commit?.message ?? "").split("\n")[0] ?? "",
        date: commit.commit?.committer?.date ?? "",
      })),
    });
  } catch {
    return null;
  }
}

/**
 * The changelog as an ASCII plate: a printed colophon, not a card of chips.
 * Width is in monospace columns, so it lines up with its own frame.
 */
export function changelogPlate(info: UpdateInfo, width = 52): string {
  const clip = (text: string) =>
    (text.length > width ? `${text.slice(0, width - 1)}…` : text).padEnd(width);
  const row = (text: string) => `│${clip(text)}│`;
  const rule = "─".repeat(width);
  const lines = [
    `┌${rule}┐`,
    row(`post ${info.version}  ·  ${info.commit || "main"}`),
    row(info.from ? `this copy is ${info.from}` : "this copy is older than main"),
    `├${rule}┤`,
  ];

  if (info.entries.length === 0) {
    lines.push(row("no changelog came back"));
  } else {
    for (const entry of info.entries) {
      lines.push(row(`${entry.sha.slice(0, 7)}  ${entry.title}`));
    }
  }

  lines.push(`└${rule}┘`);
  return lines.join("\n");
}
