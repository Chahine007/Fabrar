import { fetchWithAuth } from "../utils.js";

const render = async () => `
  <div class="space-y-6">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-3xl font-bold text-gray-900 tracking-tight">Sincronizzazione Genya</h1>
    </div>

    <!-- Session Restore Banner -->
    <div id="sessionBanner" class="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-xl shadow-sm hidden">
        <div class="flex justify-between items-center flex-wrap gap-4">
            <div>
                <h3 class="text-blue-800 font-bold">Sessione in Sospeso</h3>
                <p class="text-blue-700 text-sm mt-1">Hai <span id="sessionCount" class="font-bold">0</span> fatture in attesa di assegnazione dalla sessione precedente.</p>
            </div>
            <button id="clearSessionBtn" class="bg-white text-blue-600 hover:bg-blue-100 border border-blue-200 font-semibold py-1.5 px-4 rounded-lg text-sm transition-colors shadow-sm">
                Svuota e carica nuovo file
            </button>
        </div>
    </div>

    <!-- Upload Card -->
    <div id="uploadCard" class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h2 class="text-lg font-semibold mb-4 text-gray-700">1. Seleziona il file CSV</h2>
        <p class="text-sm text-gray-500 mb-4">Solo file esportati da Genya. Le prime 3 righe verranno automaticamente scartate. Le righe saranno raggruppate per Numero, Data e Fornitore/Cliente.</p>
        <div class="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center bg-gray-50/50 hover:bg-gray-50 transition-colors cursor-pointer relative">
            <input type="file" id="csvFileInput" accept=".csv" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
            <span class="text-4xl mb-3">📥</span>
            <span class="text-blue-600 font-medium text-lg">Clicca o trascina qui il file CSV...</span>
        </div>
    </div>

    <!-- Invoices List -->
    <div id="invoicesContainer" class="hidden">
        <div class="flex justify-between items-center mb-4 flex-wrap gap-2">
            <h2 class="text-lg font-semibold text-gray-700">2. Riconcilia e Dividi</h2>
            <div class="text-sm text-gray-600 bg-blue-50 px-3 py-1 rounded-full font-medium"><span id="totalInvoices">0</span> Fatture in Coda</div>
        </div>
        
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden pb-20">
            <div class="overflow-x-auto">
                <table class="w-full text-left text-sm whitespace-nowrap">
                    <thead class="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th class="px-5 py-4 font-semibold text-gray-600">Data</th>
                            <th class="px-5 py-4 font-semibold text-gray-600">Fornitore / Descrizione</th>
                            <th class="px-5 py-4 font-semibold text-gray-600 text-right">Importo Tot.</th>
                            <th class="px-5 py-4 font-semibold text-gray-600">Destinazione Cantiere</th>
                            <th class="px-5 py-4 font-semibold text-gray-600 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody id="invoicesTableBody" class="divide-y divide-gray-100 text-gray-700">
                        <!-- Rows via JS -->
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Sticky Footer for Save -->
        <div class="fixed bottom-0 left-64 right-0 bg-white p-5 border-t border-gray-200 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] flex justify-between items-center z-10 px-8">
            <div>
                <p class="font-bold text-gray-900">Salvataggio Massivo</p>
                <p id="validationMsg" class="text-sm text-gray-500 font-medium">Le fatture incomplete verranno escluse.</p>
            </div>
            <button id="saveBtn" disabled class="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-8 rounded-xl shadow-sm transition-colors text-lg">
                Salva Assegnazioni
            </button>
        </div>
    </div>
  </div>
`;

