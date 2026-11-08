import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { bridge, type AdblockCategory, type AdblockState } from "../lib/bridge";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";

const WIDTH = 356;

/** The ring is made of the same counts as the legend, not a picture of them. */
function Donut({ categories }: { categories: AdblockCategory[] }) {
  const total = categories.reduce((sum, category) => sum + category.count, 0);
  let walked = 0;
  const segments = categories.flatMap((category) => {
    if (total === 0 || category.count === 0) return [];
    const share = (category.count / total) * 100;
    const segment = { ...category, share, offset: walked };
    walked += share;
    return [segment];
  });

  return (
    <div
      className="adblock-donut"
      role="img"
      aria-label={`${total} observed ${total === 1 ? "activity" : "activities"}`}
    >
      <svg viewBox="0 0 112 112">
        <circle className="adblock-donut-track" cx="56" cy="56" r="42" pathLength={100} />
        {segments.map((segment) => {
          const dash = Math.max(1, segment.share - 1.6);
          return (
            <circle
              key={segment.key}
              className="adblock-donut-segment"
              cx="56"
              cy="56"
              r="42"
              pathLength={100}
              stroke={segment.color}
              strokeDasharray={`${dash} ${100 - dash}`}
              strokeDashoffset={-segment.offset}
              transform="rotate(-90 56 56)"
            />
          );
        })}
      </svg>
      <span className="adblock-donut-count tnum">{total}</span>
    </div>
  );
}

function SwitchRow({
  icon,
  label,
  checked,
  disabled,
  onChange,
}: {
  icon: IconName;
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      className="adblock-setting-row"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <Icon name={icon} size={16} />
      <span className="adblock-setting-label">{label}</span>
      <span className={"adblock-switch" + (checked ? " is-on" : "")} aria-hidden="true">
        <span className="adblock-switch-knob" />
      </span>
    </button>
  );
}

/**
 * Ghostery's popup, rebuilt for Post's native session: the site in front, the
 * three list groups, what those lists actually stopped, and a way to pause.
 */
export function AdblockPanel({
  adblock,
  anchor,
  onClose,
  onOpenSettings,
}: {
  adblock: AdblockState;
  anchor: { right: number; bottom: number };
  onClose: () => void;
  onOpenSettings: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const width = Math.min(WIDTH, window.innerWidth - 16);
  const left = Math.max(8, Math.min(anchor.right - width, window.innerWidth - width - 8));
  const top = Math.max(8, Math.min(anchor.bottom + 8, window.innerHeight - 220));
  const maxHeight = window.innerHeight - top - 12;

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // The toolbar button is the panel's own switch; let its click decide.
      if (target.closest("[data-adblock-toggle]")) return;
      if (!ref.current?.contains(target)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
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

  const setFeature = (feature: "ads" | "tracking" | "consent", enabled: boolean) => {
    if (bridge) void bridge.setAdblockFeature(feature, enabled);
  };

  const togglePause = () => {
    if (!bridge || !adblock.activeHost) return;
    void bridge.setAdblockSite(adblock.activeHost, !adblock.paused);
  };

  const canPause = Boolean(adblock.activeHost) && adblock.enabled && !adblock.refreshing;
  const pauseLabel = !adblock.activeHost
    ? "No site in front"
    : !adblock.enabled
      ? "Blocking is off"
      : adblock.paused
        ? "Resume on this site"
        : "Pause on this site";

  return createPortal(
    <aside
      ref={ref}
      className="adblock-panel"
      role="dialog"
      aria-label="ad blocking"
      style={{ left, top, width, maxHeight }}
    >
      <header className="adblock-panel-head">
        <span className="adblock-mark">
          <Icon name="ghost" size={24} />
        </span>
        <button
          type="button"
          className="adblock-site"
          title="blocking settings"
          onClick={onOpenSettings}
        >
          <span>{adblock.activeHost || "no site in front"}</span>
          <Icon name="chevron-down" size={14} />
        </button>
        <button type="button" className="adblock-close" aria-label="close" onClick={onClose}>
          <Icon name="close" size={15} />
        </button>
      </header>

      <button
        type="button"
        className={"adblock-pause" + (adblock.paused ? " is-paused" : "")}
        disabled={!canPause}
        onClick={togglePause}
      >
        <Icon name={adblock.paused ? "play" : "pause"} size={17} />
        <span>{pauseLabel}</span>
      </button>

      {adblock.refreshing && <p className="adblock-updating">updating the lists…</p>}

      <section className="adblock-section">
        <div className="adblock-section-head">
          <h2>Observed activities</h2>
          <span
            className="adblock-info"
            title="The blocked requests on this page, grouped by Ghostery's TrackerDB."
          >
            <Icon name="info" size={13} />
          </span>
        </div>
        <div className="adblock-observed">
          <Donut categories={adblock.categories} />
          <div className="adblock-legend">
            {adblock.categories.map((category) => (
              <div className="adblock-legend-row" key={category.key}>
                <span
                  className="adblock-dot"
                  style={{ background: category.color }}
                  aria-hidden="true"
                />
                <span className="adblock-legend-name">{category.label}</span>
                <span className={"adblock-legend-count tnum" + (category.count ? " is-live" : "")}>
                  {category.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="adblock-blocked">
        <div className="adblock-blocked-number">
          <Icon name="ban" size={19} />
          <strong className="tnum">{adblock.siteBlocked}</strong>
        </div>
        <span>Trackers blocked</span>
      </div>

      <section className="adblock-settings">
        <h2>Ghostery settings</h2>
        <div className="adblock-switches">
          <SwitchRow
            icon="megaphone"
            label="Ad-Blocking"
            checked={adblock.ads}
            disabled={adblock.refreshing}
            onChange={(next) => setFeature("ads", next)}
          />
          <SwitchRow
            icon="shield"
            label="Anti-Tracking"
            checked={adblock.tracking}
            disabled={adblock.refreshing}
            onChange={(next) => setFeature("tracking", next)}
          />
          <SwitchRow
            icon="cookie"
            label="Never-Consent"
            checked={adblock.consent}
            disabled={adblock.refreshing}
            onChange={(next) => setFeature("consent", next)}
          />
        </div>
        {adblock.error && (
          <p className="adblock-warning" title={adblock.error}>
            some lists are unavailable — the cached copy is still blocking
          </p>
        )}
      </section>

      <footer className="adblock-panel-foot">
        <span>lists by Ghostery · TrackerDB</span>
        <button type="button" onClick={onOpenSettings}>
          manage lists
        </button>
      </footer>
    </aside>,
    document.body,
  );
}
