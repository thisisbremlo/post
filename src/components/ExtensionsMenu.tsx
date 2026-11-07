import { useEffect, useRef, useState } from "react";

import { bridge, type ExtensionInfo } from "../lib/bridge";
import { Icon } from "./Icon";

/**
 * Chrome's puzzle, but ours: one list, a plain add, and each installed extension
 * opens its own popup in a tab. Native page views paint above the chrome, so the
 * shell lifts them while this is open.
 */
export function ExtensionsMenu({
  x,
  y,
  onClose,
  onChange,
  onOpen,
}: {
  x: number;
  y: number;
  onClose: () => void;
  onChange: (list: ExtensionInfo[]) => void;
  onOpen: (url: string) => void;
}) {
  const [items, setItems] = useState<ExtensionInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [storeUrl, setStoreUrl] = useState("");
  const shell = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bridge) return;
    let live = true;
    bridge
      .listExtensions()
      .then((list) => {
        if (!live) return;
        setItems(list);
        onChange(list);
      })
      .catch(() => {
        if (live) setError("extensions could not be read");
      });
    return () => {
      live = false;
    };
  }, [onChange]);

  // Chrome closes its list when you click away; so does this one.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && !shell.current?.contains(target)) onClose();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [onClose]);

  const add = async () => {
    if (!bridge || busy) return;
    setBusy(true);
    setError(null);
    try {
      const list = await bridge.addExtension();
      setItems(list);
      onChange(list);
      window.dispatchEvent(new CustomEvent("scaffold:extensions-changed"));
    } catch {
      setError("that folder is not an unpacked extension");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!bridge) return;
    setBusy(true);
    setError(null);
    try {
      const list = await bridge.removeExtension(id);
      setItems(list);
      onChange(list);
      window.dispatchEvent(new CustomEvent("scaffold:extensions-changed"));
    } catch {
      setError("that extension could not be removed");
    } finally {
      setBusy(false);
    }
  };

  const installFromStore = async () => {
    if (!bridge || busy || !storeUrl.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const list = await bridge.installFromStore(storeUrl.trim());
      setItems(list);
      onChange(list);
      setStoreUrl("");
      window.dispatchEvent(new CustomEvent("scaffold:extensions-changed"));
    } catch {
      setError("that extension could not run — it may need Chrome-only APIs");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      ref={shell}
      className="extensions-popover"
      style={{ left: x, top: y }}
      role="dialog"
      aria-label="extensions"
    >
      <p className="extensions-head">extensions</p>

      {items.length > 0 ? (
        <ul className="extensions-list">
          {items.map((item) => (
            <li key={item.id} className="extensions-row">
              <button
                type="button"
                className="extensions-item"
                title={item.popup ? `open ${item.name}` : `${item.name} has no popup`}
                disabled={!item.popup || busy}
                onClick={() => item.popup && onOpen(item.popup)}
              >
                <span className="extensions-mark" aria-hidden="true">
                  <Icon name="puzzle" size={15} />
                </span>
                <span className="extensions-copy">
                  <span className="extensions-name">{item.name}</span>
                  <span className="extensions-note tnum">
                    v{item.version}
                    {item.popup ? "" : " · no popup"}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="extensions-remove"
                aria-label={`remove ${item.name}`}
                title={`remove ${item.name}`}
                disabled={busy}
                onClick={() => void remove(item.id)}
              >
                <Icon name="trash" size={13} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="extensions-empty">
          Nothing installed yet. Add an unpacked folder, or paste a link from the Chrome Web
          Store.
        </p>
      )}

      {error && <p className="extensions-error">{error}</p>}

      {bridge && (
        <form
          className="extensions-store"
          onSubmit={(event) => {
            event.preventDefault();
            void installFromStore();
          }}
        >
          <input
            className="extensions-store-input"
            value={storeUrl}
            placeholder="Chrome Web Store link"
            aria-label="Chrome Web Store link"
            spellCheck={false}
            disabled={busy}
            onChange={(event) => setStoreUrl(event.target.value)}
          />
          <button
            type="submit"
            className="extensions-store-go"
            disabled={busy || !storeUrl.trim()}
          >
            get
          </button>
        </form>
      )}

      {bridge ? (
        <button type="button" className="extensions-add" disabled={busy} onClick={() => void add()}>
          <Icon name="plus" size={13} />
          {busy ? "working…" : "add an extension…"}
        </button>
      ) : (
        <p className="extensions-foot">Extensions run in the desktop app.</p>
      )}

      <p className="extensions-foot">
        Store installs use Chrome's CRX format. Extensions that need Chrome-only APIs may not
        run; camera, microphone and location stay refused.
      </p>

      <button type="button" className="extensions-close" onClick={onClose} aria-label="close">
        <Icon name="close" size={13} />
      </button>
    </div>
  );
}
