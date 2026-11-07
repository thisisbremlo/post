import { useEffect, useState } from "react";

import { displayAddress, internalPageOf, isWebUrl } from "../lib/url";
import { bridge } from "../lib/bridge";
import type { Tab } from "../state/types";
import { Icon } from "./Icon";
import { PageByUrl } from "../pages";

/** The 2px line that runs while a page is loading, and only then. */
function LoadLine({ active }: { active: boolean }) {
  if (!active) return null;
  return <span className="loadline" aria-hidden="true" />;
}

export function PageView({ tab }: { tab: Tab }) {
  const internal = internalPageOf(tab.url);
  const constrained = tab.width !== "fit";

  return (
    <div
      className={"sheet" + (constrained ? " is-narrow" : "")}
      data-sheet="active"
      style={constrained ? { maxWidth: `${tab.width}px` } : undefined}
    >
      {/* No engine in the harness means nothing is in flight to draw. */}
      <LoadLine active={tab.loading && !internal && bridge !== null} />
      {internal ? (
        <PageByUrl url={tab.url} title={tab.title} />
      ) : (
        <WebSurface url={tab.url} title={tab.title} reloadKey={tab.reloadKey} />
      )}
    </div>
  );
}

/**
 * In the desktop app the page is a native WebContentsView positioned over this
 * box by the main process, so the renderer draws only its paper underneath.
 * In the web harness there is no engine, so the box carries the held sheet.
 */
export function WebSurface({
  url,
  title,
  reloadKey = 0,
  compact = false,
}: {
  url: string;
  title: string;
  reloadKey?: number;
  compact?: boolean;
}) {
  const [framed, setFramed] = useState(false);

  useEffect(() => {
    setFramed(false);
  }, [url]);

  if (bridge) return <div className="native-surface" aria-label={`${title} is loading in its own process`} />;

  if (framed && isWebUrl(url)) {
    return (
      <iframe
        key={`${url}#${reloadKey}`}
        className="web-frame"
        src={url}
        title={title}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div className={"held" + (compact ? " is-compact" : "")}>
      <div className="held-inner">
        <div className="held-body">
          <h2 className="held-title">{title}</h2>
          {displayAddress(url) !== title && (
            <p className="held-url tnum">{displayAddress(url)}</p>
          )}
          <p className="held-note">
            The desktop app loads this page in its own process. The web harness can only show pages
            that agree to be framed, so this is the sheet where the page would be.
          </p>
          <div className="held-actions">
            <button type="button" className="text-action" onClick={() => setFramed(true)}>
              load live frame
            </button>
            <a className="text-action" href={url} target="_blank" rel="noreferrer noopener">
              open in a window
              <Icon name="arrow-up-right" size={13} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
