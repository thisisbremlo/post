import type { KeptPage } from "../state/types";
import { shortDate } from "./time";

function escapeMarkdown(value: string): string {
  return value.replace(/([[\]])/g, "\\$1");
}

/**
 * The shelf leaves as a file you own: one block per page, note kept as prose,
 * no front matter that only this app understands.
 */
export function shelfToMarkdown(pages: KeptPage[]): string {
  const sorted = [...pages].sort((a, b) => b.keptAt - a.keptAt);
  const lines: string[] = [
    "# Post shelf",
    "",
    `${sorted.length} ${sorted.length === 1 ? "page" : "pages"} kept, exported ${shortDate(Date.now())}`,
    "",
  ];

  for (const page of sorted) {
    lines.push(`## ${escapeMarkdown(page.title)}`);
    lines.push("");
    lines.push(`<${page.url}>`);
    lines.push("");
    if (page.note.trim()) {
      lines.push(page.note.trim());
      lines.push("");
    }
    lines.push(`_kept ${shortDate(page.keptAt)}_`);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  if (sorted.length === 0)
    lines.push("Nothing kept yet. Press ⌘⇧D on a page worth remembering.");
  return lines.join("\n");
}

export function downloadMarkdown(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
