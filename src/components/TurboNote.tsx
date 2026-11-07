import { useEffect, useRef, useState } from "react";

import { Icon } from "./Icon";
import { useStore } from "../state/store";

/**
 * Turbo notes: one line, one keystroke, no dialog ceremony. The popover sits
 * under the bolt, saves on Enter, and keeps its own count as the way in to the
 * full page at scaffold://turbo.
 */
export function TurboNote({ x, y, onClose }: { x: number; y: number; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const [text, setText] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    const onDown = (event: MouseEvent) => {
      if (!panel.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  const save = () => {
    const value = text.trim();
    if (!value) {
      onClose();
      return;
    }
    dispatch({ type: "note-add", text: value });
    setText("");
    onClose();
  };

  return (
    <div className="turbo" role="dialog" aria-label="turbo note" style={{ left: x, top: y }} ref={panel}>
      <div className="turbo-row">
        <span className="turbo-mark" aria-hidden="true">
          <Icon name="zap" size={14} />
        </span>
        <input
          ref={input}
          className="turbo-input"
          value={text}
          spellCheck={false}
          placeholder="a thought, one line"
          aria-label="turbo note"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              save();
            }
          }}
        />
      </div>
      <div className="turbo-foot">
        <span className="turbo-hint tnum">enter saves · esc closes</span>
        <button
          type="button"
          className="turbo-all"
          onClick={() => {
            dispatch({ type: "navigate", url: "scaffold://turbo" });
            onClose();
          }}
        >
          <span className="tnum">{state.notes.length}</span> kept
          <Icon name="arrow-up-right" size={11} />
        </button>
      </div>
    </div>
  );
}
