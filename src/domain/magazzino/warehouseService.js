/**
 * warehouseService — regole di business per i movimenti di magazzino.
 */
import { Prisma } from '@prisma/client';
import { DomainError } from '../shared/DomainError.js';
import { ValidationStatus } from '../../constants.js';
import { domainBus, EVENTS } from '../events/domainBus.js';

export async function processDischarge(prisma, payload, userId, employeeId) {
    const { articolo_id, quantita, ubicazione_da_id, cantiere_id, wbs_node_id, documento_id } = payload;

    if (!ubicazione_da_id || !cantiere_id) {
        throw new DomainError('Mancano ubicazione_da_id o cantiere_id.', 'MISSING_FIELDS');
    }
    const qty = new Prisma.Decimal(quantita);
    if (qty.lte(0)) throw new DomainError('La quantità deve essere > 0.', 'INVALID_QTY');

    const result = await prisma.$transaction(async (tx) => {
        const articolo = await tx.articolo.findUnique({ where: { id: articolo_id } });
        if (!articolo) throw new DomainError('Articolo non trovato.', 'NOT_FOUND');

        const giacenza = await tx.giacenza.findUnique({
            where: { articolo_id_ubicazione_id: { articolo_id, ubicazione_id: ubicazione_da_id } },
        });
        if (!giacenza || giacenza.quantita_disponibile.lessThan(qty)) {
            throw new DomainError('Giacenza insufficiente.', 'INSUFFICIENT_STOCK');
        }

        await tx.giacenza.update({
            where: { id: giacenza.id },
            data:  { quantita_disponibile: giacenza.quantita_disponibile.minus(qty) },
        });

        const costo        = articolo.costo_medio;
        const valoreTotale = costo.mul(qty);

        let targetWbsNodeId = wbs_node_id ?? null;
        if (!targetWbsNodeId) {
            const root = await tx.wbsNode.findFirst({ where: { cantiere_id, parent_id: null } });
            if (root) targetWbsNodeId = root.id;
        }

        const movimento = await tx.movimentoMagazzino.create({
            data: {
                tipo_movimento: 'SCARICO_CANTIERE',
                articolo_id, quantita: qty,
                ubicazione_da_id, cantiere_id,
                wbs_node_id:    targetWbsNodeId,
                costo_unitario: costo,
                valore_totale:  valoreTotale,
                esecutore_id:   userId,
                documento_id:   documento_id ?? null,
            },
        });

        // Regola di business: scarico genera Spesa VERIFIED per Job Costing
        const spesa = await tx.spesa.create({
            data: {
                employee_id:       employeeId,
                cantiere_id,
                wbs_node_id:       targetWbsNodeId,
                importo:           valoreTotale,
                descrizione:       `Scarico Magazzino: ${articolo.descrizione} (${articolo.codice_sku})`,
                quantita:          qty,
                fonte:             'MAGAZZINO',
                stato_validazione: ValidationStatus.VERIFIED,
            },
        });

        return { movimentoId: movimento.id, spesaId: spesa.id, wbsNodeId: targetWbsNodeId };
    });

    // Emetti DOPO il commit della transazione (mai dentro $transaction)
    domainBus.emit(EVENTS.WAREHOUSE_DISCHARGED, {
        cantiereId:  cantiere_id,
        wbsNodeId:   result.wbsNodeId,
        spesaId:     result.spesaId,
        movimentoId: result.movimentoId,
    });

    return result;
}

export async function processCarico(prisma, payload, userId) {
    const { articolo_id, quantita, ubicazione_a_id, costo_acquisto, documento_id, fornitore_id } = payload;

    if (!ubicazione_a_id || costo_acquisto === undefined) {
        throw new DomainError('Mancano ubicazione_a_id o costo_acquisto.', 'MISSING_FIELDS');
    }
    const qty = new Prisma.Decimal(quantita);
    if (qty.lte(0)) throw new DomainError('La quantità deve essere > 0.', 'INVALID_QTY');

    return prisma.$transaction(async (tx) => {
        const articolo = await tx.articolo.findUnique({ where: { id: articolo_id } });
        if (!articolo) throw new DomainError('Articolo non trovato.', 'NOT_FOUND');

        const costoAcq     = new Prisma.Decimal(costo_acquisto);
        const valoreTotale = costoAcq.mul(qty);

        await tx.giacenza.upsert({
            where:  { articolo_id_ubicazione_id: { articolo_id, ubicazione_id: ubicazione_a_id } },
            update: { quantita_disponibile: { increment: qty } },
            create: { articolo_id, ubicazione_id: ubicazione_a_id, quantita_disponibile: qty, quantita_riservata: 0 },
        });

        // Ricalcolo CMP globale
        const agg = await tx.giacenza.aggregate({
            where: { articolo_id },
            _sum:  { quantita_disponibile: true, quantita_riservata: true },
        });
        const qTot   = (agg._sum.quantita_disponibile ?? new Prisma.Decimal(0))
                        .add(agg._sum.quantita_riservata ?? new Prisma.Decimal(0));
        const qOld   = qTot.minus(qty);
        const cmpOld = articolo.costo_medio;
        const cmpNew = qTot.greaterThan(0)
            ? qOld.mul(cmpOld).add(qty.mul(costoAcq)).div(qTot)
            : cmpOld;

        await tx.articolo.update({ where: { id: articolo_id }, data: { costo_medio: cmpNew } });

        await tx.movimentoMagazzino.create({
            data: {
                tipo_movimento: 'CARICO',
                articolo_id, quantita: qty,
                ubicazione_a_id,
                costo_unitario: costoAcq,
                valore_totale:  valoreTotale,
                esecutore_id:   userId,
                documento_id:   documento_id ?? null,
                fornitore_id:   fornitore_id ?? null,
            },
        });
    });
}
