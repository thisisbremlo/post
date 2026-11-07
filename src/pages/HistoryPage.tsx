import { relativeTime } from "../lib/time";
import { displayAddress } from "../lib/url";
import { useStore } from "../state/store";

export function HistoryPage() {
  const { state, dispatch } = useStore();

  return (
    <div className="page">
      <div className="page-inner">
        <header className="page-head">
          <div>
            <h1 className="page-title">history</h1>
            <p className="page-meta tnum">{state.history.length} pages, on this machine only</p>
          </div>
          {state.history.length > 0 && (
            <div className="page-actions">
              <button
                type="button"
                className="text-action"
                onClick={() => {
                  dispatch({ type: "clear-history" });
                  dispatch({ type: "notice", text: "history cleared" });
                }}
              >
                clear
              </button>
            </div>
          )}
        </header>

        {state.history.length === 0 ? (
          <p className="empty">Nothing visited yet. History stays on this machine when you do.</p>
        ) : (
          <ul className="rows">
            {state.history.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className="row"
                  onClick={() => dispatch({ type: "navigate", url: entry.url })}
                >
                  <span className="row-title">{entry.title}</span>
                  <span className="row-url tnum">{displayAddress(entry.url)}</span>
                  <span className="row-time tnum">{relativeTime(entry.visitedAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
