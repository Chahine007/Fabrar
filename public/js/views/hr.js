import { fetchWithAuth } from "../utils.js";
import { toast } from "../toast.js";
import { showModal, closeModal } from "../modal.js";

/* ═══════════════════════════════════════════════════════════════
   RENDER — Layout HTML (Master-Detail, 3 sub-tab audit)
   ═══════════════════════════════════════════════════════════════ */
const render = async () => `
  <div class="space-y-6 flex flex-col h-full">
    <!-- Top Bar -->
    <div class="flex flex-col md:flex-row items-start md:items-center justify-between mb-2 gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 tracking-tight">Centro Risorse Umane</h1>
        <p class="text-gray-500 font-medium">Controllo Qualità del Dato, Profili e Validazione</p>
      </div>
      <div class="flex flex-wrap gap-3">
        <div class="bg-yellow-50 text-yellow-700 px-4 py-2 rounded-lg font-bold border border-yellow-200 shadow-sm flex items-center gap-2">
          ⏳ Ore Pending: <span class="bg-yellow-200 px-2.5 py-0.5 rounded-full" id="badge-reports">0</span>
        </div>
        <div class="bg-yellow-50 text-yellow-700 px-4 py-2 rounded-lg font-bold border border-yellow-200 shadow-sm flex items-center gap-2">
          ⏳ Spese Pending: <span class="bg-yellow-200 px-2.5 py-0.5 rounded-full" id="badge-spese">0</span>
        </div>
        <div id="alert-warnings" class="bg-red-50 text-red-700 px-4 py-2 rounded-lg font-bold border border-red-200 shadow-sm flex items-center gap-2 hidden cursor-help group transition-all relative" title="">
           ⚠️ Anomalie: <span class="bg-red-200 px-2.5 py-0.5 rounded-full" id="badge-warnings">0</span>
           <div class="absolute top-full right-0 mt-2 bg-white text-gray-800 border border-red-100 shadow-xl rounded-xl p-4 w-80 hidden group-hover:block z-50">
              <h4 class="font-bold text-red-600 mb-2 border-b border-red-100 pb-2">Dettaglio Anomalie</h4>
              <ul id="warnings-list" class="space-y-2 text-sm font-medium"></ul>
           </div>
        </div>
      </div>
    </div>
    
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start flex-1 min-h-0">
      
      <!-- MASTER: Lista Dipendenti -->
      <div class="col-span-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[calc(100vh-180px)] overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100 bg-gray-50 flex-shrink-0 flex items-center justify-between">
          <h2 class="font-bold text-gray-800 tracking-tight text-lg">Indice Personale</h2>
          <span class="text-xs font-semibold bg-gray-200 text-gray-600 px-2.5 py-1 rounded-full" id="staff-count">0</span>
        </div>
        <div id="employee-list" class="flex-1 overflow-y-auto p-3 space-y-2">
            <div class="animate-pulse flex gap-4 p-3 border border-gray-100 rounded-xl">
              <div class="w-12 h-12 bg-gray-200 rounded-full flex-shrink-0"></div>
              <div class="flex-1 space-y-3 py-1">
                <div class="h-4 bg-gray-200 rounded w-3/4"></div>
                <div class="h-3 bg-gray-100 rounded w-1/2"></div>
              </div>
            </div>
        </div>
      </div>

      <!-- DETAIL PLACEHOLDER (Rich Empty State) -->
      <div class="col-span-1 lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[calc(100vh-180px)] overflow-hidden" id="empty-detail-state">
        <div class="p-8 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
          <h2 class="text-2xl font-black text-gray-800 tracking-tight">Riepilogo Gestione Personale</h2>
          <p class="text-gray-500 font-medium">Benvenuto nel pannello amministrativo HR. Seleziona un dipendente per i dettagli.</p>
        </div>
        <div class="p-8 flex-1 overflow-y-auto space-y-8">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-gray-50 p-6 rounded-2xl border border-gray-100 flex items-center gap-4">
              <div class="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl">👥</div>
              <div>
                <div class="text-2xl font-black text-gray-800" id="hr-dash-total">-</div>
                <div class="text-xs font-bold text-gray-400 uppercase tracking-wider">Dipendenti Totali</div>
              </div>
            </div>
            <div class="bg-gray-50 p-6 rounded-2xl border border-gray-100 flex items-center gap-4">
              <div class="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-2xl">⚠️</div>
              <div>
                <div class="text-2xl font-black text-gray-800" id="hr-dash-alerts">-</div>
                <div class="text-xs font-bold text-gray-400 uppercase tracking-wider">Anomalie Riscontrate</div>
              </div>
            </div>
          </div>

          <div class="space-y-4">
            <h3 class="text-sm font-bold text-gray-400 uppercase tracking-wider">💡 Suggerimenti Operativi</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow transition-shadow">
                <div class="font-bold text-gray-800 text-sm mb-1">Audit Settimanale</div>
                <p class="text-xs text-gray-500">Verifica i report in "Pending" ogni venerdì per assicurare la correttezza dei costi di cantiere.</p>
              </div>
              <div class="p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow transition-shadow">
                <div class="font-bold text-gray-800 text-sm mb-1">Aggiornamento Tariffe</div>
                <p class="text-xs text-gray-500">Ricorda di aggiornare le tariffe orarie dopo ogni promozione o rinnovo contrattuale.</p>
              </div>
            </div>
          </div>

          <div class="flex flex-col items-center justify-center py-10 opacity-40">
            <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <span class="text-3xl grayscale">🔍</span>
            </div>
            <p class="text-sm font-bold text-gray-400">Seleziona un profilo a sinistra per iniziare</p>
          </div>
        </div>
      </div>

      <!-- DETAIL CON TABS -->
      <div class="col-span-1 lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 flex-col h-[calc(100vh-180px)] hidden overflow-hidden relative print-expand" id="employee-detail">
        <button id="btn-close-detail" class="absolute top-4 right-4 z-10 w-8 h-8 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow border border-gray-100 text-gray-400 hover:text-gray-600 transition lg:hidden no-print">✕</button>

        <!-- Header Identità -->
        <div class="px-8 py-5 border-b border-gray-100 bg-gradient-to-r from-blue-50/50 to-white flex-shrink-0">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-5">
              <div class="w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-2xl uppercase shadow-md border-4 border-white" id="detail-avatar"></div>
              <div>
                <h2 class="text-2xl font-black text-gray-900 tracking-tight" id="detail-name">Nome</h2>
                <div class="text-sm text-gray-500 mt-0.5 flex items-center gap-3 flex-wrap" id="detail-meta">
                  <span id="detail-ruolo" class="font-semibold"></span>
                  <span id="detail-telefono" class="text-gray-400"></span>
                </div>
              </div>
            </div>
            <div class="flex gap-2 flex-wrap justify-end">
              <button id="btn-edit-profile" class="px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition shadow-sm hover:shadow text-sm">✏ Modifica Profilo</button>
              <button id="btn-edit-cost" class="px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition shadow-sm hover:shadow text-sm">💰 Aggiorna Tariffa</button>
            </div>
          </div>
          <!-- Costo orario + Skills + Docs -->
          <div class="flex flex-wrap items-center gap-4 text-sm">
            <span class="font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200" id="detail-costo-orario">€/h --</span>
            <div id="detail-skills" class="flex gap-1.5 flex-wrap"></div>
            <div id="detail-docs" class="flex gap-1.5 flex-wrap"></div>
          </div>
        </div>
        
        <!-- Tabs -->
        <div class="border-b border-gray-100 flex px-8 gap-1 bg-gray-50 flex-shrink-0 overflow-x-auto">
            <button data-tab="kpi" class="hr-tab px-4 py-3.5 border-b-2 font-bold focus:outline-none transition-colors text-sm whitespace-nowrap border-blue-600 text-blue-600">📊 Statistiche</button>
            <button data-tab="audit-ore" class="hr-tab px-4 py-3.5 border-b-2 border-transparent font-bold text-gray-500 hover:text-gray-700 focus:outline-none transition-colors text-sm whitespace-nowrap">📋 Ore Lavorate</button>
            <button data-tab="audit-spese" class="hr-tab px-4 py-3.5 border-b-2 border-transparent font-bold text-gray-500 hover:text-gray-700 focus:outline-none transition-colors text-sm whitespace-nowrap">💳 Spese</button>
            <button data-tab="audit-bot" class="hr-tab px-4 py-3.5 border-b-2 border-transparent font-bold text-gray-500 hover:text-gray-700 focus:outline-none transition-colors text-sm whitespace-nowrap">🤖 Interazioni Bot</button>
        </div>

        <!-- KPI Content -->
        <div id="panel-kpi" class="hr-panel flex-1 overflow-y-auto p-8 bg-white">
            <div class="grid grid-cols-2 gap-6">
              <div class="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                 <h3 class="text-gray-500 font-bold uppercase tracking-wider text-xs mb-1">Ore questo mese</h3>
                 <div class="text-4xl font-black text-blue-600" id="kpi-hours">0h</div>
              </div>
              <div class="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                 <h3 class="text-gray-500 font-bold uppercase tracking-wider text-xs mb-1">Spese Pending</h3>
                 <div class="text-4xl font-black text-yellow-600" id="kpi-pending-spese">0</div>
              </div>
              <div class="col-span-2 bg-gray-50 p-6 rounded-2xl border border-gray-100">
                 <h3 class="text-gray-500 font-bold uppercase tracking-wider text-xs mb-4">Qualità del Dato Inserito (Sorgenti)</h3>
                 <div id="kpi-sources" class="space-y-4"></div>
              </div>
            </div>
        </div>

        <!-- Audit Ore Content -->
        <div id="panel-audit-ore" class="hr-panel flex-1 overflow-y-auto p-6 bg-gray-50 hidden">
            <div class="flex flex-wrap justify-between items-center mb-4 gap-2">
                <div class="flex gap-2">
                   <select id="ore-filter-status" class="bg-white border text-sm border-gray-200 text-gray-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-100 font-medium">
                      <option value="pending" selected>🕒 Da Revisionare</option>
                      <option value="verified">✅ Verificati</option>
                      <option value="rejected">❌ Rifiutati</option>
                      <option value="">📋 Tutti</option>
                   </select>
                </div>
                <div class="flex gap-2">
                    <button id="btn-bulk-approve-ore" class="px-3 py-1.5 bg-green-500 text-white font-bold rounded-lg shadow-sm hover:bg-green-600 transition disabled:opacity-50 text-sm" disabled>Approva</button>
                    <button id="btn-bulk-reject-ore" class="px-3 py-1.5 bg-red-500 text-white font-bold rounded-lg shadow-sm hover:bg-red-600 transition disabled:opacity-50 text-sm" disabled>Rifiuta</button>
                </div>
            </div>
            <table class="w-full text-left bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden text-sm">
                <thead class="bg-gray-50 border-b border-gray-100 text-gray-600">
                   <tr>
                      <th class="p-3 w-10"><input type="checkbox" id="ore-select-all" class="rounded text-blue-600"></th>
                      <th class="p-3 font-semibold uppercase tracking-wider text-xs">Data</th>
                      <th class="p-3 font-semibold uppercase tracking-wider text-xs">Cantiere</th>
                      <th class="p-3 font-semibold uppercase tracking-wider text-xs">Ore</th>
                      <th class="p-3 font-semibold uppercase tracking-wider text-xs">Source</th>
                      <th class="p-3 font-semibold uppercase tracking-wider text-xs">Stato</th>
                      <th class="p-3 font-semibold uppercase tracking-wider text-xs">Azioni</th>
                   </tr>
                </thead>
                <tbody id="ore-container" class="divide-y divide-gray-100"></tbody>
            </table>
            <div id="ore-empty" class="hidden text-center py-10">
               <span class="text-4xl opacity-50 block mb-2">🎉</span>
               <span class="text-gray-500 font-bold">Nessun elemento presente con questo filtro.</span>
            </div>
        </div>

        <!-- Audit Spese Content -->
        <div id="panel-audit-spese" class="hr-panel flex-1 overflow-y-auto p-6 bg-gray-50 hidden">
            <div class="flex flex-wrap justify-between items-center mb-4 gap-2">
                <div class="flex gap-2 flex-wrap items-center">
                   <button type="button" id="btn-manual-spesa" class="px-3 py-1.5 bg-indigo-600 text-white font-bold rounded-lg shadow-sm hover:bg-indigo-700 transition text-sm">＋ Spesa ufficio</button>
                   <select id="spese-filter-status" class="bg-white border text-sm border-gray-200 text-gray-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-100 font-medium">
                      <option value="pending" selected>🕒 Da Revisionare</option>
                      <option value="verified">✅ Verificati</option>
                      <option value="rejected">❌ Rifiutati</option>
                      <option value="">📋 Tutti</option>
                   </select>
                </div>
                <div class="flex gap-2">
                    <button id="btn-bulk-approve-spese" class="px-3 py-1.5 bg-green-500 text-white font-bold rounded-lg shadow-sm hover:bg-green-600 transition disabled:opacity-50 text-sm" disabled>Approva</button>
                    <button id="btn-bulk-reject-spese" class="px-3 py-1.5 bg-red-500 text-white font-bold rounded-lg shadow-sm hover:bg-red-600 transition disabled:opacity-50 text-sm" disabled>Rifiuta</button>
                </div>
            </div>
            <table class="w-full text-left bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden text-sm">
                <thead class="bg-gray-50 border-b border-gray-100 text-gray-600">
                   <tr>
                      <th class="p-3 w-10"><input type="checkbox" id="spese-select-all" class="rounded text-blue-600"></th>
                      <th class="p-3 font-semibold uppercase tracking-wider text-xs">Data</th>
                      <th class="p-3 font-semibold uppercase tracking-wider text-xs">Cantiere</th>
                      <th class="p-3 font-semibold uppercase tracking-wider text-xs">Importo</th>
                      <th class="p-3 font-semibold uppercase tracking-wider text-xs">Fornitore</th>
                      <th class="p-3 font-semibold uppercase tracking-wider text-xs">Fonte</th>
                      <th class="p-3 font-semibold uppercase tracking-wider text-xs">Stato</th>
                      <th class="p-3 font-semibold uppercase tracking-wider text-xs">Azioni</th>
                   </tr>
                </thead>
                <tbody id="spese-container" class="divide-y divide-gray-100"></tbody>
            </table>
            <div id="spese-empty" class="hidden text-center py-10">
               <span class="text-4xl opacity-50 block mb-2">🎉</span>
               <span class="text-gray-500 font-bold">Nessuna spesa presente con questo filtro.</span>
            </div>
        </div>

        <!-- Audit Bot Content -->
        <div id="panel-audit-bot" class="hr-panel flex-1 overflow-y-auto p-6 bg-gray-50 hidden">
            <div id="bot-timeline" class="space-y-4"></div>
            <div id="bot-empty" class="hidden text-center py-10">
               <span class="text-4xl opacity-50 block mb-2">🤖</span>
               <span class="text-gray-500 font-bold">Nessuna interazione bot registrata per questo dipendente.</span>
            </div>
        </div>

      </div>
      
    </div>
  </div>
`;

