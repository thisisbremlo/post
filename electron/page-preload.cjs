const { ipcRenderer } = require("electron");

/**
 * Runs in an isolated world inside every page view. It reads the form, not the
 * chrome: the renderer never sees the password, and the page never sees this
 * script's variables.
 */
function capture(form) {
  if (!(form instanceof HTMLFormElement)) return;
  const password = form.querySelector('input[type="password"]');
  if (!password || !password.value) return;

  const username = form.querySelector(
    'input[type="text"], input[type="email"], input[autocomplete="username"], input:not([type])',
  );

  ipcRenderer
    .invoke("scaffold:vault-capture", {
      origin: window.location.origin,
      username: username && username.value ? username.value : "",
      password: password.value,
    })
    .catch(() => undefined);
}

window.addEventListener(
  "submit",
  (event) => {
    const target = event.target;
    if (target instanceof HTMLFormElement) capture(target);
  },
  true,
);

// A one-click key in the toolbar asks the page to fill itself.
ipcRenderer.on("scaffold:fill-login", (_event, credential) => {
  if (!credential) return;
  const password = document.querySelector('input[type="password"]');
  if (!password) return;
  const scope = password.form || document;
  const username = scope.querySelector(
    'input[type="text"], input[type="email"], input[autocomplete="username"], input:not([type])',
  );

  const set = (element, value) => {
    const descriptor = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(element),
      "value",
    );
    descriptor.set.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  };

  if (username) set(username, credential.username || "");
  set(password, credential.password || "");
  password.focus();
});
