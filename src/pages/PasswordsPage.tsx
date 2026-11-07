import { useState } from "react";

import { bridge } from "../lib/bridge";
import { Icon } from "../components/Icon";
import { useStore } from "../state/store";

export function PasswordsPage() {
  const { dispatch } = useStore();
  const [busy, setBusy] = useState(false);

  const open = async () => {
    if (busy) return;
    if (!bridge) {
      window.open("https://passwords.google.com", "_blank", "noreferrer");
      return;
    }
    setBusy(true);
    try {
      const where = await bridge.openPasswordManager();
      dispatch({
        type: "notice",
        text:
          where === "chrome"
            ? "Google Password Manager is open in Chrome"
            : "opened passwords.google.com",
      });
    } catch {
      dispatch({ type: "notice", text: "couldn't open Google Password Manager" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="page-inner">
        <header className="page-head">
          <div>
            <h1 className="page-title">passwords</h1>
            <p className="page-meta">Google Password Manager · nothing stored here</p>
          </div>
        </header>

        <p className="lede">
          Post keeps no passwords. The logins you have are the ones Google Password Manager
          already holds, and this page opens them: Chrome's own manager on this machine, or
          passwords.google.com when Chrome is not installed.
        </p>

        <div className="page-actions">
          <button type="button" className="page-action" onClick={open} disabled={busy}>
            <Icon name="key" size={14} />
            {bridge ? "open Google Password Manager" : "open passwords.google.com"}
          </button>
        </div>

        <p className="fineprint">
          Chromium's password manager is a Chrome component, not part of the engine Post
          embeds, so Post cannot draw that page or fill from it. A second vault would only
          mean a second place to look, so there is none: nothing to sync, nothing to leak,
          no account.
        </p>

        <p className="fineprint">
          Saved logins follow your Google account, so a password saved once in Chrome is
          there the next time you need it. In the web preview the button simply opens
          passwords.google.com in a tab.
        </p>
      </div>
    </div>
  );
}