/* ═══════════════════════════════════════════════════════════════
   MOUNT — Logica JavaScript
   ═══════════════════════════════════════════════════════════════ */
const mount = async () => {
    let currentEmployeeId = null;
    let currentEmployeeData = null;
    let selectedOre = new Set();
    let selectedSpese = new Set();

    // ── Helpers (testo utente sempre escaped — no XSS) ───
    const escapeHtml = (s) => {
      if (s == null) return '';
      const d = document.createElement('div');
      d.textContent = String(s);
      return d.innerHTML;
    };
    const statusBadge = (s) => {
      if (s === 'verified') return '<span class="text-green-600 font-bold">✓</span>';
      if (s === 'rejected') return '<span class="text-red-600 font-bold">✗</span>';
      return '<span class="text-yellow-600 font-bold">⏳</span>';
    };
    const sourceBadge = (m) => {
      const x = String(m || '').toLowerCase();
      if (x === 'timer' || x === 'gps' || x === 'app') {
        return '<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-semibold">Timer / GPS</span>';
      }
      if (x.includes('ocr')) return '<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-semibold">A.I. OCR</span>';
      return `<span class="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-semibold">${escapeHtml(m || 'n/d')}</span>`;
    };
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('it-IT') : '-';

    // ── TAB SWITCHING ───────────────────────────────────
    const tabs = document.querySelectorAll('.hr-tab');
    const panels = document.querySelectorAll('.hr-panel');
    let activeTab = 'kpi';

    const switchTab = (tab) => {
      activeTab = tab;
      tabs.forEach(t => {
        const isActive = t.dataset.tab === tab;
        t.className = `hr-tab px-4 py-3.5 border-b-2 font-bold focus:outline-none transition-colors text-sm whitespace-nowrap ${isActive ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`;
      });
      panels.forEach(p => {
        p.classList.toggle('hidden', p.id !== `panel-${tab}`);
      });
      if (currentEmployeeId) {
        if (tab === 'audit-ore') loadAuditOre(currentEmployeeId);
        if (tab === 'audit-spese') loadAuditSpese(currentEmployeeId);
        if (tab === 'audit-bot') loadBotTimeline(currentEmployeeId);
      }
    };
    tabs.forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

    // ── ALERTS (top bar) ────────────────────────────────
    if (typeof window.setSubBreadcrumb === 'function') {
        window.setSubBreadcrumb(null);
    }

    const loadAlerts = async () => {
        try {
            const res = await fetchWithAuth('/api/hr/alerts');
            const data = await res.json();
            document.getElementById('badge-reports').innerText = data.pending?.reports ?? 0;
            document.getElementById('badge-spese').innerText = data.pending?.spese ?? 0;
            const warnEl = document.getElementById('alert-warnings');
            const anomalies = data.anomalies || [];
            if (anomalies.length > 0) {
               warnEl.classList.remove('hidden');
               document.getElementById('badge-warnings').innerText = anomalies.length;
               const ul = document.getElementById('warnings-list');
               ul.textContent = '';
               anomalies.forEach((a) => {
                 const li = document.createElement('li');
                 li.textContent = '🚨 ' + a;
                 ul.appendChild(li);
               });
            } else {
               warnEl.classList.add('hidden');
            }
        } catch(e) { }
    };

    // ── KPI ─────────────────────────────────────────────
    const loadKPI = async (id) => {
        try {
            const res = await fetchWithAuth(`/api/hr/users/${id}/kpi`);
            const data = await res.json();
            document.getElementById('kpi-hours').innerText = `${data.totalHours}h`;
            document.getElementById('kpi-pending-spese').innerText = data.pendingSpese;
            document.getElementById('detail-costo-orario').innerText = `€/h ${data.costo_orario || '--'}`;
            let totalInputs = data.inputStats.reduce((acc, curr) => acc + curr.hours, 0);
            if (totalInputs === 0) totalInputs = 1;
            const html = data.inputStats.map(stat => {
                const perc = Math.round((stat.hours / totalInputs) * 100);
                const color = stat.input_method === 'timer' ? 'bg-green-500' : 'bg-red-500';
                return `
                   <div>
                     <div class="flex justify-between text-sm font-bold text-gray-700 mb-1">
                        <span>${stat.input_method === 'timer' ? '⏱️ In tempo reale (App)' : '📝 Inserimento Manuale/Vocale'}</span>
                        <span>${perc}% (${stat.hours}h)</span>
                     </div>
                     <div class="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                        <div class="h-full ${color} rounded-full transition-all duration-700" style="width: ${perc}%"></div>
                     </div>
                   </div>
                `;
            }).join('');
            document.getElementById('kpi-sources').innerHTML = html || '<div class="text-gray-500 italic text-sm">Nessun dato questo mese.</div>';
        } catch(e) {}
    };

    // ── AUDIT ORE ───────────────────────────────────────
    const loadAuditOre = async (id) => {
        selectedOre.clear();
        updateBulkBtns('ore');
        const statusFilter = document.getElementById('ore-filter-status').value;
        let url = `/api/hr/audit?employee_id=${id}&type=ore`;
        if (statusFilter) url += `&status=${statusFilter}`;
        try {
            const res = await fetchWithAuth(url);
            const data = await res.json();
            const container = document.getElementById('ore-container');
            const empty = document.getElementById('ore-empty');
            document.getElementById('ore-select-all').checked = false;
            if (data.length === 0) { container.innerHTML = ''; empty.classList.remove('hidden'); return; }
            empty.classList.add('hidden');
            container.innerHTML = data.map(row => {
              const rowClass = row.status === 'pending'
                ? 'bg-amber-50/90 hover:bg-amber-100/80 transition-colors'
                : 'hover:bg-gray-50 transition-colors';
              const pendingActions = row.status === 'pending' ? `
                  <button type="button" class="btn-approve-entry px-2 py-1 bg-green-600 text-white text-xs font-bold rounded-md hover:bg-green-700 mr-1" data-id="${row.id}">Approva</button>
                  <button type="button" class="btn-reject-entry px-2 py-1 bg-red-600 text-white text-xs font-bold rounded-md hover:bg-red-700 mr-1" data-id="${row.id}">Rifiuta</button>` : '';
              return `
              <tr class="${rowClass}">
                <td class="p-3">${row.status === 'pending' ? `<input type="checkbox" class="chk-ore rounded text-blue-600" data-id="${row.id}">` : ''}</td>
                <td class="p-3 font-medium text-gray-700">${fmtDate(row.date)}</td>
                <td class="p-3 text-gray-600">${escapeHtml(row.cantiere_nome) || '-'}</td>
                <td class="p-3 font-black text-gray-900">${escapeHtml(row.value)}h</td>
                <td class="p-3">${sourceBadge(row.input_method)}</td>
                <td class="p-3">${statusBadge(row.status)}</td>
                <td class="p-3 flex flex-wrap gap-1 items-center">
                  ${pendingActions}
                  <button type="button" class="edit-ore-btn text-blue-600 hover:text-blue-800 font-bold text-sm" data-id="${row.id}" data-ore="${row.value}" data-note="${encodeURIComponent(String(row.note || ''))}" data-cantiere="${encodeURIComponent(String(row.cantiere_nome || ''))}">✏</button>
                </td>
              </tr>`;
            }).join('');
            attachCheckboxEvents('ore', selectedOre);
            attachEditOreEvents();
        } catch(e) {}
    };

    // ── AUDIT SPESE ─────────────────────────────────────
    const loadAuditSpese = async (id) => {
        selectedSpese.clear();
        updateBulkBtns('spese');
        const statusFilter = document.getElementById('spese-filter-status').value;
        let url = `/api/hr/audit?employee_id=${id}&type=spese`;
        if (statusFilter) url += `&status=${statusFilter}`;
        try {
            const res = await fetchWithAuth(url);
            const data = await res.json();
            const container = document.getElementById('spese-container');
            const empty = document.getElementById('spese-empty');
            document.getElementById('spese-select-all').checked = false;
            if (data.length === 0) { container.innerHTML = ''; empty.classList.remove('hidden'); return; }
            empty.classList.add('hidden');
            container.innerHTML = data.map(row => `
              <tr class="hover:bg-gray-50 transition-colors">
                <td class="p-3">${row.status === 'pending' ? `<input type="checkbox" class="chk-spese rounded text-blue-600" data-id="${row.id}">` : ''}</td>
                <td class="p-3 font-medium text-gray-700">${fmtDate(row.date)}</td>
                <td class="p-3 text-gray-600">${escapeHtml(row.cantiere_nome) || '-'}</td>
                <td class="p-3 font-black text-gray-900">€ ${(row.value || 0).toFixed(2)}</td>
                <td class="p-3 text-gray-600 truncate max-w-[120px]">${escapeHtml(row.note) || '-'}</td>
                <td class="p-3">${sourceBadge(row.input_method)}</td>
                <td class="p-3">${statusBadge(row.status)}</td>
                <td class="p-3">
                  <button type="button" class="edit-spese-btn text-blue-600 hover:text-blue-800 font-bold text-sm" data-id="${row.id}" data-importo="${row.value}" data-note="${encodeURIComponent(String(row.note || ''))}">✏</button>
                </td>
              </tr>
            `).join('');
            attachCheckboxEvents('spese', selectedSpese);
            attachEditSpeseEvents();
        } catch(e) {}
    };

    // ── AUDIT BOT (Timeline) ────────────────────────────
    const loadBotTimeline = async (id) => {
        try {
            const res = await fetchWithAuth(`/api/admin/employees/${id}/timeline`);
            const data = await res.json();
            const container = document.getElementById('bot-timeline');
            const empty = document.getElementById('bot-empty');
            if (data.length === 0) { container.innerHTML = ''; empty.classList.remove('hidden'); return; }
            empty.classList.add('hidden');
            container.innerHTML = data.map(item => {
                const ts = fmtDate(item.timestamp);
                const time = item.timestamp ? new Date(item.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';
                if (item.type === 'LOG') {
                    return `
                      <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                        <div class="flex items-center gap-2 mb-2">
                          <span class="text-lg">${item.data.has_audio ? '🎙️' : '💬'}</span>
                          <span class="text-xs font-bold text-gray-400">${ts} ${time}</span>
                          <span class="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-semibold">${item.data.has_audio ? 'Vocale' : 'Testo'}</span>
                        </div>
                        <p class="text-sm text-gray-700 font-medium">${item.data.messaggio || '<em class="text-gray-400">Nessun testo</em>'}</p>
                      </div>`;
                } else if (item.type === 'REPORT') {
                    return `
                      <div class="bg-white p-4 rounded-xl border-l-4 border-l-blue-500 border border-gray-100 shadow-sm">
                        <div class="flex items-center gap-2 mb-1">
                          <span class="text-lg">📝</span>
                          <span class="text-xs font-bold text-gray-400">${ts} ${time}</span>
                          <span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-semibold">Report</span>
                        </div>
                        <p class="text-sm text-gray-700"><strong>${item.data.ore || 0}h</strong> — ${item.data.note || 'Nessuna nota'}</p>
                      </div>`;
                } else {
                    return `
                      <div class="bg-white p-4 rounded-xl border-l-4 border-l-amber-500 border border-gray-100 shadow-sm">
                        <div class="flex items-center gap-2 mb-1">
                          <span class="text-lg">💳</span>
                          <span class="text-xs font-bold text-gray-400">${ts} ${time}</span>
                          <span class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-semibold">Spesa</span>
                        </div>
                        <p class="text-sm text-gray-700">€ <strong>${(item.data.importo || 0).toFixed(2)}</strong></p>
                      </div>`;
                }
            }).join('');
        } catch(e) {}
    };

    // ── CHECKBOX + BULK ─────────────────────────────────
    function attachCheckboxEvents(type, set) {
        document.querySelectorAll(`.chk-${type}`).forEach(chk => {
            chk.addEventListener('change', (e) => {
                const id = e.target.dataset.id;
                if (e.target.checked) set.add(id); else set.delete(id);
                updateBulkBtns(type);
            });
        });
    }
    function updateBulkBtns(type) {
        const set = type === 'ore' ? selectedOre : selectedSpese;
        const btnA = document.getElementById(`btn-bulk-approve-${type}`);
        const btnR = document.getElementById(`btn-bulk-reject-${type}`);
        if (set.size > 0) {
           btnA.disabled = false; btnR.disabled = false;
           btnA.innerText = `Approva (${set.size})`;
           btnR.innerText = `Rifiuta (${set.size})`;
        } else {
           btnA.disabled = true; btnR.disabled = true;
           btnA.innerText = 'Approva'; btnR.innerText = 'Rifiuta';
        }
    }

    // Select All
    document.getElementById('ore-select-all').addEventListener('change', (e) => {
        document.querySelectorAll('.chk-ore').forEach(c => { c.checked = e.target.checked; c.dispatchEvent(new Event('change')); });
    });
    document.getElementById('spese-select-all').addEventListener('change', (e) => {
        document.querySelectorAll('.chk-spese').forEach(c => { c.checked = e.target.checked; c.dispatchEvent(new Event('change')); });
    });

    // Bulk actions
    const triggerBulk = async (type, newStatus) => {
        const set = type === 'ore' ? selectedOre : selectedSpese;
        if (set.size === 0) return;
        const items = Array.from(set).map(id => ({ id: Number(id), type, newStatus }));
        try {
            const res = await fetchWithAuth('/api/hr/audit/bulk', { method: 'PUT', body: JSON.stringify({ items }) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.error(data.error || 'Errore nel salvataggio.');
                return;
            }
            toast.success(`${items.length} record ${newStatus === 'verified' ? 'approvati' : 'rifiutati'}.`);
            loadAlerts();
            if (currentEmployeeId) {
                loadKPI(currentEmployeeId);
                if (type === 'ore') loadAuditOre(currentEmployeeId);
                else loadAuditSpese(currentEmployeeId);
            }
        } catch(e) { toast.error("Errore nel salvataggio."); }
    };

    document.getElementById('btn-bulk-approve-ore').addEventListener('click', () => triggerBulk('ore', 'verified'));
    document.getElementById('btn-bulk-reject-ore').addEventListener('click', () => triggerBulk('ore', 'rejected'));
    document.getElementById('btn-bulk-approve-spese').addEventListener('click', () => triggerBulk('spese', 'verified'));
    document.getElementById('btn-bulk-reject-spese').addEventListener('click', () => triggerBulk('spese', 'rejected'));

    document.getElementById('ore-container').addEventListener('click', async (e) => {
      const approve = e.target.closest('.btn-approve-entry');
      const reject = e.target.closest('.btn-reject-entry');
      if (!approve && !reject) return;
      const id = (approve || reject).dataset.id;
      const path = approve ? 'approve' : 'reject';
      try {
        const res = await fetchWithAuth(`/api/admin/entries/${id}/${path}`, { method: 'PATCH', body: '{}' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data.error || 'Operazione non consentita.');
          return;
        }
        toast.success(approve ? 'Riga approvata.' : 'Riga rifiutata.');
        loadAlerts();
        if (currentEmployeeId) {
          loadAuditOre(currentEmployeeId);
          loadKPI(currentEmployeeId);
        }
      } catch (_) {
        toast.error('Errore di rete.');
      }
    });

    document.getElementById('btn-manual-spesa').addEventListener('click', async () => {
      let cantieri = [];
      let pricebook = [];
      try {
        let r = await fetchWithAuth('/api/cantieri');
        if (r.status === 404) r = await fetchWithAuth('/api/admin/cantieri');
        cantieri = await r.json();
      } catch (_) {}
      try {
        const r = await fetchWithAuth('/api/pricebook');
        pricebook = await r.json();
      } catch (_) {}
      const catOpts = cantieri.map((c) => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`).join('');
      const pbOpts =
        '<option value="">— Nessun articolo listino —</option>' +
        pricebook
          .map(
            (p) =>
              `<option value="${p.id}" data-costo="${p.costo_unitario}">${escapeHtml(p.nome)} (€${p.costo_unitario}${p.unita ? '/' + escapeHtml(p.unita) : ''})</option>`
          )
          .join('');
      showModal({
        title: 'Spesa da ufficio (Policy 4.3)',
        body: `
          <div class="space-y-3 text-left">
            <div><label class="block text-sm font-semibold text-gray-700 mb-1">Cantiere</label>
              <select id="manual-spesa-cantiere" class="w-full px-3 py-2 rounded-xl border border-gray-200">${catOpts}</select></div>
            <div><label class="block text-sm font-semibold text-gray-700 mb-1">Listino materiali</label>
              <select id="manual-spesa-pb" class="w-full px-3 py-2 rounded-xl border border-gray-200">${pbOpts}</select></div>
            <div class="grid grid-cols-2 gap-2">
              <div><label class="block text-xs font-semibold text-gray-600 mb-1">Quantità</label>
              <input type="number" step="0.01" min="0" id="manual-spesa-qta" value="1" class="w-full px-3 py-2 rounded-xl border border-gray-200"></div>
              <div><label class="block text-xs font-semibold text-gray-600 mb-1">Importo € (totale)</label>
              <input type="number" step="0.01" min="0" id="manual-spesa-importo" class="w-full px-3 py-2 rounded-xl border border-gray-200"></div>
            </div>
            <div><label class="block text-sm font-semibold text-gray-700 mb-1">Fornitore</label>
              <input type="text" id="manual-spesa-fornitore" class="w-full px-3 py-2 rounded-xl border border-gray-200" placeholder="opzionale"></div>
            <div><label class="block text-sm font-semibold text-gray-700 mb-1">Descrizione</label>
              <input type="text" id="manual-spesa-desc" class="w-full px-3 py-2 rounded-xl border border-gray-200" placeholder="opzionale"></div>
            <button type="button" id="manual-spesa-save" class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition">Registra spesa</button>
          </div>`,
        onMount: (el) => {
          const pbSel = el.querySelector('#manual-spesa-pb');
          const qta = el.querySelector('#manual-spesa-qta');
          const imp = el.querySelector('#manual-spesa-importo');
          const syncFromPb = () => {
            const opt = pbSel.selectedOptions[0];
            const costo = opt && opt.dataset ? parseFloat(opt.dataset.costo, 10) : NaN;
            if (pbSel.value && Number.isFinite(costo)) {
              const q = parseFloat(qta.value, 10) || 1;
              imp.value = (costo * q).toFixed(2);
            }
          };
          pbSel.addEventListener('change', syncFromPb);
          qta.addEventListener('input', syncFromPb);
          el.querySelector('#manual-spesa-save').addEventListener('click', async () => {
            const cantiere_id = el.querySelector('#manual-spesa-cantiere').value;
            const importo = parseFloat(el.querySelector('#manual-spesa-importo').value, 10);
            const pricebook_id = el.querySelector('#manual-spesa-pb').value;
            const quantita = el.querySelector('#manual-spesa-qta').value;
            const fornitore = el.querySelector('#manual-spesa-fornitore').value;
            const descrizione = el.querySelector('#manual-spesa-desc').value;
            if (!cantiere_id || !Number.isFinite(importo) || importo <= 0) {
              toast.warn('Seleziona cantiere e un importo valido.');
              return;
            }
            const body = {
              cantiere_id: Number(cantiere_id),
              importo,
              fornitore: fornitore || null,
              descrizione: descrizione || null,
              fonte: 'MANUAL_OFFICE',
            };
            if (pricebook_id) {
              body.pricebook_id = Number(pricebook_id);
              body.quantita = parseFloat(quantita, 10) || 1;
            }
            try {
              const res = await fetchWithAuth('/api/admin/spese/manual', {
                method: 'POST',
                body: JSON.stringify(body),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                toast.error(data.error || 'Errore salvataggio.');
                return;
              }
              closeModal();
              toast.success('Spesa registrata.');
              loadAlerts();
              if (currentEmployeeId) {
                loadAuditSpese(currentEmployeeId);
                loadKPI(currentEmployeeId);
              }
            } catch (_) {
              toast.error('Errore di rete.');
            }
          });
        },
      });
    });

    // Filter changes
    document.getElementById('ore-filter-status').addEventListener('change', () => { if (currentEmployeeId) loadAuditOre(currentEmployeeId); });
    document.getElementById('spese-filter-status').addEventListener('change', () => { if (currentEmployeeId) loadAuditSpese(currentEmployeeId); });

    // ── EDIT ORE (Modal) — aggiorna report_entries (righe) ─
    function attachEditOreEvents() {
      document.querySelectorAll('.edit-ore-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          let decNote = '';
          try { decNote = decodeURIComponent(btn.dataset.note || ''); } catch { decNote = ''; }
          showModal({
            title: 'Modifica riga ore',
            body: `
              <div class="space-y-4">
                <div><label class="block text-sm font-semibold text-gray-700 mb-1">Ore Lavorate</label>
                <input type="number" step="0.5" id="edit-ore-val" value="${btn.dataset.ore}" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition"></div>
                <div><label class="block text-sm font-semibold text-gray-700 mb-1">Nota Amministratore</label>
                <textarea id="edit-ore-note" rows="2" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition" placeholder="Motivazione modifica..."></textarea></div>
                <button id="edit-ore-save" class="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition">Salva Modifiche</button>
              </div>`,
            onMount: (el) => {
              el.querySelector('#edit-ore-note').value = decNote;
              el.querySelector('#edit-ore-save').addEventListener('click', async () => {
                const ore = el.querySelector('#edit-ore-val').value;
                const note = el.querySelector('#edit-ore-note').value;
                try {
                  const res = await fetchWithAuth(`/api/hr/report-entries/${id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ ore_lavorate: parseFloat(ore), admin_note: note }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    toast.error(data.error || 'Errore aggiornamento.');
                    return;
                  }
                  closeModal();
                  toast.success('Riga aggiornata.');
                  loadAuditOre(currentEmployeeId);
                  loadKPI(currentEmployeeId);
                } catch(e) { toast.error('Errore aggiornamento.'); }
              });
            }
          });
        });
      });
    }

    // ── EDIT SPESE (Modal) ──────────────────────────────
    function attachEditSpeseEvents() {
      document.querySelectorAll('.edit-spese-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          showModal({
            title: 'Modifica Spesa',
            body: `
              <div class="space-y-4">
                <div><label class="block text-sm font-semibold text-gray-700 mb-1">Importo (€)</label>
                <input type="number" step="0.01" id="edit-spesa-val" value="${btn.dataset.importo}" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition"></div>
                <div><label class="block text-sm font-semibold text-gray-700 mb-1">Nota Amministratore</label>
                <textarea id="edit-spesa-note" rows="2" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition" placeholder="Motivazione modifica..."></textarea></div>
                <button id="edit-spesa-save" class="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition">Salva Modifiche</button>
              </div>`,
            onMount: (el) => {
              let decNote = '';
              try { decNote = decodeURIComponent(btn.dataset.note || ''); } catch { decNote = ''; }
              el.querySelector('#edit-spesa-note').value = decNote;
              el.querySelector('#edit-spesa-save').addEventListener('click', async () => {
                const importo = el.querySelector('#edit-spesa-val').value;
                const note = el.querySelector('#edit-spesa-note').value;
                try {
                  const res = await fetchWithAuth(`/api/hr/spese/${id}`, { method: 'PATCH', body: JSON.stringify({ importo: parseFloat(importo), admin_note: note }) });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    toast.error(data.error || 'Errore aggiornamento.');
                    return;
                  }
                  closeModal();
                  toast.success('Spesa aggiornata.');
                  loadAuditSpese(currentEmployeeId);
                } catch(e) { toast.error('Errore aggiornamento.'); }
              });
            }
          });
        });
      });
    }

    // ── MODAL TARIFFA ───────────────────────────────────
    document.getElementById('btn-edit-cost').addEventListener('click', () => {
        const today = new Date().toISOString().split('T')[0];
        showModal({
          title: 'Aggiorna Tariffa Oraria',
          body: `
            <div class="space-y-4">
              <div><label class="block text-sm font-semibold text-gray-700 mb-1">Nuovo Costo Orario (€)</label>
              <input type="number" step="0.5" id="modal-costo" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition"></div>
              <div><label class="block text-sm font-semibold text-gray-700 mb-1">Valido a partire dal</label>
              <input type="date" id="modal-valido-dal" value="${today}" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition"></div>
              <button id="modal-save-cost" class="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition">Salva ed Applica</button>
            </div>`,
          onMount: (el) => {
            el.querySelector('#modal-save-cost').addEventListener('click', async () => {
              const costo = el.querySelector('#modal-costo').value;
              const date = el.querySelector('#modal-valido-dal').value;
              if (!costo || !date) return toast.warn("Inserisci entrambi i campi");
              try {
                await fetchWithAuth(`/api/hr/users/${currentEmployeeId}/cost`, { method: 'POST', body: JSON.stringify({ costo_orario: costo, valido_dal: date }) });
                closeModal();
                toast.success('Tariffa aggiornata.');
                loadKPI(currentEmployeeId);
              } catch(e) { toast.error("Errore salvataggio tariffa."); }
            });
          }
        });
    });

    // ── MODAL MODIFICA PROFILO ──────────────────────────
    document.getElementById('btn-edit-profile').addEventListener('click', () => {
        const emp = currentEmployeeData;
        if (!emp) return;
        let skillsArr = [];
        try { skillsArr = JSON.parse(emp.skills || '[]'); } catch { }
        showModal({
          title: 'Modifica Profilo Dipendente',
          wide: true,
          body: `
            <div class="space-y-4">
              <!-- AI CV Auto-fill -->
              <div class="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm font-bold text-indigo-700">✨ Auto-compila da CV testuale</span>
                  <button id="mp-toggle-cv" class="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition underline">Mostra</button>
                </div>
                <div id="mp-cv-section" class="hidden space-y-2">
                  <textarea id="mp-cv-text" rows="4" placeholder="Incolla qui il testo del CV del dipendente..." class="w-full px-4 py-2.5 rounded-xl border border-indigo-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition text-sm"></textarea>
                  <button id="mp-parse-cv" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm transition text-sm flex items-center gap-2">
                    🤖 Analizza con AI
                  </button>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div><label class="block text-sm font-semibold text-gray-700 mb-1">Nome</label>
                <input type="text" id="mp-nome" value="${emp.nome || ''}" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition"></div>
                <div><label class="block text-sm font-semibold text-gray-700 mb-1">Cognome</label>
                <input type="text" id="mp-cognome" value="${emp.cognome || ''}" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition"></div>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div><label class="block text-sm font-semibold text-gray-700 mb-1">Ruolo</label>
                <input type="text" id="mp-ruolo" value="${emp.ruolo || ''}" placeholder="es. Muratore" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition"></div>
                <div><label class="block text-sm font-semibold text-gray-700 mb-1">Telefono</label>
                <input type="text" id="mp-telefono" value="${emp.telefono || ''}" placeholder="+39 xxx" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition"></div>
              </div>
              <div><label class="block text-sm font-semibold text-gray-700 mb-1">Skills (separate da virgola)</label>
              <input type="text" id="mp-skills" value="${skillsArr.join(', ')}" placeholder="Muratura, Carpenteria, Ponteggi" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition"></div>
              <div><label class="block text-sm font-semibold text-gray-700 mb-1">Note Amministratore</label>
              <textarea id="mp-note" rows="2" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition">${emp.note_admin || ''}</textarea></div>
              <button id="mp-save" class="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition">Salva Profilo</button>
            </div>`,
          onMount: (el) => {
            // Toggle CV section visibility
            el.querySelector('#mp-toggle-cv').addEventListener('click', () => {
              const section = el.querySelector('#mp-cv-section');
              const btn = el.querySelector('#mp-toggle-cv');
              const isHidden = section.classList.contains('hidden');
              section.classList.toggle('hidden');
              btn.textContent = isHidden ? 'Nascondi' : 'Mostra';
            });

            // AI CV Parse
            el.querySelector('#mp-parse-cv').addEventListener('click', async () => {
              const cvText = el.querySelector('#mp-cv-text').value.trim();
              if (cvText.length < 20) return toast.warn('Testo CV troppo corto (min 20 caratteri).');
              const btn = el.querySelector('#mp-parse-cv');
              btn.disabled = true;
              btn.innerHTML = '<span class="animate-pulse">🤖 Analisi in corso...</span>';
              try {
                const res = await fetchWithAuth('/api/admin/employees/parse-cv', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ text: cvText })
                });
                const data = await res.json();
                console.log('[CV Parse] Response:', data);
                if (data.error) {
                  // Mostra debug info se presente
                  if (data.debug) console.warn('[CV Parse] Debug:', data.debug);
                  throw new Error(data.error);
                }
                // Auto-fill fields
                if (data.ruolo) el.querySelector('#mp-ruolo').value = data.ruolo;
                if (data.skills && data.skills.length > 0) {
                  el.querySelector('#mp-skills').value = data.skills.join(', ');
                }
                toast.success(`AI ha estratto: "${data.ruolo || 'N/D'}" + ${(data.skills || []).length} skills.`);
                // Highlight changed fields
                el.querySelector('#mp-ruolo').style.borderColor = '#818cf8';
                el.querySelector('#mp-skills').style.borderColor = '#818cf8';
                setTimeout(() => {
                  el.querySelector('#mp-ruolo').style.borderColor = '';
                  el.querySelector('#mp-skills').style.borderColor = '';
                }, 3000);
              } catch(e) {
                toast.error('Errore AI: ' + (e.message || 'sconosciuto'));
              } finally {
                btn.disabled = false;
                btn.innerHTML = '🤖 Analizza con AI';
              }
            });

            // Save profile
            el.querySelector('#mp-save').addEventListener('click', async () => {
              const skills = el.querySelector('#mp-skills').value.split(',').map(s => s.trim()).filter(Boolean);
              const body = {
                nome: el.querySelector('#mp-nome').value,
                cognome: el.querySelector('#mp-cognome').value,
                ruolo: el.querySelector('#mp-ruolo').value,
                telefono: el.querySelector('#mp-telefono').value,
                skills: JSON.stringify(skills),
                note_admin: el.querySelector('#mp-note').value,
              };
              try {
                await fetchWithAuth(`/api/admin/employees/${currentEmployeeId}`, { method: 'PATCH', body: JSON.stringify(body) });
                closeModal();
                toast.success('Profilo aggiornato.');
                Object.assign(currentEmployeeData, body);
                renderEmployeeHeader(currentEmployeeData);
              } catch(e) { toast.error("Errore salvataggio profilo."); }
            });
          }
        });
    });

    // ── RENDER HEADER DIPENDENTE ────────────────────────
    function renderEmployeeHeader(emp) {
      const nomeCompleto = [emp.nome, emp.cognome].filter(Boolean).join(' ') || `Utente #${emp.telegram_id || emp.id}`;
      const init = nomeCompleto.charAt(0).toUpperCase();
      document.getElementById('detail-name').innerText = nomeCompleto;
      document.getElementById('detail-avatar').innerText = init;
      document.getElementById('detail-ruolo').innerText = emp.ruolo ? `🏷️ ${emp.ruolo}` : '';
      document.getElementById('detail-telefono').innerText = emp.telefono ? `📞 ${emp.telefono}` : '';
      // Skills chips
      let skills = [];
      try { skills = JSON.parse(emp.skills || '[]'); } catch {}
      document.getElementById('detail-skills').innerHTML = skills.map(s =>
        `<span class="bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full text-xs font-bold border border-indigo-200">${s}</span>`
      ).join('');
      // Docs chips
      let docs = [];
      try { docs = JSON.parse(emp.documenti || '[]'); } catch {}
      document.getElementById('detail-docs').innerHTML = docs.map(d =>
        `<a href="${d.url}" target="_blank" class="bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full text-xs font-bold border border-emerald-200 hover:bg-emerald-100 transition">📄 ${d.nome}</a>`
      ).join('');
    }

    // ── LOAD EMPLOYEES ──────────────────────────────────
    try {
        const empRes = await fetchWithAuth('/api/employees');
        const employees = await empRes.json();
        const listContainer = document.getElementById('employee-list');
        listContainer.innerHTML = '';
        document.getElementById('staff-count').innerText = employees.length;
        if (employees.length === 0) {
           listContainer.innerHTML = `<div class="p-6 text-gray-500 text-sm font-medium italic text-center">Nessun operatore configurato.</div>`;
        }
        employees.forEach(emp => {
            const btn = document.createElement('button');
            const nomeCompleto = [emp.nome, emp.cognome].filter(Boolean).join(' ') || `Utente #${emp.telegram_id || emp.id}`;
            const init = nomeCompleto.charAt(0).toUpperCase();
            btn.className = "w-full text-left p-3.5 rounded-xl hover:bg-gray-50 transition-all border border-transparent focus:border-blue-300 focus:bg-blue-50 focus:shadow-sm focus:ring-4 focus:ring-blue-50 group flex items-center gap-4 outline-none";
            btn.innerHTML = `
                <div class="w-12 h-12 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-lg group-hover:bg-blue-600 group-hover:text-white transition-colors border-2 border-white shadow-sm flex-shrink-0">${init}</div>
                <div class="flex flex-col flex-1 min-w-0">
                    <div class="font-bold text-gray-800 text-base group-hover:text-blue-900 truncate">${nomeCompleto}</div>
                    <div class="text-xs font-semibold text-gray-500 mt-0.5 flex items-center gap-1.5">
                        <span class="w-2 h-2 rounded-full ${emp.attivo ? 'bg-green-500' : 'bg-red-500'}"></span>
                        ${emp.attivo ? 'Attivo' : 'Sospeso'}
                        ${emp.ruolo ? `<span class="text-gray-400 ml-1">· ${emp.ruolo}</span>` : ''}
                    </div>
                </div>
                <div class="text-gray-300 group-hover:text-blue-500 transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </div>`;
            btn.addEventListener('click', () => {
                document.querySelectorAll('#employee-list button').forEach(b => b.classList.remove('bg-blue-50', 'border-blue-200', 'shadow-sm'));
                btn.classList.add('bg-blue-50', 'border-blue-200', 'shadow-sm');
                currentEmployeeId = emp.id;
                currentEmployeeData = emp;
                document.getElementById('empty-detail-state').classList.add('hidden');
                document.getElementById('employee-detail').classList.remove('hidden');
                document.getElementById('employee-detail').classList.add('flex');
                renderEmployeeHeader(emp);
                if (typeof window.setSubBreadcrumb === 'function') {
                    window.setSubBreadcrumb(nomeCompleto);
                }
                loadKPI(emp.id);
                if (activeTab === 'audit-ore') loadAuditOre(emp.id);
                else if (activeTab === 'audit-spese') loadAuditSpese(emp.id);
                else if (activeTab === 'audit-bot') loadBotTimeline(emp.id);
            });
            listContainer.appendChild(btn);
        });
    } catch (err) {
        document.getElementById('employee-list').innerHTML = `<div class="p-4 m-2 bg-red-50 text-red-600 border border-red-200 rounded-lg font-bold">Errore: ${err.message}</div>`;
    }

    loadAlerts();

    // Close detail action (mobile friendly)
    const closeBtn = document.getElementById('btn-close-detail');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            document.getElementById('empty-detail-state').classList.remove('hidden');
            document.getElementById('employee-detail').classList.add('hidden');
            document.getElementById('employee-detail').classList.remove('flex');
            document.querySelectorAll('#employee-list button').forEach(b => b.classList.remove('bg-blue-50', 'border-blue-200', 'shadow-sm'));
            if (typeof window.setSubBreadcrumb === 'function') window.setSubBreadcrumb(null);
        });
    }

    // Populate Empty State Stats
    const populateEmptyStats = async () => {
        try {
            const res = await fetchWithAuth('/api/hr/alerts');
            const data = await res.json();
            document.getElementById('hr-dash-total').innerText = document.getElementById('staff-count').innerText;
            const nWarn = (data.warnings && data.warnings.length) || 0;
            const nAnom = (data.anomalies && data.anomalies.length) || 0;
            document.getElementById('hr-dash-alerts').innerText = String(nWarn + nAnom);
        } catch(e) {}
    };
    setTimeout(populateEmptyStats, 500);
};

export default { render, mount };
