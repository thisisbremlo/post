import { useState } from "react";

import { Icon } from "../components/Icon";
import { shortDate } from "../lib/time";
import { useStore } from "../state/store";

export function SittingsPage() {
  const { state, dispatch } = useStore();
  const [name, setName] = useState("");

  const savedTabs = state.sittings.reduce((total, sitting) => total + sitting.tabs.length, 0);

  const setAside = () => {
    dispatch({ type: "save-sitting", name });
    setName("");
  };

  return (
    <div className="page settings-page">
      <div className="settings-shell">
        <header className="settings-header">
          <div className="settings-heading">
            <p className="settings-kicker">Saved Desks</p>
            <h1 className="settings-title">Sittings</h1>
            <p className="settings-intro">
              Set the tabs you have open aside as one desk, then return to them in the same order.
              A sitting is a context, not a tab group.
            </p>
          </div>
          <aside className="settings-local">
            <span className="settings-local-icon">
              <Icon name="sheets" size={14} />
            </span>
            <div>
              <strong>
                {state.sittings.length} {state.sittings.length === 1 ? "Sitting" : "Sittings"}
              </strong>
              <span>
                {state.sittings.length === 0
                  ? "No desks set aside yet."
                  : `${savedTabs} ${savedTabs === 1 ? "tab" : "tabs"} saved in order.`}
              </span>
            </div>
          </aside>
        </header>

        <div className="settings-content sittings-content">
          <section className="settings-group">
            <header className="settings-group-head">
              <span className="settings-group-index tnum">01</span>
              <div>
                <h2>Set Aside This Desk</h2>
                <p>
                  Takes the {state.tabs.length} {state.tabs.length === 1 ? "tab" : "tabs"} open
                  now, in order, and starts a clean desk.
                </p>
              </div>
            </header>
            <div className="settings-list">
              <form
                className="sitting-save-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  setAside();
                }}
              >
                <label className="sitting-field">
                  <span className="sitting-label">Sitting Name</span>
                  <input
                    className="setting-input"
                    value={name}
                    placeholder="Name this desk"
                    autoComplete="off"
                    onChange={(event) => setName(event.target.value)}
                  />
                  <span className="sitting-hint">
                    Leave it blank to name this desk by today’s date.
                  </span>
                </label>
                <button type="submit" className="setting-action">
                  Set Aside
                </button>
              </form>
            </div>
          </section>

          <section className="settings-group">
            <header className="settings-group-head">
              <span className="settings-group-index tnum">02</span>
              <div>
                <h2>Saved Sittings</h2>
                <p>Restore a desk where it left off, or refresh it with the tabs open now.</p>
              </div>
            </header>
            <div className="settings-list">
              {state.sittings.length === 0 ? (
                <div className="library-state is-inset">
                  <span className="library-state-icon">
                    <Icon name="sheets" size={22} />
                  </span>
                  <h3>No Sittings Yet</h3>
                  <p>
                    Open a few pages, then set the desk aside. Every tab is saved in its place.
                  </p>
                </div>
              ) : (
                state.sittings.map((sitting) => (
                  <article className="sitting-entry" key={sitting.id}>
                    <div className="sitting-entry-head">
                      <div className="sitting-entry-copy">
                        <h3 className="setting-name">{sitting.name}</h3>
                        <p className="setting-note tnum">
                          {sitting.tabs.length} {sitting.tabs.length === 1 ? "tab" : "tabs"} · Set
                          aside {shortDate(sitting.createdAt)}
                        </p>
                      </div>
                      <div className="sitting-entry-actions">
                        <button
                          type="button"
                          className="setting-action is-secondary"
                          title="Replace this sitting with the tabs open now"
                          onClick={() => dispatch({ type: "update-sitting", id: sitting.id })}
                        >
                          Update
                        </button>
                        <button
                          type="button"
                          className="setting-action"
                          onClick={() => dispatch({ type: "restore-sitting", id: sitting.id })}
                        >
                          Restore
                        </button>
                        <button
                          type="button"
                          className="library-remove"
                          aria-label={`Delete ${sitting.name}`}
                          title="Delete Sitting"
                          onClick={() => dispatch({ type: "delete-sitting", id: sitting.id })}
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="sitting-preview">
                      {sitting.tabs.slice(0, 4).map((tab, index) => (
                        <span className="sitting-preview-tab" key={tab.url + index}>
                          <span className="sitting-preview-index tnum">{index + 1}</span>
                          <span className="sitting-preview-title">{tab.title}</span>
                        </span>
                      ))}
                      {sitting.tabs.length > 4 && (
                        <span className="sitting-preview-tab is-more">
                          +{sitting.tabs.length - 4} More
                        </span>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <p className="settings-fineprint">
            Restoring a sitting replaces the desk open now. Sittings stay on this device.
          </p>
        </div>
      </div>
    </div>
  );
}
