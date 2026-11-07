import { useState } from "react";

import type { UpdateInfo } from "../lib/updates";
import { useActiveTab, useStore } from "../state/store";
import { ContextMenu } from "./ContextMenu";
import type { MenuItem } from "./ContextMenu";
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
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  // The three dots are the browser's own drawer: places to go, settings to change.
  const tools: MenuItem[] = [
    {
      id: "settings",
      label: "settings",
      icon: "settings",
      hint: "⌘,",
      onSelect: () => dispatch({ type: "navigate", url: "scaffold://settings" }),
    },
    {
      id: "history",
      label: "history",
      icon: "clock",
      separatorBefore: true,
      onSelect: () => dispatch({ type: "navigate", url: "scaffold://history" }),
    },
    {
      id: "sittings",
      label: "sittings",
      icon: "tab",
      onSelect: () => dispatch({ type: "navigate", url: "scaffold://sittings" }),
    },
    {
      id: "shelf",
      label: "shelf",
      icon: "sheets",
      onSelect: () => dispatch({ type: "navigate", url: "scaffold://shelf" }),
    },
    {
      id: "passwords",
      label: "passwords",
      icon: "key",
      onSelect: () => dispatch({ type: "navigate", url: "scaffold://passwords" }),
    },
  ];

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
          title={
            update.commit && update.commit !== update.from
              ? `main is at ${update.commit} — pull it and relaunch`
              : `Post ${update.version} is on main — pull it and relaunch`
          }
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

      <button
        type="button"
        className={"icon-btn" + (menu ? " is-on" : "")}
        aria-label="browser menu"
        aria-haspopup="menu"
        aria-expanded={Boolean(menu)}
        title="the browser menu"
        onClick={(event) => {
          if (menu) {
            setMenu(null);
            return;
          }
          const box = event.currentTarget.getBoundingClientRect();
          setMenu({ x: box.right - 264, y: box.bottom + 6 });
        }}
      >
        <Icon name="more" size={16} />
      </button>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={tools} onClose={() => setMenu(null)} />}

    </header>
  );
}
