import { describe, it, expect } from 'vitest';
import { buildWbsTree } from '../../src/domain/cantiere/wbsService.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeNode(id, parentId, budget = null) {
    return { id, nome: `Nodo ${id}`, budget_preventivato: budget, parent_id: parentId, is_variant: false };
}

function makeBurn(ore = 0, manodopera = 0, materiali = 0) {
    return { ore_tot: ore, costo_manodopera: manodopera, costo_materiali: materiali, totale: manodopera + materiali };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('wbsService.buildWbsTree', () => {
    it('costruisce un albero piatto con un solo nodo radice', () => {
        const nodes   = [makeNode(1, null, 10000)];
        const burnMap = { 1: makeBurn(8, 500, 200) };

        const tree = buildWbsTree(nodes, burnMap);

        expect(tree).toHaveLength(1);
        expect(tree[0].id).toBe(1);
        expect(tree[0].children).toHaveLength(0);
        expect(tree[0].burn.totale).toBe(700);
    });

    it('annida i figli sotto il nodo genitore corretto', () => {
        const nodes = [
            makeNode(1, null),
            makeNode(2, 1),
            makeNode(3, 1),
        ];
        const tree = buildWbsTree(nodes, {});

        expect(tree).toHaveLength(1);
        expect(tree[0].children).toHaveLength(2);
        expect(tree[0].children.map(c => c.id).sort()).toEqual([2, 3]);
    });

    it('esegue il rollup bottom-up dei costi (burn aggregato sul genitore)', () => {
        // root (id=1) ha due figli (id=2, id=3) con burn propri
        const nodes = [
            makeNode(1, null, 5000),
            makeNode(2, 1),
            makeNode(3, 1),
        ];
        const burnMap = {
            1: makeBurn(0, 0, 0),       // root ha burn diretto zero
            2: makeBurn(4, 300, 100),   // figlio A: totale 400
            3: makeBurn(6, 500, 50),    // figlio B: totale 550
        };

        const tree = buildWbsTree(nodes, burnMap);
        const root = tree[0];

        // Root deve aggregare i figli: ore=10, manodopera=800, materiali=150, totale=950
        expect(root.burn.ore_tot).toBe(10);
        expect(root.burn.costo_manodopera).toBe(800);
        expect(root.burn.costo_materiali).toBe(150);
        expect(root.burn.totale).toBe(950);
    });

    it('calcola avanzamento_pct rispetto al budget del nodo', () => {
        const nodes   = [makeNode(1, null, 1000)];
        const burnMap = { 1: makeBurn(0, 600, 0) };

        const tree = buildWbsTree(nodes, burnMap);

        expect(tree[0].avanzamento_pct).toBe(60);
    });

    it('capisce avanzamento_pct = null se budget non definito', () => {
        const nodes   = [makeNode(1, null, null)]; // nessun budget
        const burnMap = { 1: makeBurn(0, 300, 0) };

        const tree = buildWbsTree(nodes, burnMap);

        expect(tree[0].avanzamento_pct).toBeNull();
    });

    it('cap avanzamento_pct a 100 se il burn supera il budget', () => {
        const nodes   = [makeNode(1, null, 500)];
        const burnMap = { 1: makeBurn(0, 999, 0) }; // burn > budget

        const tree = buildWbsTree(nodes, burnMap);

        expect(tree[0].avanzamento_pct).toBe(100);
    });

    it('gestisce un nodo orfano (parent_id punta a nodo inesistente) come radice', () => {
        const nodes = [makeNode(99, 50)]; // parent_id=50 non esiste nell'albero
        const tree  = buildWbsTree(nodes, {});

        expect(tree).toHaveLength(1);
        expect(tree[0].id).toBe(99);
    });

    it('gestisce albero vuoto senza errori', () => {
        expect(buildWbsTree([], {})).toEqual([]);
    });
});
