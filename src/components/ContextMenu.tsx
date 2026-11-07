import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { Icon } from "./Icon";
import type { IconName } from "./Icon";

export interface MenuItem {
  id: string;
  label: string;
  icon: IconName;
  hint?: string;
  danger?: boolean;
  separatorBefore?: boolean;
  onSelect: () => void;
}

/**
 * The shelf's right click. Same words as the app: keep, copy, hold, close.
 * Esc and an outside click dismiss it; arrows walk the items.
 */
export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    node?.querySelector<HTMLButtonElement>(".menu-item")?.focus();

    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("mousedown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("mousedown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  /** Arrow keys move the ring; the first item takes focus on open. */
  const walk = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>(".menu-item") ?? [])];
    if (buttons.length === 0) return;
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "ArrowDown" ? (at + 1) % buttons.length : (at - 1 + buttons.length) % buttons.length;
    buttons[next].focus();
  };

  const width = 264;
  const height = items.length * 32 + items.filter((item) => item.separatorBefore).length * 13 + 12;
  const left = Math.max(8, Math.min(x, window.innerWidth - width - 8));
  const top = Math.max(8, Math.min(y, window.innerHeight - height - 8));

  // Portalled to the body: inside the toolbar it would sit under the page.
  return createPortal(
    <div
      ref={ref}
      className="menu"
      role="menu"
      aria-label="page actions"
      style={{ left, top, width }}
      onKeyDown={walk}
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item) => (
        <div key={item.id}>
          {item.separatorBefore && <span className="menu-sep" role="separator" />}
          <button
            type="button"
            role="menuitem"
            className={"menu-item" + (item.danger ? " is-danger" : "")}
            onClick={() => {
              item.onSelect();
              onClose();
            }}
          >
            <Icon name={item.icon} size={14} />
            <span className="menu-label">{item.label}</span>
            {item.hint && <span className="menu-hint tnum">{item.hint}</span>}
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
