import { useState } from "react";

import { shortDate } from "../lib/time";
import { useStore } from "../state/store";
import { Icon } from "../components/Icon";

export function SittingsPage() {
  const { state, dispatch } = useStore();
  const [name, setName] = useState("");

  const setAside = () => {
    dispatch({ type: "save-sitting", name });
    setName("");
  };

  return (
    <div className="page">
      <div className="page-inner">
        <header className="page-head">
          <div>
            <h1 className="page-title">sittings</h1>
            <p className="page-meta tnum">
              {state.sittings.length} {state.sittings.length === 1 ? "desk" : "desks"} set aside
            </p>
          </div>
        </header>

        <form
          className="sitting-form"
          onSubmit={(event) => {
            event.preventDefault();
            setAside();
          }}
        >
          <input
            className="text-input"
            value={name}
            placeholder="name this desk"
            aria-label="name this desk"
            onChange={(event) => setName(event.target.value)}
          />
          <button type="submit" className="primary">
            set aside
          </button>
        </form>
        <p className="form-note">
          Takes the {state.tabs.length} {state.tabs.length === 1 ? "tab" : "tabs"} open now, in order,
          and closes the desk. Not a tab group: a sitting is a context you can come back into.
        </p>

        {state.sittings.length === 0 ? (
          <p className="empty">No sitting yet. The shape of this desk is one keystroke away.</p>
        ) : (
          <ul className="sitting-list">
            {state.sittings.map((sitting) => (
              <li className="sitting-row" key={sitting.id}>
                <div className="sitting-id">
                  <h2 className="sitting-name">{sitting.name}</h2>
                  <p className="sitting-meta tnum">
                    {sitting.tabs.length} {sitting.tabs.length === 1 ? "tab" : "tabs"} ·{" "}
                    {shortDate(sitting.createdAt)}
                  </p>
                </div>
                <div className="sitting-order tnum">
                  {sitting.tabs.slice(0, 4).map((tab, index) => (
                    <span key={tab.url + index}>
                      {index + 1} {tab.title}
                    </span>
                  ))}
                  {sitting.tabs.length > 4 && <span>+{sitting.tabs.length - 4} more</span>}
                </div>
                <div className="sitting-actions">
                  <button
                    type="button"
                    className="text-action"
                    onClick={() => dispatch({ type: "restore-sitting", id: sitting.id })}
                  >
                    restore
                  </button>
                  <button
                    type="button"
                    className="text-action"
                    title="replace this desk with the tabs open now"
                    onClick={() => dispatch({ type: "update-sitting", id: sitting.id })}
                  >
                    update
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`delete ${sitting.name}`}
                    title="delete this sitting"
                    onClick={() => dispatch({ type: "delete-sitting", id: sitting.id })}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
