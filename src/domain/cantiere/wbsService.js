/**
 * wbsService — regole di business per la Work Breakdown Structure.
 *
 * Estratto da cantieri.controller.js (getWbsTree, createWbsNode).
 */
import { DomainError } from '../shared/DomainError.js';

// ─── Tree Building ────────────────────────────────────────────────────────────

/**
 * Costruisce l'albero WBS con rollup bottom-up dei costi (burn).
 * @param {Array}  nodes   - lista piatta di WbsNode dal DB
 * @param {object} burnMap - { [nodeId]: { ore_tot, costo_manodopera, costo_materiali, totale } }
 * @returns {Array} nodi radice con children annidati e burn aggregato
 */
export function buildWbsTree(nodes, burnMap) {
    const nodeMap = new Map();

    for (const n of nodes) {
        const budget = n.budget_preventivato != null ? Number(n.budget_preventivato) : null;
        const burn   = burnMap[n.id] ?? { ore_tot: 0, costo_manodopera: 0, costo_materiali: 0, totale: 0 };
        const avanzamento_pct = (budget && budget > 0)
            ? Math.min(100, Math.round((burn.totale / budget) * 1000) / 10)
            : null;

        nodeMap.set(n.id, {
            id: n.id, nome: n.nome,
            budget_preventivato: budget,
            parent_id:  n.parent_id,
            is_variant: n.is_variant,
            burn, avanzamento_pct,
            children: [],
        });
    }

    const roots = [];
    for (const node of nodeMap.values()) {
        if (node.parent_id === null) {
            roots.push(node);
        } else {
            const parent = nodeMap.get(node.parent_id);
            if (parent) parent.children.push(node);
            else roots.push(node); // nodo orfano: trattato come radice
        }
    }

    // Post-order rollup ricorsivo
    function rollup(node) {
        let r = { ...node.burn };
        for (const child of node.children) {
            const cb = rollup(child);
            r.ore_tot          += cb.ore_tot;
            r.costo_manodopera += cb.costo_manodopera;
            r.costo_materiali  += cb.costo_materiali;
            r.totale           += cb.totale;
        }
        node.burn = {
            ore_tot:          Math.round(r.ore_tot          * 100) / 100,
            costo_manodopera: Math.round(r.costo_manodopera * 100) / 100,
            costo_materiali:  Math.round(r.costo_materiali  * 100) / 100,
            totale:           Math.round(r.totale           * 100) / 100,
        };
        if (node.budget_preventivato && node.budget_preventivato > 0) {
            node.avanzamento_pct = Math.min(
                100,
                Math.round((node.burn.totale / node.budget_preventivato) * 1000) / 10
            );
        }
        return node.burn;
    }

    for (const root of roots) rollup(root);
    return roots;
}

// ─── Depth Validation ─────────────────────────────────────────────────────────

/**
 * Regola di business: la WBS supporta max 3 livelli (root → fase → sottofase).
 * Verifica che il parent_id sia valido e che aggiungere un figlio non superi il limite.
 * @throws {DomainError} se il parent non appartiene al cantiere o la profondità è esaurita
 */
export async function validateNodeDepth(prisma, parentId, cantiereId) {
    if (parentId == null) return; // nodo radice, sempre valido

    const parent = await prisma.wbsNode.findFirst({
        where: { id: Number(parentId), cantiere_id: cantiereId },
    });
    if (!parent) {
        throw new DomainError('Nodo genitore non valido per questo cantiere.', 'INVALID_PARENT');
    }

    if (parent.parent_id !== null) {
        const grandParent = await prisma.wbsNode.findUnique({ where: { id: parent.parent_id } });
        if (grandParent?.parent_id !== null) {
            throw new DomainError("Profondità massima WBS raggiunta (max 3 livelli).", 'MAX_DEPTH_EXCEEDED');
        }
    }
}
