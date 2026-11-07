import { useEffect, useState } from "react";

import { bridge, isNative } from "../lib/bridge";
import { relativeTime } from "../lib/time";
import { useStore } from "../state/store";
import { Icon } from "../components/Icon";

export function PasswordsPage() {
  const { state, dispatch } = useStore();
  const [protectedByKeyring, setProtectedByKeyring] = useState<boolean | null>(null);

  useEffect(() => {
    if (!bridge) return;
    bridge
      .vaultProtected()
      .then(setProtectedByKeyring)
      .catch(() => setProtectedByKeyring(false));
  }, []);

  const remove = (id: string) => {
    dispatch({ type: "remove-credential", id });
    void bridge?.vault.remove(id);
  };

  return (
    <div className="page">
      <div className="page-inner">
        <header className="page-head">
          <div>
            <h1 className="page-title">passwords</h1>
            <p className="page-meta tnum">
              {state.credentials.length} saved · this machine only
            </p>
          </div>
        </header>

        <p className="lede">
          The vault is one encrypted file in your profile. The chrome only ever sees the origin and
          the username: the password travels from the page, through the isolated preload, into the
          vault, and back the same way. It never enters this UI, and it is never stored in a page.
        </p>

        {!isNative && (
          <p className="aside-note">
            This is the web preview, so the vault is not wired up here. Capture and fill run in the
            desktop app, where the preload scripts can reach the form. What you see below is the
            surface those calls fill.
          </p>
        )}

        {state.credentials.length === 0 ? (
          <p className="empty">
            No logins saved. Submit a sign-in form in the desktop app and it lands here, with the
            password already sealed.
          </p>
        ) : (
          <ul className="rows">
            {state.credentials.map((credential) => (
              <li key={credential.id}>
                <div className="row row--credential">
                  <span className="row-title tnum">{credential.origin}</span>
                  <span className="row-url">{credential.username}</span>
                  <span className="row-time tnum">
                    {credential.lastUsed ? relativeTime(credential.lastUsed) : "not used yet"}
                  </span>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`remove ${credential.origin}`}
                    title="remove"
                    onClick={() => remove(credential.id)}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="fineprint">
          {protectedByKeyring === false
            ? "This machine has no keyring, so the vault is sealed with a fallback key. It is still encrypted, but not against someone who already has your account. A master password is the next step here."
            : "Sealed with the OS keystore — Keychain on macOS, DPAPI on Windows, libsecret or KWallet on Linux. No sync, no server, no account. An encrypted export is the only way it leaves."}
        </p>

        <p className="fineprint">
          Explicitly not here: card autofill, one-time codes, breach lookups, shared vaults. A
          designer's staging logins are the job, not a family password manager.
        </p>
      </div>
    </div>
  );
}
