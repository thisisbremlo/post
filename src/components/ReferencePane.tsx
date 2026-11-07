import type { RefObject } from "react";

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

  return (
    <aside className="reference" ref={containerRef} aria-label="reference pane">
      <header className="reference-head">
        <span className="reference-domain tnum">{parseDomain(reference.url)}</span>
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
