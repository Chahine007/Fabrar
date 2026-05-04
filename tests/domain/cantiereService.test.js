import { describe, it, expect } from 'vitest';
import { computeFinancialTimeline, computeFinancialKpis } from '../../src/domain/cantiere/cantiereService.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEntry({ employeeId = 1, ore = 8, costo_orario = 25, report_date = '2024-03-15', nome = 'Mario', cognome = 'Rossi' } = {}) {
    return {
        ore_lavorate: ore,
        report: {
            employee_id: employeeId,
            report_date:  new Date(report_date),
            employee: {
                nome, cognome,
                tariffe: [{ costo_orario }],
            },
        },
    };
}

function makeSpesa({ importo = 100, timestamp = '2024-03-20', stato = 'PENDING' } = {}) {
    return {
        importo,
        timestamp_utc:     new Date(timestamp),
        stato_validazione: stato,
    };
}

function makeDataset(overrides = {}) {
    return {
        cantiere:       { id: 1, nome: 'Test Cantiere', budget: 10000 },
        verifiedEntries: [],
        activeSpese:    [],
        ...overrides,
    };
}

// ─── computeFinancialTimeline ─────────────────────────────────────────────────

describe('cantiereService.computeFinancialTimeline', () => {
    it('restituisce array vuoti se non ci sono dati', () => {
        const result = computeFinancialTimeline(makeDataset());
        expect(result.months).toEqual([]);
        expect(result.costoReale).toEqual([]);
        expect(result.costoPerMese).toEqual([]);
    });

    it('aggrega correttamente costo manodopera per mese', () => {
        const dataset = makeDataset({
            verifiedEntries: [
                makeEntry({ ore: 8,  costo_orario: 25, report_date: '2024-03-10' }),  // 200€
                makeEntry({ ore: 4,  costo_orario: 25, report_date: '2024-03-20' }),  // 100€
                makeEntry({ ore: 10, costo_orario: 25, report_date: '2024-04-05' }),  // 250€
            ],
        });

        const { months, costoPerMese, costoReale } = computeFinancialTimeline(dataset);

        expect(months).toEqual(['2024-03', '2024-04']);
        expect(costoPerMese[0]).toBe(300);  // marzo
        expect(costoPerMese[1]).toBe(250);  // aprile
        expect(costoReale[0]).toBe(300);    // cumulativo marzo
        expect(costoReale[1]).toBe(550);    // cumulativo aprile
    });

    it('somma manodopera e materiali nello stesso mese', () => {
        const dataset = makeDataset({
            verifiedEntries: [makeEntry({ ore: 8, costo_orario: 25, report_date: '2024-06-01' })],  // 200€
            activeSpese:     [makeSpesa({ importo: 300, timestamp: '2024-06-15' })],                 // 300€
        });

        const { months, costoPerMese } = computeFinancialTimeline(dataset);

        expect(months).toEqual(['2024-06']);
        expect(costoPerMese[0]).toBe(500);
    });

    it('ordina i mesi cronologicamente', () => {
        const dataset = makeDataset({
            activeSpese: [
                makeSpesa({ importo: 100, timestamp: '2024-05-01' }),
                makeSpesa({ importo: 200, timestamp: '2024-03-01' }),
                makeSpesa({ importo: 150, timestamp: '2024-04-01' }),
            ],
        });

        const { months } = computeFinancialTimeline(dataset);
        expect(months).toEqual(['2024-03', '2024-04', '2024-05']);
    });
});

// ─── computeFinancialKpis ─────────────────────────────────────────────────────

describe('cantiereService.computeFinancialKpis', () => {
    it('restituisce KPI a zero con dataset vuoto', () => {
        const { kpi } = computeFinancialKpis(makeDataset());

        expect(kpi.costoTotale).toBe(0);
        expect(kpi.costoManodopera).toBe(0);
        expect(kpi.costoMateriali).toBe(0);
        expect(kpi.margine).toBe(10000); // budget - 0
    });

    it('calcola correttamente costo manodopera da ore × tariffa', () => {
        const dataset = makeDataset({
            verifiedEntries: [makeEntry({ ore: 8, costo_orario: 25 })], // 200€
        });

        const { kpi } = computeFinancialKpis(dataset);

        expect(kpi.costoManodopera).toBe(200);
        expect(kpi.costoMateriali).toBe(0);
        expect(kpi.costoTotale).toBe(200);
        expect(kpi.margine).toBe(9800);
    });

    it('calcola correttamente costo materiali dalla somma delle spese', () => {
        const dataset = makeDataset({
            activeSpese: [
                makeSpesa({ importo: 150 }),
                makeSpesa({ importo: 350 }),
            ],
        });

        const { kpi } = computeFinancialKpis(dataset);

        expect(kpi.costoMateriali).toBe(500);
        expect(kpi.costoManodopera).toBe(0);
        expect(kpi.costoTotale).toBe(500);
    });

    it('aggrega correttamente ore e costo per dipendente', () => {
        const dataset = makeDataset({
            verifiedEntries: [
                makeEntry({ employeeId: 1, ore: 8, costo_orario: 25, nome: 'Mario', cognome: 'Rossi',  report_date: '2024-03-01' }),
                makeEntry({ employeeId: 1, ore: 4, costo_orario: 25, nome: 'Mario', cognome: 'Rossi',  report_date: '2024-03-05' }),
                makeEntry({ employeeId: 2, ore: 6, costo_orario: 30, nome: 'Luigi', cognome: 'Verdi',  report_date: '2024-03-02' }),
            ],
        });

        const { perDipendente } = computeFinancialKpis(dataset);

        expect(perDipendente).toHaveLength(2);

        const mario = perDipendente.find(d => d.nome === 'Mario');
        expect(mario.ore_tot).toBe(12);
        expect(mario.costo_calcolato).toBe(300); // 12 × 25

        const luigi = perDipendente.find(d => d.nome === 'Luigi');
        expect(luigi.ore_tot).toBe(6);
        expect(luigi.costo_calcolato).toBe(180); // 6 × 30
    });

    it('ordina perDipendente per ore decrescenti', () => {
        const dataset = makeDataset({
            verifiedEntries: [
                makeEntry({ employeeId: 1, ore: 2,  costo_orario: 25, nome: 'A' }),
                makeEntry({ employeeId: 2, ore: 10, costo_orario: 25, nome: 'B' }),
            ],
        });

        const { perDipendente } = computeFinancialKpis(dataset);

        expect(perDipendente[0].nome).toBe('B'); // più ore → primo
        expect(perDipendente[1].nome).toBe('A');
    });
});
