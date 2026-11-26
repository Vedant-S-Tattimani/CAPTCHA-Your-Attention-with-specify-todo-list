/*
 * Service-worker helper: keeps the guard registered on exactly the platforms that are switched on
 * in settings AND that Chrome has granted access to. YouTube is declared in the manifest; every
 * other platform is registered at runtime with chrome.scripting, so Chrome only asks for access
 * to a site when the user switches it on. Loaded by background.js via importScripts.
 */
(function (root) {
  "use strict";

  const { PLATFORMS, PLATFORM_IDS, permissionOrigins } = root.FocusPlatforms;
  const { KEYS, sanitizeSettings } = root.FocusSettings;
  const SCRIPT_PREFIX = "guard-";

  /** Same files, in the same order, as the manifest's built-in YouTube guard. */
  function guardFiles() {
    return chrome.runtime.getManifest().content_scripts[0].js;
  }

  async function hasAccess(platformId) {
    const origins = permissionOrigins(platformId);
    return origins.length === 0 || chrome.permissions.contains({ origins });
  }

  /** Platforms (other than built-in YouTube) that should have the guard right now. */
  async function wantedPlatforms() {
    const data = await chrome.storage.local.get(KEYS.settings);
    const enabled = sanitizeSettings(data[KEYS.settings]).platforms.filter((id) => !PLATFORMS[id].builtIn);
    const checks = await Promise.all(enabled.map(async (id) => ((await hasAccess(id)) ? id : null)));
    return checks.filter(Boolean);
  }

  /** Adds the guard to tabs that are already open (Chrome only injects on page load). */
  async function injectIntoOpenTabs(matches) {
    if (!matches.length) return;
    const tabs = await chrome.tabs.query({ url: matches });
    await Promise.all(
      tabs.map((tab) =>
        chrome.scripting
          .executeScript({ target: { tabId: tab.id }, files: guardFiles() })
          .catch((e) => console.warn(`[Focus Guard] could not add guard to tab ${tab.id}`, e))
      )
    );
  }

  /**
   * Registers/unregisters per-platform guards to match settings + permissions.
   * @param {{ injectAll?: boolean }} [options] injectAll: also re-inject into every guarded open tab
   *   (after install/update, when old copies in open tabs need replacing).
   */
  async function sync({ injectAll = false } = {}) {
    const wanted = await wantedPlatforms();
    const registered = (await chrome.scripting.getRegisteredContentScripts())
      .map((s) => s.id)
      .filter((id) => id.startsWith(SCRIPT_PREFIX));
    const wantedIds = wanted.map((id) => SCRIPT_PREFIX + id);

    const stale = registered.filter((id) => !wantedIds.includes(id));
    if (stale.length) await chrome.scripting.unregisterContentScripts({ ids: stale });

    const added = wanted.filter((id) => !registered.includes(SCRIPT_PREFIX + id));
    if (added.length) {
      await chrome.scripting.registerContentScripts(
        added.map((id) => ({
          id: SCRIPT_PREFIX + id,
          matches: PLATFORMS[id].matches,
          js: guardFiles(),
          runAt: "document_idle",
          persistAcrossSessions: true,
        }))
      );
    }

    const injectFor = injectAll ? ["youtube", ...wanted] : added;
    await injectIntoOpenTabs(injectFor.flatMap((id) => PLATFORMS[id].matches));
    return { wanted, added, removed: stale.map((id) => id.slice(SCRIPT_PREFIX.length)) };
  }

  root.FocusPlatformSync = { sync, injectIntoOpenTabs, PLATFORM_IDS };
})(self);
