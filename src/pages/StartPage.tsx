const KEYS: [string, string][] = [
  ["keep this page", "⌘⇧D"],
  ["catalogue", "⌘K"],
  ["hold as reference", "⌘⇧R"],
  ["address bar", "⌘L"],
  ["new tab", "⌘T"],
  ["close tab", "⌘W"],
];

/** Opens on a blank ruled sheet. No marketing, no sign-in, no import prompt. */
export function StartPage() {
  return (
    <div className="page page--start">
      <span className="ribbon" aria-hidden="true" />
      <div className="start-inner">
        <h1 className="start-title">
          the first page
          <br />
          lands here
        </h1>
        <p className="start-line">
          Press <kbd className="keycap">⌘L</kbd> for an address, then{" "}
          <kbd className="keycap">⌘⇧D</kbd> to keep what you find.
        </p>

        <dl className="keys">
          {KEYS.map(([label, combo]) => (
            <div className="key-row" key={combo + label}>
              <dt>{label}</dt>
              <dd>
                <kbd className="keycap">{combo}</kbd>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
