import { fetchWithAuth } from "../utils.js";
import { toast } from "../toast.js";
import { showModal, closeModal } from "../modal.js";

/* ═══════════════════════════════════════════════════════════════
   RENDER — Layout HTML (Master-Detail con Tabs)
   ═══════════════════════════════════════════════════════════════ */
const render = async () => `
  <div class="space-y-6 flex flex-col h-full">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 tracking-tight">Cantieri & Job Costing</h1>
        <p class="text-gray-500 font-medium mt-1">Stato d'avanzamento budget, analisi finanziaria e gestione</p>
      </div>
      <button id="btn-add-cantiere" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-5 rounded-xl transition-colors shadow-sm hidden sm:block text-sm">
        + Nuovo Cantiere
      </button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start flex-1 min-h-0">
      
      <!-- MASTER: Lista Cantieri -->
      <div class="col-span-1 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[calc(100vh-180px)] overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100 bg-gray-50 flex-shrink-0 flex items-center justify-between">
          <h2 class="font-bold text-gray-800 tracking-tight text-lg">Cantieri</h2>
          <span class="text-xs font-semibold bg-gray-200 text-gray-600 px-2.5 py-1 rounded-full" id="cantieri-count">0</span>
        </div>
        <div id="cantieri-list" class="flex-1 overflow-y-auto p-3 space-y-2">
            <div class="animate-pulse flex gap-4 p-3 border border-gray-100 rounded-xl">
              <div class="w-10 h-10 bg-gray-200 rounded-lg flex-shrink-0"></div>
              <div class="flex-1 space-y-3 py-1"><div class="h-4 bg-gray-200 rounded w-3/4"></div><div class="h-3 bg-gray-100 rounded w-1/2"></div></div>
            </div>
        </div>
      </div>

      <!-- DETAIL PLACEHOLDER (Rich Empty State) -->
      <div class="col-span-1 lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[calc(100vh-180px)] overflow-hidden" id="cantiere-empty-state">
        <div class="p-8 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-white">
          <h2 class="text-2xl font-black text-gray-800 tracking-tight">Riepilogo Job Costing</h2>
          <p class="text-gray-500 font-medium">Benvenuto nel pannello gestionale cantieri. Seleziona un cantiere per analizzare i costi.</p>
        </div>
        <div class="p-8 flex-1 overflow-y-auto space-y-8">
          <!-- Global Stats -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6" id="cd-global-stats">
            <div class="bg-gray-50 p-6 rounded-2xl border border-gray-100 flex items-center gap-4">
              <div class="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-2xl">💰</div>
              <div>
                <div class="text-2xl font-black text-gray-800" id="cd-dash-budget">-</div>
                <div class="text-xs font-bold text-gray-400 uppercase tracking-wider">Budget Totale Impegnato</div>
              </div>
            </div>
            <div class="bg-gray-50 p-6 rounded-2xl border border-gray-100 flex items-center gap-4">
              <div class="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl">📈</div>
              <div>
                <div class="text-2xl font-black text-gray-800" id="cd-dash-cost">-</div>
                <div class="text-xs font-bold text-gray-400 uppercase tracking-wider">Costo Reale Ad Oggi</div>
              </div>
            </div>
          </div>

          <div class="space-y-4">
            <h3 class="text-sm font-bold text-gray-400 uppercase tracking-wider">🚧 Monitoraggio Cantieri</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4" id="cd-dash-status-grid">
               <!-- Dinamicamente popolato con conteggi stati -->
            </div>
          </div>

          <div class="flex flex-col items-center justify-center py-10 opacity-40">
            <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <span class="text-3xl grayscale">🏗️</span>
            </div>
            <p class="text-sm font-bold text-gray-400">Seleziona un cantiere a sinistra per i dettagli finanziari</p>
          </div>
        </div>
      </div>

      <!-- DETAIL PANEL -->
      <div class="col-span-1 lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 flex-col h-[calc(100vh-180px)] hidden overflow-hidden print-expand relative" id="cantiere-detail">
        <button id="btn-close-cantiere" class="absolute top-4 right-4 z-10 w-8 h-8 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow border border-gray-100 text-gray-400 hover:text-gray-600 transition lg:hidden no-print">✕</button>

        <!-- Header -->
        <div class="px-8 py-5 border-b border-gray-100 bg-gradient-to-r from-emerald-50/50 to-white flex-shrink-0 flex items-center justify-between">
          <div>
            <h2 class="text-2xl font-black text-gray-900 tracking-tight" id="cd-name">Nome Cantiere</h2>
            <div class="text-sm text-gray-500 mt-0.5 flex items-center gap-3" id="cd-meta">
              <span id="cd-status-badge"></span>
              <span id="cd-coords" class="text-gray-400"></span>
            </div>
          </div>
          <div class="flex gap-2">
            <button id="cd-btn-print" class="px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition shadow-sm text-sm no-print">🖨️ Stampa Report</button>
            <button id="cd-btn-settings" class="px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition shadow-sm text-sm">⚙ Impostazioni</button>
          </div>
        </div>
        
        <!-- Tabs -->
        <div class="border-b border-gray-100 flex px-8 gap-1 bg-gray-50 flex-shrink-0">
            <button data-ctab="kpi" class="c-tab px-4 py-3.5 border-b-2 font-bold focus:outline-none transition-colors text-sm whitespace-nowrap border-blue-600 text-blue-600">📊 KPI Finanziari</button>
            <button data-ctab="chart" class="c-tab px-4 py-3.5 border-b-2 border-transparent font-bold text-gray-500 hover:text-gray-700 focus:outline-none transition-colors text-sm whitespace-nowrap">📈 Grafico Finanziario</button>
            <button data-ctab="operativi" class="c-tab px-4 py-3.5 border-b-2 border-transparent font-bold text-gray-500 hover:text-gray-700 focus:outline-none transition-colors text-sm whitespace-nowrap">👷 Operativi</button>
        </div>

        <!-- KPI Panel -->
        <div id="cpanel-kpi" class="c-panel flex-1 overflow-y-auto p-8">
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-5" id="cd-kpi-grid"></div>
        </div>

        <!-- Chart Panel -->
        <div id="cpanel-chart" class="c-panel flex-1 overflow-y-auto p-8 hidden">
          <div class="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h3 class="font-bold text-gray-800 mb-4">Andamento Finanziario Cumulativo</h3>
            <div class="relative h-80 w-full">
              <canvas id="financial-chart"></canvas>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-4 mt-6" id="cd-chart-kpis"></div>
        </div>

        <!-- Operativi Panel -->
        <div id="cpanel-operativi" class="c-panel flex-1 overflow-y-auto p-8 hidden">
          <div class="space-y-6">
            <!-- Ore per dipendente -->
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div class="px-6 py-4 border-b border-gray-100 bg-gray-50"><h3 class="font-bold text-gray-800">Ore per Dipendente</h3></div>
              <table class="w-full text-left text-sm">
                <thead class="bg-gray-50 border-b text-gray-600"><tr>
                  <th class="px-6 py-3 font-semibold">Dipendente</th><th class="px-6 py-3 font-semibold text-right">Ore Tot.</th><th class="px-6 py-3 font-semibold text-right">Costo Calc.</th><th class="px-6 py-3 font-semibold text-right">Ultimo Accesso</th>
                </tr></thead>
                <tbody id="cd-dipendenti-table" class="divide-y divide-gray-100"></tbody>
              </table>
            </div>
            <!-- Ripartizione costi -->
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 class="font-bold text-gray-800 mb-4">Ripartizione Costi</h3>
              <div id="cd-cost-breakdown" class="space-y-4"></div>
            </div>
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
    let currentCantiereId = null;
    let chartInstance = null;
    let cantieriCache = [];

    // ── TAB SWITCHING ───────────────────────────────────
    let activeTab = 'kpi';
    const tabs = document.querySelectorAll('.c-tab');
    const panels = document.querySelectorAll('.c-panel');
    const switchTab = (tab) => {
      activeTab = tab;
      tabs.forEach(t => {
        const isActive = t.dataset.ctab === tab;
        t.className = `c-tab px-4 py-3.5 border-b-2 font-bold focus:outline-none transition-colors text-sm whitespace-nowrap ${isActive ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`;
      });
      panels.forEach(p => p.classList.toggle('hidden', p.id !== `cpanel-${tab}`));
      if (currentCantiereId) {
        if (tab === 'chart') loadFinancialChart(currentCantiereId);
      }
    };
    tabs.forEach(t => t.addEventListener('click', () => switchTab(t.dataset.ctab)));

    // ── LOAD CANTIERI (Master List) ─────────────────────
    const loadCantieri = async () => {
      try {
        let resStatus = await fetchWithAuth('/api/cantieri/status');
        let stData = await resStatus.json();
        
        let resC = await fetchWithAuth('/api/cantieri');
        // Fallback diagnostico se il nuovo endpoint da 404
        if (resC.status === 404) {
            resC = await fetchWithAuth('/api/admin/cantieri');
        }
        const all = await resC.json();
        cantieriCache = all;
        
        const statusMap = {};
        // Gestione flessibile sia se arriva Array che Oggetto
        if (Array.isArray(stData)) {
            stData.forEach(s => { statusMap[s.id] = s; });
        } else {
            Object.keys(stData).forEach(id => { statusMap[id] = stData[id]; });
        }

        const list = document.getElementById('cantieri-list');
        list.innerHTML = '';
        document.getElementById('cantieri-count').innerText = all.length;
        
        if (all.length === 0) {
          list.innerHTML = '<div class="p-6 text-gray-500 text-sm font-medium italic text-center">Nessun cantiere.</div>';
          return;
        }

        // Attivi prima, poi chiusi
        all.sort((a, b) => (b.attivo - a.attivo) || a.nome.localeCompare(b.nome));

        all.forEach(c => {
          const st = statusMap[c.id];
          const budget = c.budget || 0;
          const costo = st ? st.costo_totale : 0;
          const pct = budget > 0 ? (costo / budget) : null;
          let dotColor = 'bg-gray-400';
          if (!c.attivo) dotColor = 'bg-gray-300';
          else if (pct !== null) {
            if (pct < 0.75) dotColor = 'bg-green-500';
            else if (pct <= 0.90) dotColor = 'bg-amber-500';
            else dotColor = 'bg-red-500';
          }

          const btn = document.createElement('button');
          btn.className = `w-full text-left p-3.5 rounded-xl hover:bg-gray-50 transition-all border border-transparent focus:border-blue-300 focus:bg-blue-50 focus:shadow-sm focus:ring-4 focus:ring-blue-50 group flex items-center gap-4 outline-none ${!c.attivo ? 'opacity-60' : ''}`;
          btn.innerHTML = `
            <div class="w-10 h-10 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-sm group-hover:bg-blue-600 group-hover:text-white transition-colors border border-gray-200 flex-shrink-0">🏗️</div>
            <div class="flex flex-col flex-1 min-w-0">
              <div class="font-bold text-gray-800 text-sm group-hover:text-blue-900 truncate">${c.nome}</div>
              <div class="text-xs font-semibold text-gray-500 mt-0.5 flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full ${dotColor}"></span>
                ${c.attivo ? (pct !== null ? `${(pct * 100).toFixed(0)}% budget` : 'N/D') : 'Chiuso'}
                ${budget > 0 ? `<span class="text-gray-400 ml-1">· € ${budget.toLocaleString('it-IT')}</span>` : ''}
              </div>
            </div>
            <svg class="text-gray-300 group-hover:text-blue-500 transition-colors flex-shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
          `;
          btn.addEventListener('click', () => selectCantiere(c.id, btn));
          list.appendChild(btn);
        });
      } catch(e) {
        document.getElementById('cantieri-list').innerHTML = `<div class="p-4 m-2 bg-red-50 text-red-600 border border-red-200 rounded-lg font-bold text-sm">Errore: ${e.message}</div>`;
      }
    };

    // ── SELECT CANTIERE (Detail Load) ───────────────────
    const selectCantiere = async (id, btn) => {
      document.querySelectorAll('#cantieri-list button').forEach(b => b.classList.remove('bg-blue-50', 'border-blue-200', 'shadow-sm'));
      if (btn) btn.classList.add('bg-blue-50', 'border-blue-200', 'shadow-sm');
      currentCantiereId = id;
      document.getElementById('cantiere-empty-state').classList.add('hidden');
      document.getElementById('cantiere-detail').classList.remove('hidden');
      document.getElementById('cantiere-detail').classList.add('flex');

      try {
        const res = await fetchWithAuth(`/api/cantieri/${id}/details`);
        const data = await res.json();
        renderCantiereDetail(data);
        if (typeof window.setSubBreadcrumb === 'function') {
            window.setSubBreadcrumb(data.cantiere.nome);
        }
        if (activeTab === 'chart') loadFinancialChart(id);
      } catch(e) { toast.error('Errore caricamento dettagli cantiere.'); }
    };

    // ── RENDER DETAIL ───────────────────────────────────
    const renderCantiereDetail = (data) => {
      const { cantiere, kpi, perDipendente } = data;
      document.getElementById('cd-name').innerText = cantiere.nome;
      document.getElementById('cd-status-badge').innerHTML = cantiere.attivo
        ? '<span class="bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full text-xs font-bold border border-green-200">● ATTIVO</span>'
        : '<span class="bg-gray-200 text-gray-600 px-2.5 py-0.5 rounded-full text-xs font-bold border border-gray-300">○ CHIUSO</span>';
      document.getElementById('cd-coords').innerText = cantiere.lat && cantiere.lng
        ? `📍 ${cantiere.lat.toFixed(4)}, ${cantiere.lng.toFixed(4)}  |  📏 ${cantiere.raggio_tolleranza || 300}m`
        : '📍 Coordinate non impostate';

      // KPI Cards
      const pctUsed = kpi.budget > 0 ? ((kpi.costoTotale / kpi.budget) * 100) : null;
      const budgetColor = pctUsed === null ? 'border-l-gray-400' : (pctUsed < 75 ? 'border-l-green-500' : pctUsed <= 90 ? 'border-l-amber-500' : 'border-l-red-500');
      const margineColor = kpi.margine >= 0 ? 'text-green-600' : 'text-red-600';

      document.getElementById('cd-kpi-grid').innerHTML = `
        <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-blue-500">
          <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Budget Totale</div>
          <div class="text-2xl font-black text-gray-800">€ ${kpi.budget.toLocaleString('it-IT', {minimumFractionDigits:2})}</div>
        </div>
        <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 border-l-4 ${budgetColor}">
          <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Costo Attuale</div>
          <div class="text-2xl font-black text-gray-800">€ ${kpi.costoTotale.toLocaleString('it-IT', {minimumFractionDigits:2})}</div>
          ${pctUsed !== null ? `<div class="text-xs font-semibold mt-1 ${pctUsed > 90 ? 'text-red-500' : 'text-gray-500'}">${pctUsed.toFixed(1)}% del budget</div>` : ''}
        </div>
        <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-emerald-500">
          <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Margine Residuo</div>
          <div class="text-2xl font-black ${margineColor}">€ ${kpi.margine.toLocaleString('it-IT', {minimumFractionDigits:2})}</div>
        </div>
        <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-purple-500">
          <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Burn Rate</div>
          <div class="text-2xl font-black text-purple-600">€ ${kpi.burnRate.toLocaleString('it-IT', {minimumFractionDigits:2})}</div>
          <div class="text-xs font-semibold text-gray-500 mt-1">/mese (su ${kpi.nMesi} mesi)</div>
        </div>
      `;

      // Operativi — Tabella dipendenti
      const tbody = document.getElementById('cd-dipendenti-table');
      if (perDipendente.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-6 text-center text-gray-500 italic">Nessuna riga ore VERIFICATE per questo cantiere.</td></tr>';
      } else {
        tbody.innerHTML = perDipendente.map(d => `
          <tr class="hover:bg-gray-50 transition-colors">
            <td class="px-6 py-3 font-bold text-gray-900">${[d.nome, d.cognome].filter(Boolean).join(' ') || '-'}</td>
            <td class="px-6 py-3 text-right font-medium">${(d.ore_tot || 0).toFixed(1)}h</td>
            <td class="px-6 py-3 text-right font-medium">€ ${(d.costo_calcolato || 0).toFixed(2)}</td>
            <td class="px-6 py-3 text-right text-gray-500 text-xs">${d.ultimo_accesso || '-'}</td>
          </tr>
        `).join('');
      }

      // Ripartizione costi (bar orizzontali)
      const total = kpi.costoTotale || 1;
      const pctMano = ((kpi.costoManodopera / total) * 100).toFixed(0);
      const pctMat = ((kpi.costoMateriali / total) * 100).toFixed(0);
      document.getElementById('cd-cost-breakdown').innerHTML = `
        <div>
          <div class="flex justify-between text-sm font-bold text-gray-700 mb-1"><span>👨‍🔧 Manodopera <span class="text-gray-400 font-normal text-[10px] uppercase tracking-tight">(righe VERIFIED)</span></span><span>${pctMano}% — € ${kpi.costoManodopera.toFixed(2)}</span></div>
          <div class="h-3 w-full bg-gray-100 rounded-full overflow-hidden"><div class="h-full bg-blue-500 rounded-full transition-all duration-700" style="width:${pctMano}%"></div></div>
        </div>
        <div>
          <div class="flex justify-between text-sm font-bold text-gray-700 mb-1"><span>📦 Materiali e Fatture</span><span>${pctMat}% — € ${kpi.costoMateriali.toFixed(2)}</span></div>
          <div class="h-3 w-full bg-gray-100 rounded-full overflow-hidden"><div class="h-full bg-amber-500 rounded-full transition-all duration-700" style="width:${pctMat}%"></div></div>
        </div>
      `;
    };

    // ── GRAFICO FINANZIARIO ─────────────────────────────
    const loadFinancialChart = async (id) => {
      try {
        const res = await fetchWithAuth(`/api/cantieri/${id}/financial-timeline`);
        const data = await res.json();

        if (typeof Chart === 'undefined') {
          document.getElementById('cd-chart-kpis').innerHTML = '<div class="col-span-3 text-red-500 font-bold">Chart.js non caricato.</div>';
          return;
        }

        const ctx = document.getElementById('financial-chart').getContext('2d');
        const budgetLine = data.months.map(() => data.budget);

        if (chartInstance) {
          chartInstance.data.labels = data.months;
          chartInstance.data.datasets[0].data = data.costoReale;
          chartInstance.data.datasets[1].data = budgetLine;
          chartInstance.update();
        } else {
          chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
              labels: data.months,
              datasets: [
                {
                  label: 'Costo Reale (Cumulativo)',
                  data: data.costoReale,
                  borderColor: '#3b82f6',
                  backgroundColor: 'rgba(59, 130, 246, 0.08)',
                  fill: true,
                  tension: 0.3,
                  pointRadius: 5,
                  pointHoverRadius: 8,
                  pointBackgroundColor: data.costoReale.map(v => v > data.budget ? '#ef4444' : '#3b82f6'),
                  borderWidth: 2.5,
                },
                {
                  label: 'Budget Massimo',
                  data: budgetLine,
                  borderColor: '#ef4444',
                  borderDash: [8, 4],
                  borderWidth: 2,
                  pointRadius: 0,
                  fill: false,
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                  callbacks: {
                    label: (ctx) => `${ctx.dataset.label}: € ${ctx.parsed.y.toLocaleString('it-IT', {minimumFractionDigits:2})}`
                  }
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    callback: (v) => `€ ${(v/1000).toFixed(0)}k`
                  }
                }
              }
            }
          });
        }

        // Sub KPIs sotto il grafico
        const lastCost = data.costoReale.length > 0 ? data.costoReale[data.costoReale.length - 1] : 0;
        const remainingPct = data.budget > 0 ? (((data.budget - lastCost) / data.budget) * 100).toFixed(1) : 'N/D';
        const avgMonthly = data.costoPerMese.length > 0 ? (data.costoPerMese.reduce((a,b) => a+b, 0) / data.costoPerMese.length) : 0;
        const monthsToExhaust = avgMonthly > 0 ? Math.ceil((data.budget - lastCost) / avgMonthly) : '∞';

        document.getElementById('cd-chart-kpis').innerHTML = `
          <div class="bg-gray-50 p-4 rounded-xl border border-gray-100 text-center">
            <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Budget Residuo</div>
            <div class="text-xl font-black ${remainingPct > 25 ? 'text-green-600' : 'text-red-600'}">${remainingPct}%</div>
          </div>
          <div class="bg-gray-50 p-4 rounded-xl border border-gray-100 text-center">
            <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Media Mensile</div>
            <div class="text-xl font-black text-purple-600">€ ${avgMonthly.toFixed(0)}</div>
          </div>
          <div class="bg-gray-50 p-4 rounded-xl border border-gray-100 text-center">
            <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Mesi Rimanenti</div>
            <div class="text-xl font-black ${monthsToExhaust <= 2 ? 'text-red-600' : 'text-gray-800'}">${monthsToExhaust}</div>
          </div>
        `;
      } catch(e) { toast.error('Errore caricamento grafico.'); }
    };

    // ── STAMPA REPORT (PDF via @media print) ────────────
    document.getElementById('cd-btn-print').addEventListener('click', () => {
      // Assicurati che i pannelli visibili siano expandibili per la stampa
      // Mostra tutti i pannelli per la stampa
      panels.forEach(p => p.classList.remove('hidden'));
      setTimeout(() => {
        window.print();
        // Dopo la stampa, ripristina lo stato del tab attivo
        setTimeout(() => switchTab(activeTab), 500);
      }, 200);
    });

    // ── MODAL IMPOSTAZIONI CANTIERE ─────────────────────
    document.getElementById('cd-btn-settings').addEventListener('click', () => {
      const c = cantieriCache.find(x => x.id === currentCantiereId);
      if (!c) return;
      showModal({
        title: 'Impostazioni Cantiere',
        wide: true,
        body: `
          <div class="space-y-4">
            <div><label class="block text-sm font-semibold text-gray-700 mb-1">Nome Cantiere *</label>
            <input type="text" id="cs-nome" value="${c.nome || ''}" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition"></div>
            <div class="grid grid-cols-2 gap-4">
              <div><label class="block text-sm font-semibold text-gray-700 mb-1">Budget (€)</label>
              <input type="number" step="0.01" id="cs-budget" value="${c.budget || ''}" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition"></div>
              <div><label class="block text-sm font-semibold text-gray-700 mb-1">Raggio Tolleranza (m)</label>
              <input type="number" id="cs-raggio" value="${c.raggio_tolleranza || 300}" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition"></div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div><label class="block text-sm font-semibold text-gray-700 mb-1">Latitudine</label>
              <input type="number" step="0.000001" id="cs-lat" value="${c.lat || ''}" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition"></div>
              <div><label class="block text-sm font-semibold text-gray-700 mb-1">Longitudine</label>
              <input type="number" step="0.000001" id="cs-lng" value="${c.lng || ''}" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition"></div>
            </div>
            <div class="flex gap-3">
              <button id="cs-save" class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition">Salva Modifiche</button>
              <button id="cs-toggle" class="px-6 py-2.5 ${c.attivo ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100' : 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'} font-bold rounded-xl transition">${c.attivo ? 'Chiudi Cantiere' : 'Riapri Cantiere'}</button>
            </div>
          </div>`,
        onMount: (el) => {
          el.querySelector('#cs-save').addEventListener('click', async () => {
            const body = {
              nome: el.querySelector('#cs-nome').value,
              budget: el.querySelector('#cs-budget').value || null,
              raggio_tolleranza: el.querySelector('#cs-raggio').value || 300,
              lat: el.querySelector('#cs-lat').value || null,
              lng: el.querySelector('#cs-lng').value || null,
            };
            if (!body.nome) return toast.warn('Nome obbligatorio.');
            try {
              await fetchWithAuth(`/api/admin/cantieri/${currentCantiereId}`, { method: 'PATCH', body: JSON.stringify(body) });
              closeModal();
              toast.success('Cantiere aggiornato.');
              await loadCantieri();
              selectCantiere(currentCantiereId, null);
            } catch(e) { toast.error('Errore aggiornamento cantiere.'); }
          });
          el.querySelector('#cs-toggle').addEventListener('click', async () => {
            try {
              await fetchWithAuth(`/api/admin/cantieri/${currentCantiereId}/toggle`, { method: 'PATCH' });
              closeModal();
              toast.success('Stato cantiere aggiornato.');
              await loadCantieri();
              selectCantiere(currentCantiereId, null);
            } catch(e) { toast.error('Errore cambio stato.'); }
          });
        }
      });
    });

    // ── MODAL NUOVO CANTIERE ────────────────────────────
    document.getElementById('btn-add-cantiere').addEventListener('click', () => {
      showModal({
        title: 'Nuovo Cantiere',
        body: `
          <div class="space-y-4">
            <div><label class="block text-sm font-semibold text-gray-700 mb-1">Nome Cantiere *</label>
            <input type="text" id="nc-nome" placeholder="es. Ristrutturazione Via Roma" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition"></div>
            <div class="grid grid-cols-2 gap-4">
              <div><label class="block text-sm font-semibold text-gray-700 mb-1">Budget (€)</label>
              <input type="number" step="0.01" id="nc-budget" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition"></div>
              <div><label class="block text-sm font-semibold text-gray-700 mb-1">Raggio (m)</label>
              <input type="number" id="nc-raggio" value="300" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition"></div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div><label class="block text-sm font-semibold text-gray-700 mb-1">Lat</label>
              <input type="number" step="0.000001" id="nc-lat" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition"></div>
              <div><label class="block text-sm font-semibold text-gray-700 mb-1">Lng</label>
              <input type="number" step="0.000001" id="nc-lng" class="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition"></div>
            </div>
            <button id="nc-save" class="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition">Crea Cantiere</button>
          </div>`,
        onMount: (el) => {
          el.querySelector('#nc-save').addEventListener('click', async () => {
            const nome = el.querySelector('#nc-nome').value.trim();
            if (!nome) return toast.warn('Nome obbligatorio.');
            try {
              await fetchWithAuth('/api/admin/cantieri', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  nome,
                  budget: el.querySelector('#nc-budget').value || null,
                  lat: el.querySelector('#nc-lat').value || null,
                  lng: el.querySelector('#nc-lng').value || null,
                })
              });
              closeModal();
              toast.success('Cantiere creato.');
              await loadCantieri();
            } catch(e) { toast.error('Errore creazione cantiere.'); }
          });
        }
      });
    });

    // ── STARTUP ─────────────────────────────────────────
    if (typeof window.setSubBreadcrumb === 'function') {
        window.setSubBreadcrumb(null);
    }
    await loadCantieri();

    // Close action for mobile
    const closeBtn = document.getElementById('btn-close-cantiere');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            document.getElementById('cantiere-empty-state').classList.remove('hidden');
            document.getElementById('cantiere-detail').classList.add('hidden');
            document.getElementById('cantiere-detail').classList.remove('flex');
            document.querySelectorAll('#cantieri-list button').forEach(b => b.classList.remove('bg-blue-50', 'border-blue-200', 'shadow-sm'));
            if (typeof window.setSubBreadcrumb === 'function') window.setSubBreadcrumb(null);
        });
    }

    // Global Stats for empty state
    const populateGlobalStats = async () => {
        try {
            const res = await fetchWithAuth('/api/cantieri/status');
            const stData = await res.json();
            
            let resC = await fetchWithAuth('/api/cantieri');
            if (resC.status === 404) resC = await fetchWithAuth('/api/admin/cantieri');
            const allCantieri = await resC.json();
            
            // Unifichiamo in mappa
            const statusMap = {};
            if (Array.isArray(stData)) {
                stData.forEach(s => { statusMap[s.id] = s; });
            } else {
                Object.keys(stData).forEach(id => { statusMap[id] = stData[id]; });
            }

            let totalBudget = 0;
            let totalCost = 0;
            let counts = { green: 0, amber: 0, red: 0, gray: 0 };
            
            allCantieri.forEach(c => {
                if (!c.attivo) { counts.gray++; return; }
                const st = statusMap[c.id];
                const b = c.budget || 0;
                const cost = st ? st.costo_totale : 0;
                totalBudget += b;
                totalCost += cost;
                
                const pct = b > 0 ? (cost / b) : null;
                if (pct === null) counts.gray++;
                else if (pct < 0.75) counts.green++;
                else if (pct <= 0.90) counts.amber++;
                else counts.red++;
            });
            
            document.getElementById('cd-dash-budget').innerText = `€ ${totalBudget.toLocaleString('it-IT')}`;
            document.getElementById('cd-dash-cost').innerText = `€ ${totalCost.toLocaleString('it-IT')}`;
            document.getElementById('cd-dash-status-grid').innerHTML = `
                <div class="bg-green-50 border border-green-100 p-4 rounded-xl text-center">
                    <div class="text-xl font-black text-green-600">${counts.green}</div>
                    <div class="text-[10px] font-bold text-green-500 uppercase">Sotto Budget</div>
                </div>
                <div class="bg-amber-50 border border-amber-100 p-4 rounded-xl text-center">
                    <div class="text-xl font-black text-amber-600">${counts.amber}</div>
                    <div class="text-[10px] font-bold text-amber-500 uppercase">Attenzione</div>
                </div>
                <div class="bg-red-50 border border-red-100 p-4 rounded-xl text-center">
                    <div class="text-xl font-black text-red-600">${counts.red}</div>
                    <div class="text-[10px] font-bold text-red-500 uppercase">Sopra Soglia</div>
                </div>
            `;
        } catch(e) {}
    };
    setTimeout(populateGlobalStats, 500);
};

export default { render, mount };
