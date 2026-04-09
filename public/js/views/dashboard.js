import { fetchWithAuth } from "../utils.js";
import { toast } from "../toast.js";

const render = async () => `
  <div class="space-y-6">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-3xl font-bold text-gray-900 tracking-tight">Panoramica Operativa</h1>
    </div>

    <!-- ═══ RADAR AZIENDALE ═══ -->
    <div class="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl shadow-lg p-6 text-white print-expand">
      <h2 class="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">🔭 Radar Aziendale</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4" id="radar-grid">
        <div class="animate-pulse bg-slate-700/40 rounded-xl h-24"></div>
        <div class="animate-pulse bg-slate-700/40 rounded-xl h-24"></div>
        <div class="animate-pulse bg-slate-700/40 rounded-xl h-24"></div>
        <div class="animate-pulse bg-slate-700/40 rounded-xl h-24"></div>
      </div>
      <div id="radar-cantieri" class="mt-4 flex flex-wrap gap-2"></div>
    </div>

    <!-- ═══ FILTRI ═══ -->
    <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center no-print">
      <input type="date" id="dateFrom" title="Data inizio" class="p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
      <input type="date" id="dateTo" title="Data fine" class="p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
      <input type="text" id="searchInput" placeholder="Cerca dipendente, attività, cantiere..." class="flex-1 min-w-[250px] p-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
      
      <button id="applyFilters" class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-5 rounded-lg shadow-sm transition">
        Applica Filtri
      </button>
      <button id="resetFilters" class="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-5 rounded-lg border border-gray-200 transition">
        Reset
      </button>
      
      <label class="flex items-center gap-2 ml-2 cursor-pointer select-none">
        <input type="checkbox" id="toggleAnomalies" class="rounded text-red-600 focus:ring-red-500 w-4 h-4">
        <span class="text-sm font-bold text-red-600">🚨 Solo Anomalie</span>
      </label>

      <div class="ml-auto flex gap-3">
        <button id="downloadCsv" class="bg-green-50 text-green-700 hover:bg-green-100 font-medium py-2.5 px-4 rounded-lg border border-green-200 transition">
          📥 CSV
        </button>
      </div>
    </div>

    <!-- ═══ KPI GRID (6 card) ═══ -->
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-blue-500">
        <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Totale Ore</div>
        <div class="text-2xl font-black text-gray-800" id="kpiTotalHours">0</div>
      </div>
      <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-blue-400">
        <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Media/Giorno</div>
        <div class="text-2xl font-black text-gray-800" id="kpiAvgHours">0</div>
      </div>
      <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-green-500">
        <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Operai Attivi</div>
        <div class="text-2xl font-black text-gray-800" id="kpiActiveWorkers">0</div>
      </div>
      <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-red-500" title="Giorni con 0 ore">
        <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Giorni a 0 Ore</div>
        <div class="text-2xl font-black text-gray-800" id="kpiZeroDays">0</div>
      </div>
      <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-purple-500">
        <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Costo Stimato</div>
        <div class="text-2xl font-black text-purple-600" id="kpiEstCost">€ 0</div>
      </div>
      <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-amber-500">
        <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Anomalie</div>
        <div class="text-2xl font-black text-amber-600" id="kpiAnomalies">0</div>
      </div>
    </div>

    <!-- ═══ CHARTS ROW (3 grafici) ═══ -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-1">
        <h3 class="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Ore / Dipendente</h3>
        <div class="relative h-64 w-full"><canvas id="chartByEmployee"></canvas></div>
      </div>
      <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-1">
        <h3 class="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Ore / Cantiere</h3>
        <div class="relative h-64 w-full"><canvas id="chartByCantiere"></canvas></div>
      </div>
      <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-1">
        <h3 class="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Trend Giornaliero</h3>
        <div class="relative h-64 w-full"><canvas id="chartTimeline"></canvas></div>
      </div>
    </div>

    <!-- ═══ TABLE ═══ -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table id="reportsTable" class="w-full text-left text-sm whitespace-nowrap">
          <thead class="bg-gray-50 border-b border-gray-200 text-gray-600">
            <tr>
              <th class="px-5 py-4 font-semibold cursor-pointer select-none hover:bg-gray-100" data-sort="date">Data ↕</th>
              <th class="px-5 py-4 font-semibold cursor-pointer select-none hover:bg-gray-100" data-sort="name">Dipendente ↕</th>
              <th class="px-5 py-4 font-semibold cursor-pointer select-none hover:bg-gray-100" data-sort="hours">Ore ↕</th>
              <th class="px-5 py-4 font-semibold">Ingresso</th>
              <th class="px-5 py-4 font-semibold">P. Inizio</th>
              <th class="px-5 py-4 font-semibold">P. Fine</th>
              <th class="px-5 py-4 font-semibold">Uscita</th>
              <th class="px-5 py-4 font-semibold cursor-pointer select-none hover:bg-gray-100" data-sort="activity">Attività ↕</th>
              <th class="px-5 py-4 font-semibold cursor-pointer select-none hover:bg-gray-100" data-sort="location">Cantiere ↕</th>
              <th class="px-5 py-4 font-semibold cursor-pointer select-none hover:bg-gray-100" data-sort="issues">Problemi ↕</th>
              <th class="px-5 py-4 font-semibold">Flag</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 text-gray-700"></tbody>
        </table>
      </div>
      
      <!-- Pagination -->
      <div class="p-4 border-t border-gray-100 flex flex-wrap justify-between items-center gap-4 bg-gray-50/50 no-print">
        <div class="flex items-center gap-3">
          <span class="text-sm font-medium text-gray-500">Righe per pagina:</span>
          <select id="pageSize" class="p-1.5 border border-gray-300 rounded outline-none text-sm">
            <option value="25">25</option>
            <option value="50" selected>50</option>
            <option value="100">100</option>
          </select>
        </div>
        <div class="flex flex-col text-sm text-gray-600">
          <span id="pageInfo" class="font-medium">Mostrando 0-0 di 0 record</span>
          <span id="pageIndicator" class="font-bold text-gray-800">Pagina 0 / 0</span>
        </div>
        <div class="flex gap-2">
          <button id="firstPage" class="px-3 py-1.5 border border-gray-300 rounded bg-white hover:bg-gray-100 disabled:opacity-50 text-sm font-medium">Prima</button>
          <button id="prevPage" class="px-3 py-1.5 border border-gray-300 rounded bg-white hover:bg-gray-100 disabled:opacity-50 text-sm font-medium">Prec</button>
          <button id="nextPage" class="px-3 py-1.5 border border-gray-300 rounded bg-white hover:bg-gray-100 disabled:opacity-50 text-sm font-medium">Succ</button>
          <button id="lastPage" class="px-3 py-1.5 border border-gray-300 rounded bg-white hover:bg-gray-100 disabled:opacity-50 text-sm font-medium">Ultima</button>
        </div>
      </div>
    </div>
  </div>
`;