const mount = async () => {
    // 1. Dinamicamente inietta PapaParse se manca nell'HTML
    if (typeof Papa === 'undefined') {
        await new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js";
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    let cantieri = [];
    let importedInvoices = [];
    let cantieriOptionsHTML = '<option value="">-- Seleziona Cantiere --</option>';

    // --- UTILS & STORAGE ---
    const saveProgressToStorage = () => {
        if (importedInvoices.length > 0) {
            localStorage.setItem('pending_genya_invoices', JSON.stringify(importedInvoices));
        } else {
            localStorage.removeItem('pending_genya_invoices');
        }
    };

    const clearSession = () => {
        if(confirm("Svuotare la sessione in corso? Perderai il lavoro non salvato.")) {
            localStorage.removeItem('pending_genya_invoices');
            importedInvoices = [];
            document.getElementById('invoicesContainer').classList.add('hidden');
            document.getElementById('sessionBanner').classList.add('hidden');
            document.getElementById('uploadCard').classList.remove('hidden');
            document.getElementById('csvFileInput').value = '';
        }
    };
    document.getElementById("clearSessionBtn")?.addEventListener("click", clearSession);

    const parseGenyaNumber = (str) => {
        if (!str) return 0;
        if (typeof str === 'number') return str;
        let cleaned = str.replace(/,/g, '');
        return parseFloat(cleaned) || 0;
    };

    const autoMatchCantiere = (providerName) => {
        if (!providerName) return "";
        const lower = providerName.toLowerCase();
        if (lower.includes('enel') || lower.includes('tim')) {
            const matched = cantieri.find(c => 
                c.nome.toLowerCase().includes('spese generali') || 
                c.nome.toLowerCase().includes('magazzino') ||
                c.nome.toLowerCase().includes('ufficio')
            );
            return matched ? matched.id : "";
        }
        return "";
    };

    // --- INITIAL FETCH ---
    try {
        const res = await fetchWithAuth("/api/admin/cantieri");
        cantieri = await res.json();
        
        cantieriOptionsHTML = '<option value="">-- Seleziona Cantiere --</option>' + 
            cantieri.filter(c => c.attivo).map(c => `<option value="${c.id}">${c.nome}</option>`).join("");

        const saved = localStorage.getItem('pending_genya_invoices');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed && parsed.length > 0) {
                    importedInvoices = parsed;
                    document.getElementById('uploadCard').classList.add('hidden');
                    document.getElementById('sessionBanner').classList.remove('hidden');
                    document.getElementById('sessionCount').innerText = importedInvoices.length;
                    document.getElementById('invoicesContainer').classList.remove('hidden');
                    document.getElementById('totalInvoices').innerText = importedInvoices.length;
                    renderTable();
                }
            } catch(e){}
        }
    } catch (err) {
        console.error("Failed to load cantieri", err);
    }

    // --- CSV PARSING ---
    document.getElementById('csvFileInput')?.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(evt) {
            const text = evt.target.result;
            const lines = text.split('\n');
            if (lines.length <= 3) return alert("File troppo corto o formato non valido");
            const cleanText = lines.slice(3).join('\n');

            Papa.parse(cleanText, {
                header: true,
                skipEmptyLines: true,
                complete: function(results) {
                    processGenyaData(results.data);
                }
            });
        };
        reader.readAsText(file);
    });

    const processGenyaData = (rawData) => {
        const groups = {};
        rawData.forEach(row => {
            const num = row['Numero'] || row['Numero doc.'] || row['Documento'] || '';
            const data = row['Data'] || row['Data doc.'] || '';
            const fornitore = row['Fornitore'] || row['Cliente'] || row['Ragione Sociale'] || 'Sconosciuto';
            const imponibileStr = row['Imponibile'] || row['Imponibile (val)'] || row['Totale'] || '0';
            
            const groupKey = `${num}_${data}_${fornitore}`;
            
            if (!groups[groupKey]) {
                groups[groupKey] = {
                    id: crypto.randomUUID(),
                    data_fattura: data,
                    fornitore: fornitore,
                    fattura_rif: num ? `Fatt. ${num}` : `Fatt. Generica`,
                    importo_totale: 0,
                    is_divided: false,
                    splits: []
                };
            }
            groups[groupKey].importo_totale += parseGenyaNumber(imponibileStr);
        });

        importedInvoices = Object.values(groups).map(inv => {
            inv.importo_totale = Math.round(inv.importo_totale * 100) / 100;
            inv.splits.push({ sub_id: crypto.randomUUID(), importo: inv.importo_totale, cantiere_id: autoMatchCantiere(inv.fornitore) });
            return inv;
        }).filter(i => i.importo_totale > 0);
        
        saveProgressToStorage();

        document.getElementById('invoicesContainer').classList.remove('hidden');
        document.getElementById('uploadCard').classList.add('hidden');
        document.getElementById('sessionBanner').classList.remove('hidden');
        document.getElementById('sessionCount').innerText = importedInvoices.length;
        document.getElementById('totalInvoices').innerText = importedInvoices.length;
        
        renderTable();
    };

    // --- TABLE RENDER ---
    const renderTable = () => {
        const tbody = document.getElementById('invoicesTableBody');
        tbody.innerHTML = '';
        let validInvoicesCount = 0;

        // Attacing methods to window temporary for HTML inline events
        // In a real SPA we would use shadow DOM or attach event listeners via querySelector
        window.tempGenyaState = {
            toggleDivide: (invoiceId) => {
                const inv = importedInvoices.find(i => i.id === invoiceId);
                if (!inv) return;
                inv.is_divided = !inv.is_divided;
                if (inv.is_divided) {
                    if (inv.splits.length === 1) inv.splits.push({ sub_id: crypto.randomUUID(), importo: 0, cantiere_id: "" });
                } else {
                    inv.splits = [{ sub_id: crypto.randomUUID(), importo: inv.importo_totale, cantiere_id: inv.splits[0].cantiere_id }];
                }
                saveProgressToStorage(); renderTable();
            },
            updateSplit: (invoiceId, subId, field, value) => {
                const inv = importedInvoices.find(i => i.id === invoiceId);
                const sp = inv?.splits.find(s => s.sub_id === subId);
                if (sp) {
                    if (field === 'importo') sp.importo = parseFloat(value) || 0;
                    if (field === 'cantiere_id') sp.cantiere_id = value;
                    saveProgressToStorage(); renderTable();
                }
            },
            addSplit: (invoiceId) => {
                const inv = importedInvoices.find(i => i.id === invoiceId);
                if (!inv) return;
                const currentSum = Math.round(inv.splits.reduce((acc, s) => acc + (parseFloat(s.importo)||0), 0) * 100) / 100;
                let diff = Math.round((inv.importo_totale - currentSum) * 100)/100;
                inv.splits.push({ sub_id: crypto.randomUUID(), importo: diff < 0 ? 0 : diff, cantiere_id: "" });
                saveProgressToStorage(); renderTable();
            },
            removeSplit: (invoiceId, subId) => {
                const inv = importedInvoices.find(i => i.id === invoiceId);
                if (!inv) return;
                inv.splits = inv.splits.filter(s => s.sub_id !== subId);
                if (inv.splits.length === 0) inv.splits.push({ sub_id: crypto.randomUUID(), importo: inv.importo_totale, cantiere_id: "" });
                saveProgressToStorage(); renderTable();
            },
            deleteInvoice: (invoiceId) => {
                importedInvoices = importedInvoices.filter(i => i.id !== invoiceId);
                if (importedInvoices.length === 0) {
                    document.getElementById('invoicesContainer').classList.add('hidden');
                    document.getElementById('sessionBanner').classList.add('hidden');
                    document.getElementById('uploadCard').classList.remove('hidden');
                    document.getElementById('csvFileInput').value = '';
                } else {
                    document.getElementById('totalInvoices').innerText = importedInvoices.length;
                    document.getElementById('sessionCount').innerText = importedInvoices.length;
                }
                saveProgressToStorage(); renderTable();
            }
        };

        importedInvoices.forEach(inv => {
            const tr = document.createElement('tr');
            const sumSplits = Math.round(inv.splits.reduce((acc, sp) => acc + (parseFloat(sp.importo)||0), 0) * 100) / 100;
            const isEq = sumSplits === inv.importo_totale;
            const allHasCantiere = inv.splits.every(sp => !!sp.cantiere_id);
            const rigaValida = isEq && allHasCantiere;

            tr.className = rigaValida ? 'hover:bg-gray-50' : 'bg-red-50/40';

            let splitsHTML = '';
            if (!inv.is_divided) {
                const sp = inv.splits[0];
                splitsHTML = `
                    <select onchange="window.tempGenyaState.updateSplit('${inv.id}', '${sp.sub_id}', 'cantiere_id', this.value)" class="w-full text-sm p-2 border ${!sp.cantiere_id ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200'} rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
                        ${cantieriOptionsHTML.replace(`value="${sp.cantiere_id}"`, `value="${sp.cantiere_id}" selected`)}
                    </select>
                `;
            } else {
                splitsHTML = `
                    <div class="flex flex-col gap-2 p-3 bg-white border border-gray-100 shadow-sm rounded-lg">
                        ${inv.splits.map((sp) => `
                            <div class="flex items-center gap-2">
                                <input type="number" step="0.01" value="${sp.importo}" oninput="window.tempGenyaState.updateSplit('${inv.id}', '${sp.sub_id}', 'importo', this.value)" class="w-24 text-sm p-2 border rounded-lg focus:ring-2 outline-none ${Math.round(sumSplits*100)!==Math.round(inv.importo_totale*100) ? 'border-red-400': 'border-gray-200'}">
                                <span class="text-sm font-medium text-gray-500">€</span>
                                <select onchange="window.tempGenyaState.updateSplit('${inv.id}', '${sp.sub_id}', 'cantiere_id', this.value)" class="flex-1 text-sm p-2 border ${!sp.cantiere_id ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200'} rounded-lg outline-none focus:ring-2">
                                    ${cantieriOptionsHTML.replace(`value="${sp.cantiere_id}"`, `value="${sp.cantiere_id}" selected`)}
                                </select>
                                <button onclick="window.tempGenyaState.removeSplit('${inv.id}', '${sp.sub_id}')" class="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
                            </div>
                        `).join('')}
                        <div class="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                            <span class="text-xs font-bold ${isEq ? 'text-green-600' : 'text-red-500'}">Parziali: €${sumSplits} / €${inv.importo_totale}</span>
                            <button onclick="window.tempGenyaState.addSplit('${inv.id}')" class="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition">+ Quota</button>
                        </div>
                    </div>
                `;
            }

            const actionBtn = !inv.is_divided 
                ? `<button onclick="window.tempGenyaState.toggleDivide('${inv.id}')" class="text-sm font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded transition shadow-sm">✂️ Dividi</button>`
                : `<button onclick="window.tempGenyaState.toggleDivide('${inv.id}')" class="text-sm font-semibold text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded transition shadow-sm">Annulla</button>`;

            tr.innerHTML = `
                <td class="px-5 py-4 align-top font-medium tracking-tight whitespace-nowrap">${inv.data_fattura}</td>
                <td class="px-5 py-4 align-top">
                    <div class="font-bold text-gray-800 text-base">${inv.fornitore}</div>
                    <div class="text-sm text-gray-500 mt-0.5">${inv.fattura_rif}</div>
                </td>
                <td class="px-5 py-4 align-top text-right font-bold text-gray-900 text-base">
                    € ${inv.importo_totale.toFixed(2)}
                </td>
                <td class="px-5 py-4 align-top min-w-[300px]">
                    ${splitsHTML}
                </td>
                <td class="px-5 py-4 align-top text-right whitespace-nowrap">
                    ${actionBtn}
                    <button onclick="window.tempGenyaState.deleteInvoice('${inv.id}')" class="ml-2 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded transition shadow-sm" title="Rimuovi"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
                </td>
            `;
            if (rigaValida) validInvoicesCount++;
            tbody.appendChild(tr);
        });

        const btn = document.getElementById('saveBtn');
        const msg = document.getElementById('validationMsg');
        
        if (importedInvoices.length === 0) {
            btn.disabled = true; msg.innerText = "Nessuna fattura presente."; msg.className = "text-sm text-gray-500";
        } else if (validInvoicesCount === 0) {
            btn.disabled = true; msg.innerText = "Attenzione: Nessuna fattura è interamente coperta e verificata."; msg.className = "text-sm text-red-500 font-bold";
        } else {
            btn.disabled = false; msg.innerText = `${validInvoicesCount} su ${importedInvoices.length} collaudate e pronte per il salvataggio.`;
            msg.className = validInvoicesCount === importedInvoices.length ? "text-sm text-green-600 font-bold" : "text-sm text-yellow-600 font-bold";
        }
    };

    // --- SUBMISSION ---
    document.getElementById('saveBtn')?.addEventListener('click', async () => {
        const btn = document.getElementById('saveBtn');
        btn.innerHTML = '<span class="animate-pulse">Salvataggio...</span>';
        btn.disabled = true;

        const payload = { spese_bulk: [] };
        const validInvoicesIds = new Set();
        
        importedInvoices.forEach(inv => {
            const sumSplits = Math.round(inv.splits.reduce((acc, sp) => acc + (parseFloat(sp.importo)||0), 0) * 100) / 100;
            if (sumSplits === inv.importo_totale && inv.splits.every(sp => !!sp.cantiere_id)) {
                validInvoicesIds.add(inv.id);
                inv.splits.forEach(sp => {
                    payload.spese_bulk.push({
                        timestamp_utc: inv.data_fattura,
                        cantiere_id: parseInt(sp.cantiere_id),
                        importo: parseFloat(sp.importo),
                        fornitore: inv.fornitore,
                        descrizione: inv.is_divided ? `${inv.fattura_rif} (Quota partizionata)` : `Fornitura - ${inv.fattura_rif}`,
                        fattura_rif: inv.fattura_rif,
                        fonte: "GENYA"
                    });
                });
            }
        });

        try {
            const res = await fetchWithAuth('/api/admin/spese/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            
            importedInvoices = importedInvoices.filter(inv => !validInvoicesIds.has(inv.id));
            saveProgressToStorage();

            const toast = document.createElement('div');
            toast.className = 'fixed top-6 right-6 bg-green-500 text-white font-bold py-4 px-6 rounded-xl shadow-2xl z-50 transition-opacity duration-300';
            toast.innerText = `✅ Salvate ${data.salvate || payload.spese_bulk.length} spese nel database.\n${importedInvoices.length > 0 ? importedInvoices.length + ' fatture rimaste.' : ''}`;
            document.body.appendChild(toast);
            setTimeout(() => { toast.classList.add('opacity-0'); setTimeout(()=>toast.remove(), 300); }, 4000);
            
            if (importedInvoices.length === 0) {
                document.getElementById('invoicesContainer').classList.add('hidden');
                document.getElementById('sessionBanner').classList.add('hidden');
                document.getElementById('uploadCard').classList.remove('hidden');
                document.getElementById('csvFileInput').value = '';
            } else {
                document.getElementById('totalInvoices').innerText = importedInvoices.length;
                document.getElementById('sessionCount').innerText = importedInvoices.length;
                renderTable();
            }
            btn.innerHTML = 'Salva Assegnazioni';
            
        } catch (err) {
            alert(`Errore Server: ${err.message}`);
            btn.innerHTML = 'Salva Assegnazioni (Riprova)';
            btn.disabled = false;
        }
    });

};

export default { render, mount };
