import { useStore } from "../state/store";
import { Icon } from "./Icon";

/** The flat part of Chrome's bar: root bookmarks first, then folders. */
export function BookmarksBar({
  onOpenFolder,
}: {
  onOpenFolder: (folder: string, anchor: DOMRect) => void;
}) {
  const { state, dispatch } = useStore();
  if (!state.settings.bookmarksBar) return null;

  const root = state.bookmarks.filter((bookmark) => !bookmark.folder);
  const folders = [
    ...new Set(
      state.bookmarks
        .map((bookmark) => bookmark.folder)
        .filter((name): name is string => Boolean(name)),
    ),
  ];
  const empty = root.length === 0 && folders.length === 0;

  return (
    <nav className="bookmarks-bar" aria-label="Bookmarks">
      <span className="bookmarks-bar-title">
        <Icon name="bookmark" size={11} />
        <span>Bookmarks</span>
      </span>
      <span className="bookmarks-bar-rule" aria-hidden="true" />
      {root.map((bookmark) => (
        <button
          key={bookmark.id}
          type="button"
          className="bookmark-chip"
          data-bookmark-id={bookmark.id}
          title={bookmark.title}
          onClick={() => dispatch({ type: "navigate", url: bookmark.url })}
        >
          <Icon name="bookmark" size={11} />
          <span>{bookmark.title}</span>
        </button>
      ))}
      {folders.map((folder) => (
        <button
          key={folder}
          type="button"
          className="bookmark-chip is-folder"
          title={`Open ${folder} Bookmarks`}
          aria-haspopup="menu"
          onClick={(event) =>
            onOpenFolder(folder, event.currentTarget.getBoundingClientRect())
          }
        >
          <Icon name="library" size={11} />
          <span>{folder}</span>
        </button>
      ))}
      {empty && (
        <span className="bookmarks-empty">Use Keep in the address bar to save a page.</span>
      )}
      <button
        type="button"
        className="bookmarks-all"
        aria-label="All Bookmarks"
        title="All Bookmarks"
        onClick={() => dispatch({ type: "navigate", url: "scaffold://bookmarks" })}
      >
        <Icon name="library" size={12} />
        <span>All Bookmarks</span>
      </button>
    </nav>
  );
}
