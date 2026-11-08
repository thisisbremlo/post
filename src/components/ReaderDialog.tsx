import type { Article } from "../lib/bridge";
import { displayAddress } from "../lib/url";
import { Icon } from "./Icon";

/** A quiet sheet for the words of a page, without its navigation or noise. */
export function ReaderDialog({ article, onClose }: { article: Article; onClose: () => void }) {
  const paragraphs = article.text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <article className="reader" role="dialog" aria-modal="true" aria-label="reader">
        <header className="reader-head">
          <div className="reader-heading">
            <span className="reader-kicker tnum">reader</span>
            <h1 className="reader-title">{article.title || "untitled"}</h1>
            <p className="reader-source tnum">{displayAddress(article.url)}</p>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="close reader"
            title="close reader (esc)"
            onClick={onClose}
          >
            <Icon name="close" size={15} />
          </button>
        </header>
        <div className="reader-body">
          {paragraphs.length === 0 ? (
            <p className="empty">This page has no readable article behind it.</p>
          ) : (
            paragraphs.map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>)
          )}
        </div>
      </article>
    </div>
  );
}
