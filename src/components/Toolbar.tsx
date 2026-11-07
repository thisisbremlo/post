import type { UpdateInfo } from "../lib/updates";
import { useActiveTab, useStore } from "../state/store";
import { Icon } from "./Icon";
import { Omnibox } from "./Omnibox";
import { WidthPills } from "./WidthPills";

export function Toolbar({
  onOpenPalette,
  update,
  onOpenUpdate,
}: {
  onOpenPalette: () => void;
  update: UpdateInfo | null;
  onOpenUpdate: () => void;
}) {
  const { state, dispatch } = useStore();
  const tab = useActiveTab();
  const held = state.reference?.url === tab.url;

  return (
    <header className="toolbar">
      <div className="nav">
        <button
          type="button"
          className="icon-btn"
          aria-label="back"
          title="back"
          disabled={tab.pointer === 0}
          onClick={() => dispatch({ type: "back", tabId: tab.id })}
        >
          <Icon name="back" size={16} />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="forward"
          title="forward"
          disabled={tab.pointer >= tab.entries.length - 1}
          onClick={() => dispatch({ type: "forward", tabId: tab.id })}
        >
          <Icon name="forward" size={16} />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="reload"
          title="reload (⌘R)"
          onClick={() => dispatch({ type: "reload", tabId: tab.id })}
        >
          <Icon name="reload" size={16} />
        </button>
        <button
          type="button"
          className={"icon-btn" + (tab.url === "scaffold://start" ? " is-on" : "")}
          aria-label="start"
          title="the start sheet (⌘⇧H)"
          onClick={() => dispatch({ type: "open-tab", url: "scaffold://start" })}
        >
          <Icon name="home" size={16} />
        </button>
      </div>

      <Omnibox tab={tab} />

      <WidthPills
        value={tab.width}
        label="page width"
        onChange={(width) => dispatch({ type: "set-width", tabId: tab.id, width })}
      />

      <span className="toolbar-rule" aria-hidden="true" />

      <button
        type="button"
        className={"icon-btn" + (held ? " is-on" : "")}
        aria-label={held ? "release reference" : "hold as reference"}
        aria-pressed={held}
        title={held ? "release the reference pane (⌘⇧R)" : "hold this page as reference (⌘⇧R)"}
        onClick={() => {
          if (held) dispatch({ type: "unhold" });
          else dispatch({ type: "hold", tabId: tab.id });
        }}
      >
        <Icon name={held ? "unpin" : "pin"} size={16} />
      </button>

      <button
        type="button"
        className="icon-btn"
        aria-label="passwords"
        title="passwords"
        onClick={() => dispatch({ type: "navigate", url: "scaffold://passwords" })}
      >
        <Icon name="key" size={16} />
      </button>

      <button
        type="button"
        className={"shelf-chip" + (state.shelf.length > 0 ? " has-cards" : "")}
        aria-label="shelf"
        title="the shelf — right click for its menu"
        data-shelf-button
        onClick={() => dispatch({ type: "navigate", url: "scaffold://shelf" })}
      >
        <Icon name="library" size={13} />
        <span>shelf</span>
        <span className="tnum shelf-chip-count">{state.shelf.length}</span>
      </button>

      {update && (
        <button
          type="button"
          className="update-chip"
          aria-label="an update is ready"
          title={`main is newer${update.commit ? ` (${update.commit})` : ""} — pull it and relaunch`}
          onClick={onOpenUpdate}
        >
          <Icon name="export" size={13} />
          <span>update</span>
        </button>
      )}

      <button
        type="button"
        className="palette-chip"
        aria-label="catalogue"
        title="catalogue (⌘K)"
        onClick={onOpenPalette}
      >
        <Icon name="search" size={13} />
        <span className="tnum palette-chip-keys">⌘K</span>
      </button>

    </header>
  );
}
