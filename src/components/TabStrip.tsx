import { useState } from "react";
import type { DragEvent as ReactDragEvent, ReactNode } from "react";

import { isNative } from "../lib/bridge";
import { internalPageOf, newTabUrl } from "../lib/url";
import { useStore } from "../state/store";
import type { Tab, TabGroup } from "../state/types";
import { Icon } from "./Icon";
import { Mark } from "./Mark";
import type { IconName } from "./Icon";

const PAGE_ICONS: Record<string, IconName> = {
  start: "home",
  shelf: "sheets",
  history: "clock",
  sittings: "tab",
  turbo: "zap",
  settings: "settings",
  updates: "export",
  bookmarks: "star",
};

function iconFor(url: string): IconName {
  const page = internalPageOf(url);
  return (page && PAGE_ICONS[page]) || "globe";
}

/**
 * The engine hands up the page's own icon; the web harness has no engine, so it
 * asks the site for the one it publishes at its root. Either way, a site with
 * no icon of its own keeps the drawn globe.
 */
function iconSource(tab: Tab): string | null {
  if (internalPageOf(tab.url)) return null;
  if (tab.favicon) return tab.favicon;
  if (isNative) return null;
  try {
    return `${new URL(tab.url).origin}/favicon.ico`;
  } catch {
    return null;
  }
}

function TabMark({ tab }: { tab: Tab }) {
  const [broken, setBroken] = useState<string | null>(null);
  const source = iconSource(tab);

  if (source && broken !== source) {
    return (
      <span className="tab-mark" aria-hidden="true">
        <img
          className="tab-favicon"
          src={source}
          alt=""
          draggable={false}
          onError={() => setBroken(source)}
        />
      </span>
    );
  }

  return (
    <span className="tab-mark" aria-hidden="true">
      <Icon name={iconFor(tab.url)} size={12} />
    </span>
  );
}

/**
 * The group chip inside its container. Click collapses it, double-click names it,
 * the small mark beside it lets the tabs out again.
 */
function GroupLabel({ group, count }: { group: TabGroup; count: number }) {
  const { dispatch } = useStore();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(group.name);

  const commit = () => {
    dispatch({ type: "rename-group", groupId: group.id, name: value });
    setEditing(false);
  };

  if (editing) {
    return (
      <span className="tab-group-label">
        <input
          className="tab-group-input"
          autoFocus
          value={value}
          aria-label="group name"
          spellCheck={false}
          onChange={(event) => setValue(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setValue(group.name);
              setEditing(false);
            }
          }}
        />
      </span>
    );
  }

  return (
    <span className="tab-group-label">
      <button
        type="button"
        className="tab-group-name"
        aria-expanded={!group.collapsed}
        title={group.collapsed ? "open the group" : "fold the group away — double-click to rename"}
        onClick={() => dispatch({ type: "toggle-group", groupId: group.id })}
        onDoubleClick={() => {
          setValue(group.name);
          setEditing(true);
        }}
      >
        <span className="tab-group-mark" aria-hidden="true" />
        <span className="tab-group-text">{group.name}</span>
        {group.collapsed && <span className="tab-group-count tnum">{count}</span>}
      </button>
      <button
        type="button"
        className="tab-group-ungroup"
        aria-label={`ungroup ${group.name}`}
        title="ungroup — the tabs stay open"
        onClick={() => dispatch({ type: "ungroup", groupId: group.id })}
      >
        <Icon name="ungroup" size={12} />
      </button>
    </span>
  );
}

export function TabStrip() {
  const { state, dispatch } = useStore();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const dropOn = (event: ReactDragEvent, targetId: string) => {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain") || dragging;
    if (id && id !== targetId) dispatch({ type: "group-tab", tabId: id, targetId });
    setDragging(null);
    setOver(null);
  };

  const tabNode = (tab: Tab, index: number) => {
    const active = tab.id === state.activeId;
    return (
      <div
        key={tab.id}
        role="tab"
        aria-selected={active}
        aria-label={`${tab.title}, tab ${index + 1}`}
        tabIndex={active ? 0 : -1}
        data-tab-id={tab.id}
        draggable
        className={
          "tab" +
          (active ? " is-active" : "") +
          (dragging === tab.id ? " is-dragging" : "") +
          (over === tab.id ? " is-drop-target" : "")
        }
        title="drag onto another tab to group them"
        onClick={() => dispatch({ type: "activate-tab", id: tab.id })}
        onAuxClick={(event) => {
          if (event.button === 1) dispatch({ type: "close-tab", id: tab.id });
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            dispatch({ type: "activate-tab", id: tab.id });
          }
        }}
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", tab.id);
          event.dataTransfer.effectAllowed = "move";
          setDragging(tab.id);
        }}
        onDragEnd={() => {
          setDragging(null);
          setOver(null);
        }}
        onDragOver={(event) => {
          if (!dragging || dragging === tab.id) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setOver(tab.id);
        }}
        onDragLeave={() => setOver((id) => (id === tab.id ? null : id))}
        onDrop={(event) => dropOn(event, tab.id)}
      >
        <TabMark tab={tab} />
        <span className="tab-title">{tab.title}</span>
        <button
          type="button"
          className="tab-close"
          aria-label={`close ${tab.title}`}
          onClick={(event) => {
            event.stopPropagation();
            dispatch({ type: "close-tab", id: tab.id });
          }}
        >
          <Icon name="close" size={11} />
        </button>
      </div>
    );
  };

  // The start sheet is not a tab: it lives on the home button in the toolbar,
  // which shares its section with back, forward and reload.
  const visible = state.tabs.filter((tab) => internalPageOf(tab.url) !== "start");

  // Each group is drawn once, as one container holding all its tabs.
  const items: ReactNode[] = [];
  const drawn = new Set<string>();
  visible.forEach((tab, position) => {
    if (!tab.groupId) {
      items.push(tabNode(tab, position));
      return;
    }
    const group = state.groups.find((item) => item.id === tab.groupId);
    if (!group || drawn.has(group.id)) return;
    drawn.add(group.id);
    const members = visible
      .map((item, at) => ({ tab: item, position: at }))
      .filter((entry) => entry.tab.groupId === group.id);
    items.push(
      <div
        key={group.id}
        className={"tab-group" + (group.collapsed ? " is-collapsed" : "")}
        data-color={group.color}
        role="group"
        aria-label={`${group.name} group`}
        onDragOver={(event) => {
          if (!dragging) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDrop={(event) => dropOn(event, members[0].tab.id)}
      >
        <GroupLabel group={group} count={members.length} />
        {!group.collapsed && members.map((entry) => tabNode(entry.tab, entry.position))}
      </div>,
    );
  });

  return (
    <div className="tabstrip">
      <div className="tabstrip-tabs" role="tablist" aria-label="Tabs">
        {items}
      </div>
      <button
        type="button"
        className="tab-new"
        aria-label="new tab"
        title="new tab (⌘T)"
        onClick={() => dispatch({ type: "open-tab", url: newTabUrl(state.settings.newTab) })}
      >
        <Icon name="plus" size={15} />
      </button>
      {visible.length === 0 && <span className="tabstrip-empty">no pages open</span>}
      <span className="tabstrip-gap" aria-hidden="true" />
      <span className="wordmark">
        <Mark size={12} />
        Post
      </span>
    </div>
  );
}
