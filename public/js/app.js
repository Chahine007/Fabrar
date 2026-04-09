let initializeRouter;

async function loadRouter() {
  if (initializeRouter) return initializeRouter;
  const appVersion = window.__APP_VERSION__ || "";
  const versionQuery = appVersion ? `?v=${appVersion}` : "";
  const routerModule = await import(`/js/router.js${versionQuery}`);
  initializeRouter = routerModule.initializeRouter;
  return initializeRouter;
}

/**
 * Entry Point della Single-Page Application (SPA).
 */
document.addEventListener('DOMContentLoaded', async () => {
  const init = await loadRouter();
  // 1. Inizializzazione prima rotta.
  init();

  // 2. Ascoltiamo passivamente i cambi di Hash (click su Sidebar).
  window.addEventListener('hashchange', init);
});
