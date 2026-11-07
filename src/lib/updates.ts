/**
 * Updates the way a browser does it: never a store, never a server of ours.
 * main is the release channel. A build knows its version and the commit it came
 * from, so when the tip of main moves past either, there is something to pull.
 */
const REPO = "thisisbremlo/post";
const API = `https://api.github.com/repos/${REPO}`;

export const APP_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0";
const APP_COMMIT = typeof __APP_COMMIT__ === "string" ? __APP_COMMIT__ : "";

export interface UpdateInfo {
  version: string;
  /** Short sha of the tip of main. */
  commit: string;
  /** First line of that commit's message, so the chip has a reason. */
  notes: string;
  url: string;
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
  try {
    const head = await fetch(`${API}/commits/main`, {
      headers: { accept: "application/vnd.github+json" },
      cache: "no-store",
      signal: signal ?? AbortSignal.timeout(8000),
    });
    if (!head.ok) return null;
    const tip = (await head.json()) as {
      sha?: string;
      commit?: { message?: string };
    };
    const sha = tip.sha ?? "";
    if (!sha || sha === APP_COMMIT) return null;

    // A version from a machine without git still gets an answer.
    const manifest = await fetch(`https://raw.githubusercontent.com/${REPO}/main/package.json`, {
      cache: "no-store",
      signal: signal ?? AbortSignal.timeout(8000),
    });
    const version = manifest.ok
      ? ((((await manifest.json()) as { version?: string }).version ?? APP_VERSION) as string)
      : APP_VERSION;

    if (!APP_COMMIT && !newer(version, APP_VERSION)) return null;

    return {
      version,
      commit: sha.slice(0, 7),
      notes: (tip.commit?.message ?? "").split("\n")[0] ?? "",
      url: `https://github.com/${REPO}/compare/${APP_COMMIT || `v${APP_VERSION}`}...${sha}`,
    };
  } catch {
    return null;
  }
}
