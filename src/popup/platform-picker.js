/*
 * Guard tab: switch the guard on per platform. YouTube is built in. For the others, switching on
 * asks Chrome for access to that site; switching off removes the access again. The background
 * worker (platform-sync.js) registers the guard once access is granted.
 *
 * The setting is saved before asking Chrome, because the popup can close while Chrome's permission
 * prompt is open. If access ends up missing, the card shows "Needs access" with an Allow button.
 */
(function () {
  "use strict";

  const { PLATFORMS, PLATFORM_IDS, permissionOrigins } = globalThis.FocusPlatforms;

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    Object.assign(node, props);
    node.append(...children);
    return node;
  }

  async function hasAccess(id) {
    const origins = permissionOrigins(id);
    return origins.length === 0 || chrome.permissions.contains({ origins });
  }

  /**
   * @param {{ list: HTMLElement, message: HTMLElement, getPlatforms: () => string[],
   *           savePlatforms: (ids: string[]) => Promise<void>, onError: (e: unknown) => void }} deps
   */
  function setup(deps) {
    const say = (text) => (deps.message.textContent = text);

    async function requestAccess(id) {
      try {
        return await chrome.permissions.request({ origins: permissionOrigins(id) });
      } catch (error) {
        deps.onError(error);
        return false;
      }
    }

    async function turnOn(id) {
      const name = PLATFORMS[id].name;
      await deps.savePlatforms([...deps.getPlatforms(), id]);
      const granted = await requestAccess(id);
      if (!granted) {
        await deps.savePlatforms(deps.getPlatforms().filter((p) => p !== id));
        say(`Access to ${PLATFORMS[id].short} wasn't allowed, so ${name} stays off.`);
        return;
      }
      say(`✓ ${name} guard is on. Already-open ${PLATFORMS[id].short} tabs get it automatically.`);
    }

    async function turnOff(id) {
      await deps.savePlatforms(deps.getPlatforms().filter((p) => p !== id));
      await chrome.permissions.remove({ origins: permissionOrigins(id) }).catch(() => {});
      say(`${PLATFORMS[id].name} guard is off, and Focus Guard no longer has access to the site.`);
    }

    function card(id) {
      const p = PLATFORMS[id];
      const toggle = el("input", { type: "checkbox", className: "platform-toggle", role: "switch" });
      toggle.dataset.platform = id;
      toggle.setAttribute("aria-label", `Guard ${p.name}`);
      toggle.disabled = Boolean(p.builtIn);
      toggle.addEventListener("change", () => {
        say("");
        (toggle.checked ? turnOn(id) : turnOff(id)).then(render).catch(deps.onError);
      });

      const allow = el("button", { type: "button", className: "platform-allow", textContent: "Allow", hidden: true });
      allow.addEventListener("click", () => {
        requestAccess(id)
          .then((granted) => say(granted ? `✓ ${p.name} guard is on.` : "Access still not allowed."))
          .then(render)
          .catch(deps.onError);
      });

      return el("li", { className: "platform-card" }, [
        el("span", { className: "platform-icon", textContent: p.icon, ariaHidden: "true" }),
        el("span", { className: "platform-text" }, [
          el("span", { className: "platform-name", textContent: p.name }),
          el("span", { className: "platform-state" }),
        ]),
        allow,
        el("label", { className: "switch-ui" }, [toggle, el("span", { className: "switch-track", ariaHidden: "true" })]),
      ]);
    }

    deps.list.replaceChildren(...PLATFORM_IDS.map(card));

    /** Sync switches and status labels with settings and Chrome's granted access. */
    async function render() {
      const enabled = deps.getPlatforms();
      await Promise.all(
        PLATFORM_IDS.map(async (id) => {
          const toggle = deps.list.querySelector(`[data-platform="${id}"]`);
          const item = toggle.closest(".platform-card");
          const on = enabled.includes(id);
          const access = on ? await hasAccess(id) : false;
          const state = PLATFORMS[id].builtIn ? "built-in" : on && access ? "on" : on ? "needs-access" : "off";
          toggle.checked = on;
          item.dataset.state = state;
          item.querySelector(".platform-state").textContent = {
            "built-in": "Always on",
            on: "On",
            "needs-access": "Needs site access",
            off: "Off",
          }[state];
          item.querySelector(".platform-allow").hidden = state !== "needs-access";
        })
      );
    }

    return { render };
  }

  globalThis.FocusPlatformPicker = { setup };
})();