const mount = async () => {
  // ─── STATE ─────────────────────────────────────────
  let chartTimeline = null;
  let chartByEmployee = null;
  let chartByCantiere = null;
  let allReports = [];
  let currentSort = { col: 'date', asc: false };
  let currentPage = 1;
  let pageSize = 50;
  let filteredDataCache = [];
  let onlyAnomalies = false;

  // Restore preferences
  const allowedSortCols = new Set(["date", "name", "hours", "activity", "location", "issues"]);
  try {
    const savedSort = JSON.parse(localStorage.getItem("reportSort"));
    if (savedSort && allowedSortCols.has(savedSort.col)) currentSort = { col: savedSort.col, asc: Boolean(savedSort.asc) };
  } catch {}
  const savedPageSize = Number(localStorage.getItem("pageSize"));
  if ([25, 50, 100].includes(savedPageSize)) pageSize = savedPageSize;
  document.getElementById('pageSize').value = pageSize;

  // ─── UTILS ─────────────────────────────────────────
  const parseDate = v => v ? new Date(v.split("-").map(Number)[0], v.split("-").map(Number)[1] - 1, v.split("-").map(Number)[2]) : null;
  const formatDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const addDays = (d, days) => { const n = new Date(d); n.setDate(n.getDate() + days); return n; };
  const getDisplayDate = r => (r.report_date || r.data_utc || "").slice(0, 10);
  const isWeekend = dString => { const day = new Date(dString).getDay(); return day === 0 || day === 6; };

  const escapeHtml = (s) => {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  };

  /** Espande testata + report_entries in una riga tabella/grafico per segmento. */
  function flattenReportsForUi(reports) {
    const rows = [];
    for (const r of reports) {
      if (r.entries && r.entries.length) {
        for (const e of r.entries) {
          rows.push({
            ...r,
            _entryId: e.id,
            ore_lavorate: e.ore_lavorate,
            stato_validazione: e.stato_validazione,
            attivita_svolte: e.attivita_svolte,
            ingresso: e.ingresso ?? r.ingresso,
            pausa_inizio: e.pausa_inizio ?? r.pausa_inizio,
            pausa_fine: e.pausa_fine ?? r.pausa_fine,
            uscita: e.uscita ?? r.uscita,
            luogo_cantiere: e.luogo_cantiere ?? r.luogo_cantiere,
            problemi_riscontrati: e.problemi_riscontrati ?? r.problemi_riscontrati,
            input_method: e.fonte || r.input_method,
          });
        }
      } else {
        rows.push({ ...r });
      }
    }
    return rows;
  }

  // ─── ANOMALY DETECTION ─────────────────────────────
  function detectAnomalies(r) {
    const flags = [];
    const ore = r.ore_lavorate || 0;
    if (ore === 0) flags.push({ type: 'zero', label: '0h', color: 'bg-red-100 text-red-700' });
    if (ore > 12) flags.push({ type: 'high', label: `>${12}h`, color: 'bg-amber-100 text-amber-700' });
    const im = String(r.input_method || '').toLowerCase();
    const isTimerLike = im === 'timer' || im === 'gps' || im === 'app';
    if (r.input_method && !isTimerLike && !(r.attivita_svolte || '').trim()) {
      flags.push({ type: 'no_note', label: '📝 No nota', color: 'bg-gray-100 text-gray-600' });
    }
    const st = String(r.stato_validazione || '').toLowerCase();
    if (st === 'pending') flags.push({ type: 'pending_val', label: '⏳ Pending', color: 'bg-yellow-100 text-yellow-800' });
    return flags;
  }
  function hasAnomaly(r) { return detectAnomalies(r).length > 0; }

  // ─── RADAR AZIENDALE ───────────────────────────────
  async function loadRadar() {
    try {
      const res = await fetchWithAuth('/api/dashboard/radar');
      const data = await res.json();

      const delta = data.oreSettimana.scorsa > 0
        ? (((data.oreSettimana.corrente - data.oreSettimana.scorsa) / data.oreSettimana.scorsa) * 100).toFixed(0)
        : null;
      const deltaLabel = delta !== null ? (delta >= 0 ? `+${delta}%` : `${delta}%`) : 'N/D';
      const deltaColor = delta !== null ? (delta >= 0 ? 'text-green-400' : 'text-red-400') : 'text-slate-400';

      document.getElementById('radar-grid').innerHTML = `
        <div class="bg-slate-700/40 rounded-xl p-4 border border-slate-700">
          <div class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Cantieri Attivi</div>
          <div class="text-2xl font-black">${data.cantieri.length}</div>
        </div>
        <div class="bg-slate-700/40 rounded-xl p-4 border border-slate-700">
          <div class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Approvazioni Pending</div>
          <div class="text-2xl font-black text-yellow-400">${data.pending.reports + data.pending.spese}</div>
          <div class="text-xs text-slate-400 mt-1">${data.pending.reports} ore · ${data.pending.spese} spese</div>
        </div>
        <div class="bg-slate-700/40 rounded-xl p-4 border border-slate-700">
          <div class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Ore Settimana</div>
          <div class="text-2xl font-black">${data.oreSettimana.corrente}h</div>
          <div class="text-xs ${deltaColor} font-bold mt-1">${deltaLabel} vs sett. scorsa</div>
        </div>
        <div class="bg-slate-700/40 rounded-xl p-4 border border-slate-700">
          <div class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Operai Attivi (7gg)</div>
          <div class="text-2xl font-black">${data.operaiAttivi}</div>
        </div>
      `;

      // Semafori cantieri
      const colors = { green: 'bg-green-500', amber: 'bg-amber-500', red: 'bg-red-500', gray: 'bg-gray-500' };
      document.getElementById('radar-cantieri').innerHTML = data.cantieri.map(c => {
        const pctLabel = c.pct !== null ? `${(c.pct * 100).toFixed(0)}%` : 'N/D';
        return `<div class="flex items-center gap-2 bg-slate-700/40 px-3 py-1.5 rounded-lg border border-slate-700 text-sm">
          <span class="w-2.5 h-2.5 rounded-full ${colors[c.status]}"></span>
          <span class="font-semibold text-slate-200 truncate max-w-[120px]" title="${c.nome}">${c.nome}</span>
          <span class="text-slate-400 text-xs">${pctLabel}</span>
        </div>`;
      }).join('');
    } catch(e) {}
  }

  // ─── KPI ───────────────────────────────────────────
  function renderKPIs(hoursArray, zeroDaysCount, dates) {
    const total = hoursArray.reduce((acc, val) => acc + val, 0);
    const avg = hoursArray.length ? (total / hoursArray.length) : 0;
    document.getElementById("kpiTotalHours").innerText = total.toFixed(1);
    document.getElementById("kpiAvgHours").innerText = avg.toFixed(1);
    document.getElementById("kpiZeroDays").innerText = zeroDaysCount;

    // Operai attivi nel periodo filtrato
    const activeSet = new Set();
    allReports.forEach(r => { if ((r.ore_lavorate || 0) > 0) activeSet.add(r.employee_id); });
    document.getElementById("kpiActiveWorkers").innerText = activeSet.size;

    // Costo stimato (ore × 25€ default se tariffa non disponibile)
    const estCost = total * 25;
    document.getElementById("kpiEstCost").innerText = `€ ${estCost.toLocaleString('it-IT', {minimumFractionDigits:0})}`;

    // Anomalie count
    const anomalyCount = allReports.filter(r => hasAnomaly(r)).length;
    document.getElementById("kpiAnomalies").innerText = anomalyCount;
  }

  // ─── CHARTS ────────────────────────────────────────
  function renderCharts(dates, hours) {
    if (typeof Chart === 'undefined') return;

    // 1. Timeline chart
    const ctx1 = document.getElementById("chartTimeline").getContext("2d");
    const pointColors = dates.map((d, i) => hours[i] === 0 ? '#ef4444' : (isWeekend(d) ? '#f59e0b' : '#3b82f6'));
    if (chartTimeline) {
      chartTimeline.data.labels = dates;
      chartTimeline.data.datasets[0].data = hours;
      chartTimeline.data.datasets[0].pointBackgroundColor = pointColors;
      chartTimeline.update();
    } else {
      chartTimeline = new Chart(ctx1, {
        type: "line",
        data: {
          labels: dates,
          datasets: [{
            label: "Ore",
            data: hours,
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            fill: true, tension: 0.3,
            pointBackgroundColor: pointColors,
            pointRadius: 3, pointHoverRadius: 6
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
      });
    }

    // 2. Ore per dipendente (horizontal bar)
    const byEmployee = {};
    allReports.forEach(r => {
      const name = [r.nome, r.cognome].filter(Boolean).join(' ') || `#${r.employee_id}`;
      byEmployee[name] = (byEmployee[name] || 0) + (r.ore_lavorate || 0);
    });
    const empEntries = Object.entries(byEmployee).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const empLabels = empEntries.map(e => e[0]);
    const empData = empEntries.map(e => parseFloat(e[1].toFixed(1)));
    const barColors = ['#3b82f6','#6366f1','#8b5cf6','#a855f7','#d946ef','#ec4899','#f43f5e','#f97316','#eab308','#22c55e'];

    const ctx2 = document.getElementById("chartByEmployee").getContext("2d");
    if (chartByEmployee) { chartByEmployee.destroy(); }
    chartByEmployee = new Chart(ctx2, {
      type: "bar",
      data: {
        labels: empLabels,
        datasets: [{ label: "Ore", data: empData, backgroundColor: barColors.slice(0, empLabels.length), borderRadius: 6 }]
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true } }
      }
    });

    // 3. Ore per cantiere (doughnut)
    const byCantiere = {};
    allReports.forEach(r => {
      const loc = r.luogo_cantiere || 'Senza cantiere';
      byCantiere[loc] = (byCantiere[loc] || 0) + (r.ore_lavorate || 0);
    });
    const cantEntries = Object.entries(byCantiere).sort((a, b) => b[1] - a[1]);
    const top5 = cantEntries.slice(0, 5);
    const otherSum = cantEntries.slice(5).reduce((s, e) => s + e[1], 0);
    if (otherSum > 0) top5.push(['Altro', otherSum]);
    const cantLabels = top5.map(e => e[0]);
    const cantData = top5.map(e => parseFloat(e[1].toFixed(1)));
    const doughnutColors = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#94a3b8'];

    const ctx3 = document.getElementById("chartByCantiere").getContext("2d");
    if (chartByCantiere) { chartByCantiere.destroy(); }
    chartByCantiere = new Chart(ctx3, {
      type: "doughnut",
      data: {
        labels: cantLabels,
        datasets: [{ data: cantData, backgroundColor: doughnutColors.slice(0, cantLabels.length), borderWidth: 2, hoverOffset: 8 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } } }
      }
    });
  }

  // ─── TABLE RENDERING ───────────────────────────────
  function updateTable() {
    const search = document.getElementById("searchInput").value.toLowerCase();

    filteredDataCache = allReports.filter(r => {
      const dip = [r.nome, r.cognome].filter(Boolean).join(" ") || r.telegram_id || "";
      const rowText = `${dip} ${r.attivita_svolte||''} ${r.luogo_cantiere||''} ${r.problemi_riscontrati||''}`.toLowerCase();
      if (!rowText.includes(search)) return false;
      if (onlyAnomalies && !hasAnomaly(r)) return false;
      return true;
    });

    // Sort
    filteredDataCache.sort((a, b) => {
      let valA, valB;
      switch(currentSort.col) {
        case 'date': valA = getDisplayDate(a); valB = getDisplayDate(b); break;
        case 'name': valA = [a.nome, a.cognome].join(" "); valB = [b.nome, b.cognome].join(" "); break;
        case 'hours': valA = a.ore_lavorate || 0; valB = b.ore_lavorate || 0; break;
        case 'activity': valA = a.attivita_svolte || ""; valB = b.attivita_svolte || ""; break;
        case 'location': valA = a.luogo_cantiere || ""; valB = b.luogo_cantiere || ""; break;
        case 'issues': valA = a.problemi_riscontrati || ""; valB = b.problemi_riscontrati || ""; break;
      }
      if (valA < valB) return currentSort.asc ? -1 : 1;
      if (valA > valB) return currentSort.asc ? 1 : -1;
      return 0;
    });

    // Paginate
    const totalRows = filteredDataCache.length;
    const totalPages = Math.ceil(totalRows / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    const startIdx = (currentPage - 1) * pageSize;
    const paginatedData = filteredDataCache.slice(startIdx, startIdx + pageSize);

    const tbody = document.querySelector("#reportsTable tbody");
    tbody.innerHTML = "";
    paginatedData.forEach(r => {
      const tr = document.createElement("tr");
      const dip = [r.nome, r.cognome].filter(Boolean).join(" ") || r.telegram_id || "-";
      const flags = detectAnomalies(r);
      const flagHtml = flags.map(f => `<span class="inline-block px-1.5 py-0.5 rounded text-xs font-bold ${f.color}">${f.label}</span>`).join(' ');
      const rowBg = flags.some(f => f.type === 'zero') ? 'bg-red-50/60' : (flags.some(f => f.type === 'high') ? 'bg-amber-50/60' : '');
      tr.className = `hover:bg-gray-100 ${rowBg}`;
      tr.innerHTML = `
        <td class="px-5 py-3">${escapeHtml(getDisplayDate(r))}</td>
        <td class="px-5 py-3 font-semibold">${escapeHtml(dip)}</td>
        <td class="px-5 py-3"><span class="bg-gray-200 text-gray-800 px-2 py-1 border border-gray-300 rounded-md font-bold">${escapeHtml(r.ore_lavorate ?? "-")}</span></td>
        <td class="px-5 py-3 text-gray-500">${escapeHtml(r.ingresso ?? "-")}</td>
        <td class="px-5 py-3 text-gray-500">${escapeHtml(r.pausa_inizio ?? "-")}</td>
        <td class="px-5 py-3 text-gray-500">${escapeHtml(r.pausa_fine ?? "-")}</td>
        <td class="px-5 py-3 text-gray-500">${escapeHtml(r.uscita ?? "-")}</td>
        <td class="px-5 py-3 text-gray-600">${escapeHtml(r.attivita_svolte ?? "-")}</td>
        <td class="px-5 py-3 text-gray-600">${escapeHtml(r.luogo_cantiere ?? "-")}</td>
        <td class="px-5 py-3 text-gray-600">${escapeHtml(r.problemi_riscontrati ?? "-")}</td>
        <td class="px-5 py-3">${flagHtml || '<span class="text-green-500 font-bold text-xs">✓ OK</span>'}</td>
      `;
      tbody.appendChild(tr);
    });

    // Pagination info
    const endIdx = startIdx + pageSize;
    const showingStart = totalRows === 0 ? 0 : startIdx + 1;
    document.getElementById("pageInfo").innerText = `Mostrando ${showingStart}-${Math.min(endIdx, totalRows)} di ${totalRows} record`;
    document.getElementById("pageIndicator").innerText = `Pagina ${totalRows === 0 ? 0 : currentPage} / ${totalPages}`;
    document.getElementById("prevPage").disabled = currentPage === 1;
    document.getElementById("nextPage").disabled = currentPage === totalPages || totalRows === 0;
    document.getElementById("firstPage").disabled = currentPage === 1;
    document.getElementById("lastPage").disabled = currentPage === totalPages || totalRows === 0;
  }

  // ─── DATA FETCHING ─────────────────────────────────
  async function load() {
    const start = document.getElementById("dateFrom").value;
    const end = document.getElementById("dateTo").value;
    const params = new URLSearchParams();
    if (start) params.set("start", start);
    if (end) params.set("end", end);

    try {
      allReports = await fetchWithAuth(`/api/reports${params.toString() ? '?' + params.toString() : ''}`).then(r => r.json());
    } catch (err) {
      console.error(err);
      return;
    }
    currentPage = 1;
    updateTable();

    // Chart timeline processing
    const byDate = {};
    allReports.forEach(r => {
      const d = getDisplayDate(r);
      if (!d) return;
      byDate[d] = (byDate[d] || 0) + (r.ore_lavorate || 0);
    });

    let startDate = parseDate(start);
    let endDate = parseDate(end);
    if (!startDate && !endDate) {
      const reportDates = Object.keys(byDate).sort();
      endDate = reportDates.length ? parseDate(reportDates[reportDates.length - 1]) : new Date();
      startDate = addDays(endDate, -13);
    } else if (!startDate) { startDate = addDays(endDate, -13); }
      else if (!endDate) { endDate = addDays(startDate, 13); }
    if (startDate > endDate) [startDate, endDate] = [endDate, startDate];

    const dates = [];
    let cursor = new Date(startDate);
    while (cursor <= endDate) {
      dates.push(formatDate(cursor));
      cursor = addDays(cursor, 1);
    }
    const hours = dates.map(d => byDate[d] || 0);
    const zeroDaysCount = hours.filter(h => h === 0).length;

    renderKPIs(hours, zeroDaysCount, dates);
    renderCharts(dates, hours);
  }

  // ─── EVENT LISTENERS ───────────────────────────────
  document.getElementById("applyFilters").addEventListener("click", load);
  document.getElementById("resetFilters").addEventListener("click", () => {
    document.getElementById("dateFrom").value = "";
    document.getElementById("dateTo").value = "";
    document.getElementById("searchInput").value = "";
    document.getElementById("toggleAnomalies").checked = false;
    onlyAnomalies = false;
    load();
  });
  document.getElementById("searchInput").addEventListener("input", () => { currentPage = 1; updateTable(); });
  document.getElementById("toggleAnomalies").addEventListener("change", (e) => {
    onlyAnomalies = e.target.checked;
    currentPage = 1;
    updateTable();
  });

  document.querySelectorAll("th[data-sort]").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.dataset.sort;
      if (currentSort.col === col) currentSort.asc = !currentSort.asc;
      else { currentSort.col = col; currentSort.asc = true; }
      localStorage.setItem("reportSort", JSON.stringify(currentSort));
      updateTable();
    });
  });

  document.getElementById("pageSize").addEventListener("change", (e) => {
    pageSize = Number(e.target.value);
    localStorage.setItem("pageSize", pageSize);
    currentPage = 1;
    updateTable();
  });

  document.getElementById("firstPage").addEventListener("click", () => { currentPage = 1; updateTable(); });
  document.getElementById("prevPage").addEventListener("click", () => { if(currentPage > 1) { currentPage--; updateTable(); }});
  document.getElementById("nextPage").addEventListener("click", () => { currentPage++; updateTable(); });
  document.getElementById("lastPage").addEventListener("click", () => {
    const totalPages = Math.ceil(filteredDataCache.length / pageSize) || 1;
    currentPage = totalPages;
    updateTable();
  });

  document.getElementById("downloadCsv").addEventListener("click", () => {
    if (filteredDataCache.length === 0) return toast.warn("Nessun dato da esportare");
    const header = "Data,Dipendente,OreLavorate,Ingresso,P.Inizio,P.Fine,Uscita,Attività,LuogoCantiere,Problemi,Anomalie\n";
    const csvLines = filteredDataCache.map(r => {
      const dip = [r.nome, r.cognome].filter(Boolean).join(" ");
      const quote = (str) => `"${(str || '').replace(/"/g, '""')}"`;
      const flags = detectAnomalies(r).map(f => f.label).join('; ');
      return [
        quote(getDisplayDate(r)), quote(dip), r.ore_lavorate || 0,
        quote(r.ingresso), quote(r.pausa_inizio), quote(r.pausa_fine), quote(r.uscita),
        quote(r.attivita_svolte), quote(r.luogo_cantiere), quote(r.problemi_riscontrati), quote(flags)
      ].join(",");
    });
    const blob = new Blob([header + csvLines.join("\n")], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `export_${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  });

  // ─── INITIAL BOOT ──────────────────────────────────
  await Promise.all([load(), loadRadar()]);
};

export default { render, mount };
