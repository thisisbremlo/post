export interface ImportedBookmark {
  url: string;
  title: string;
  folder: string | null;
}

/**
 * Netscape's bookmark file, the format every browser still exports. The nested
 * DL/DT shape carries folders; the fallback catches plain HTML link lists.
 */
export function parseBookmarksHtml(html: string): ImportedBookmark[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const found: ImportedBookmark[] = [];
  const seen = new Set<string>();

  const add = (anchor: HTMLAnchorElement, trail: string[]) => {
    const url = anchor.getAttribute("href")?.trim() ?? "";
    if (!/^https?:/i.test(url) || seen.has(url)) return;
    seen.add(url);
    found.push({
      url,
      title: (anchor.textContent ?? "").trim(),
      folder: trail.length > 0 ? trail.join(" / ") : null,
    });
  };

  const walk = (list: Element, trail: string[]) => {
    for (const node of Array.from(list.children)) {
      if (node.tagName === "DL") {
        walk(node, trail);
        continue;
      }
      if (node.tagName !== "DT") continue;

      const heading = node.querySelector(":scope > h3");
      const anchor = node.querySelector(":scope > a");
      if (anchor) add(anchor as HTMLAnchorElement, trail);

      const nested = node.querySelector(":scope > dl");
      if (nested) {
        const name = heading?.textContent?.trim();
        walk(nested, name ? [...trail, name] : trail);
      }
    }
  };

  const root = doc.querySelector("dl");
  if (root) {
    walk(root, []);
  } else {
    for (const anchor of Array.from(doc.querySelectorAll("a[href]"))) {
      add(anchor as HTMLAnchorElement, []);
    }
  }

  return found;
}
