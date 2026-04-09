// router.js
import { fetchWithAuth } from "./utils.js";

// Import dinamici (Lazy Loading/Code Splitting)
// Non scarichiamo più i JS all'apertura, ma solo click-time

// Dizionario delle Rotte (Specifichiamo il nome file senza path completo)
const routes = {
  '/login': {
    title: 'Accesso Riservato',
    view: 'login'
  },
  '/dashboard': {
    title: 'Dashboard Operativa',
    view: 'dashboard'
  },
  '/cantieri': {
    title: 'Job Costing',
    view: 'cantieri'
  },
  '/hr': {
    title: 'Risorse Umane',
    view: 'hr'
  },
  '/genya': {
    title: 'Sincronizzazione Genya',
    view: 'genya'
  }
};

// Cache-bust per i moduli view (evita asset stantii dopo deploy)
const APP_VERSION = window.__APP_VERSION__ || String(Date.now());

/**
 * Utility per arricchire il breadcrumb dal modulo vista
 * Es: window.setSubBreadcrumb("Mario Rossi") -> "Risorse Umane › Mario Rossi"
 */
window.setSubBreadcrumb = (subtitle) => {
  const breadcrumb = document.getElementById('breadcrumb');
  const hash = window.location.hash.replace('#', '');
  const mainTitle = routes[hash]?.title || "Modulo";
  breadcrumb.innerHTML = subtitle 
    ? `${mainTitle} <span class="text-gray-300 mx-1">›</span> <span class="text-blue-600">${subtitle}</span>` 
    : mainTitle;
};

/**
 * Funzione fulcro del Router Vanilla. 
 */
export async function initializeRouter() {
  let hash = window.location.hash || '#/dashboard';
  
  // Hard Redirect on empty path
  if (hash === '#/' || hash === '#' || hash === '') {
    window.location.hash = '#/dashboard';
    return;
  }

  const routePath = hash.replace('#', '');

  // ---------------------------------------------
  // GUARD CLIPPING (PROTEZIONE ROTTE)
  // ---------------------------------------------
  const token = localStorage.getItem('jwt_token');
  if (!token && routePath !== '/login') {
    window.location.hash = '#/login';
    return;
  }

  // Se l'utente tenta /login ma è già loggato, via su dashboard
  if (token && routePath === '/login') {
    window.location.hash = '#/dashboard';
    return;
  }

  const route = routes[routePath] || null;
  const viewName = route?.view || routePath.replace('/', '');

  const appContent = document.getElementById('app-content');
  const breadcrumb = document.getElementById('breadcrumb');
  const aside = document.querySelector('aside');
  const header = document.querySelector('header');
  
  // UI FullScreen per Login
  if (viewName === 'login') {
      aside?.classList.add('hidden');
      header?.classList.add('hidden');
      appContent.classList.remove('p-8');
      appContent.classList.add('p-0');
  } else {
      aside?.classList.remove('hidden');
      header?.classList.remove('hidden');
      appContent.classList.add('p-8');
      appContent.classList.remove('p-0');
  }
  
  // Fallback 404 (route vuota o non valida)
  if (!viewName) {
    appContent.innerHTML = `
      <div class="flex flex-col items-center justify-center h-[60vh]">
          <h1 class="text-5xl font-bold text-red-500 mb-4">404</h1>
          <p class="text-xl text-gray-600">Modulo non trovato o URL errato.</p>
      </div>
    `;
    breadcrumb.textContent = "Errore di Navigazione";
    document.title = "Errore di Navigazione - ERP";
    return;
  }

  // Pre-fetch UI state
  appContent.innerHTML = `
    <div class="flex items-center justify-center h-[60vh] flex-col gap-4">
        <div class="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        <div class="animate-pulse text-gray-400 font-medium tracking-wide">Caricamento...</div>
    </div>
  `;
  
  try {
    // 0. Import Dinamico del Modulo JS (Lazy Load Network Request)
    const viewModule = await import(`./views/${viewName}.js?v=${APP_VERSION}`);
    const module = viewModule.default;
    if (!module || typeof module.render !== 'function') {
      throw new Error('Modulo non valido');
    }

    // 1. Inietta l'HTML
    const html = await module.render();
    appContent.innerHTML = html;
    
    // 2. Monta la logica JS (Lifecycle hook)
    if (typeof module.mount === 'function') {
        await module.mount();
    }
    
    // 3. Aggiorna meta dati della shell
    const title = route?.title || "Modulo";
    breadcrumb.textContent = title;
    document.title = `${title} - ERP`;
    
    // 4. Segnaletica visiva laterale
    updateActiveSidebarLink(route ? routePath : '');
    updateSidebarBadges();
  } catch (error) {
    appContent.innerHTML = `<div class="text-red-500 font-bold bg-red-50 p-6 rounded-xl border border-red-200">Errore Modulo: ${error.message}</div>`;
    breadcrumb.textContent = "Errore di Navigazione";
    document.title = "Errore di Navigazione - ERP";
    updateActiveSidebarLink('');
  }
}

/**
 * Interroga il server per i conteggi pendenti e aggiorna i badge in sidebar.
 */
async function updateSidebarBadges() {
  try {
    const res = await fetchWithAuth('/api/admin/pending-summary');
    if (!res.ok) return;
    const data = await res.json();
    
    const badgeHr = document.getElementById('badge-hr');
    const badgeCantieri = document.getElementById('badge-cantieri');
    
    // HR Badge (Reports pendenti)
    if (data.reports > 0) {
      badgeHr.textContent = data.reports;
      badgeHr.classList.remove('hidden');
    } else {
      badgeHr.classList.add('hidden');
    }
    
    // Cantieri Badge (Spese pendenti)
    if (data.spese > 0) {
      badgeCantieri.textContent = data.spese;
      badgeCantieri.classList.remove('hidden');
    } else {
      badgeCantieri.classList.add('hidden');
    }
  } catch (e) {
    console.warn("Errore aggiornamento badge sidebar:", e);
  }
}

/**
 * Aggiorna lo stato "attivo" CSS (via classi Tailwind) degli <a> nella Sidebar.
 */
function updateActiveSidebarLink(currentRoute) {
  const links = document.querySelectorAll('#sidebarNav .nav-link');
  
  links.forEach(link => {
    link.classList.remove('bg-slate-800', 'text-white', 'shadow-inner');
    link.classList.add('text-slate-400');
    
    if (link.dataset.route === currentRoute) {
      link.classList.remove('text-slate-400');
      link.classList.add('bg-slate-800', 'text-white', 'shadow-inner');
    }
  });
}
