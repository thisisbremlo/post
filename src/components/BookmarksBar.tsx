import { useStore } from "../state/store";
import { Icon } from "./Icon";

/** The flat part of Chrome's bar: root bookmarks first, then folders. */
export function BookmarksBar() {
  const { state, dispatch } = useStore();
  if (!state.settings.bookmarksBar || state.bookmarks.length === 0) return null;

  const root = state.bookmarks.filter((bookmark) => !bookmark.folder);
  const folders = [
    ...new Set(
      state.bookmarks
        .map((bookmark) => bookmark.folder)
        .filter((name): name is string => Boolean(name)),
    ),
  ];

  return (
    <nav className="bookmarks-bar" aria-label="bookmarks">
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
          title={`${folder} — all bookmarks`}
          onClick={() => dispatch({ type: "navigate", url: "scaffold://bookmarks" })}
        >
          <Icon name="library" size={11} />
          <span>{folder}</span>
        </button>
      ))}
      <button
        type="button"
        className="bookmarks-all"
        aria-label="all bookmarks"
        title="all bookmarks"
        onClick={() => dispatch({ type: "navigate", url: "scaffold://bookmarks" })}
      >
        <Icon name="more" size={14} />
      </button>
    </nav>
  );
}
