import type { RefObject } from "react";

import { bridge } from "../lib/bridge";
import { parseDomain } from "../lib/url";
import { useStore } from "../state/store";
import type { Reference } from "../state/types";
import { Icon } from "./Icon";
import { PageByUrl } from "../pages";
import { WebSurface } from "./PageView";

/**
 * A reference pane that belongs to the browser, not to a tab. It holds one page
 * while you keep browsing on the right.
 */
export function ReferencePane({
  reference,
  containerRef,
}: {
  reference: Reference;
  containerRef: RefObject<HTMLElement>;
}) {
  const { dispatch } = useStore();
  const internal = reference.url.startsWith("scaffold://");

  const snapshot = async () => {
    if (!bridge) {
      dispatch({ type: "notice", text: "snapshots need the desktop engine" });
      return;
    }
    const article = await bridge.readArticle("reference");
    const excerpt = article?.text.replace(/\s+/g, " ").trim().slice(0, 280) ?? "";
    if (!excerpt) {
      dispatch({ type: "notice", text: "this reference has no readable text to keep" });
      return;
    }
    dispatch({
      type: "keep-clip",
      url: reference.url,
      title: reference.title,
      note: `snapshot · ${excerpt}`,
    });
  };

  return (
    <aside className="reference" ref={containerRef} aria-label="reference pane">
      <header className="reference-head">
        <span className="reference-domain tnum">{parseDomain(reference.url)}</span>
        <button
          type="button"
          className="icon-btn"
          aria-label="keep a snapshot on the shelf"
          title="keep a snapshot on the shelf"
          onClick={() => void snapshot()}
        >
          <Icon name="camera" size={14} />
        </button>
        <button
          type="button"
          className="icon-btn reference-close"
          aria-label="close reference pane"
          title="close the pane"
          onClick={() => dispatch({ type: "unhold" })}
        >
          <Icon name="close" size={15} />
        </button>
      </header>
      <div className="reference-body">
        <div className="sheet sheet--reference" data-sheet="reference">
          {internal ? (
            <PageByUrl url={reference.url} title={reference.title} />
          ) : (
            <WebSurface url={reference.url} title={reference.title} compact />
          )}
        </div>
      </div>
    </aside>
  );
}
