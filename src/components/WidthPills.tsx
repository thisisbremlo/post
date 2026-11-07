import type { WidthRule } from "../state/types";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";

const RULES: { rule: WidthRule; icon: IconName; label: string; hint: string }[] = [
  { rule: 360, icon: "smartphone", label: "phone", hint: "360 px wide" },
  { rule: 768, icon: "tablet", label: "tablet", hint: "768 px wide" },
  { rule: "fit", icon: "monitor", label: "fit", hint: "as wide as the window" },
];

/** The width rule: a real viewport width for the page, not a zoom. */
export function WidthPills({
  value,
  onChange,
  label,
}: {
  value: WidthRule;
  onChange: (rule: WidthRule) => void;
  label: string;
}) {
  return (
    <div className="widths" role="group" aria-label={label}>
      {RULES.map((item) => (
        <button
          key={item.label}
          type="button"
          className={"width-pill" + (value === item.rule ? " is-current" : "")}
          aria-pressed={value === item.rule}
          aria-label={`${item.label} — ${item.hint}`}
          title={`${item.label} — ${item.hint}`}
          onClick={() => onChange(item.rule)}
        >
          <Icon name={item.icon} size={14} />
        </button>
      ))}
    </div>
  );
}
