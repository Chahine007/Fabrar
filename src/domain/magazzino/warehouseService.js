/**
 * warehouseService — regole di business per i movimenti di magazzino.
 */
import { Prisma } from '@prisma/client';
import { DomainError } from '../shared/DomainError.js';
import { ValidationStatus } from '../../constants.js';
import { domainBus, EVENTS } from '../events/domainBus.js';

function emitWarehouseDischarged(eventPayload) {
    domainBus.emit(EVENTS.WAREHOUSE_DISCHARGED, eventPayload);
}

export async function createDischargeInTransaction(tx, payload, userId, employeeId, options = {}) {
    const { articolo_id, quantita, ubicazione_da_id, cantiere_id, wbs_node_id, task_id, documento_id } = payload;

    if (!ubicazione_da_id || !cantiere_id) {
        throw new DomainError('Mancano ubicazione_da_id o cantiere_id.', 'MISSING_FIELDS');
    }
    if (!employeeId) {
        throw new DomainError('Utente non collegato a un dipendente.', 'MISSING_EMPLOYEE');
    }

    const qty = new Prisma.Decimal(quantita);
    if (qty.lte(0)) throw new DomainError('La quantità deve essere > 0.', 'INVALID_QTY');

    const articolo = await tx.articolo.findUnique({ where: { id: articolo_id } });
    if (!articolo) throw new DomainError('Articolo non trovato.', 'NOT_FOUND');

    const giacenza = await tx.giacenza.findUnique({
        where: { articolo_id_ubicazione_id: { articolo_id, ubicazione_id: ubicazione_da_id } },
        select: { id: true },
    });
    if (!giacenza) {
        throw new DomainError('Giacenza insufficiente.', 'INSUFFICIENT_STOCK');
    }

    const updated = await tx.giacenza.updateMany({
        where: {
            id: giacenza.id,
            quantita_disponibile: { gte: qty },
        },
        data: {
            quantita_disponibile: { decrement: qty },
        },
    });
    if (updated.count !== 1) {
        throw new DomainError('Giacenza insufficiente.', 'INSUFFICIENT_STOCK');
    }

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
            task_id:        task_id ?? null,
            costo_unitario: costo,
            valore_totale:  valoreTotale,
            esecutore_id:   userId,
            documento_id:   documento_id ?? null,
        },
    });

    const descrizione = options.description
        ?? `Scarico Magazzino: ${articolo.descrizione} (${articolo.codice_sku})`;

    // Regola di business: scarico genera Spesa APPROVED per Job Costing
    const spesa = await tx.spesa.create({
        data: {
            employee_id:       employeeId,
            cantiere_id,
            wbs_node_id:       targetWbsNodeId,
            task_id:           task_id ?? null,
            importo:           valoreTotale,
            descrizione,
            quantita:          qty,
            fonte:             'MAGAZZINO',
            stato_validazione: ValidationStatus.APPROVED,
        },
    });

    const eventPayload = {
        cantiereId:  cantiere_id,
        wbsNodeId:   targetWbsNodeId,
        spesaId:     spesa.id,
        movimentoId: movimento.id,
    };

    return { movimento, spesa, wbsNodeId: targetWbsNodeId, eventPayload };
}

export async function processDischarge(prisma, payload, userId, employeeId) {
    const result = await prisma.$transaction(async (tx) => {
        const discharge = await createDischargeInTransaction(tx, payload, userId, employeeId);
        return {
            movimentoId: discharge.movimento.id,
            spesaId: discharge.spesa.id,
            wbsNodeId: discharge.wbsNodeId,
            eventPayload: discharge.eventPayload,
        };
    });

    // Emetti DOPO il commit della transazione (mai dentro $transaction)
    emitWarehouseDischarged(result.eventPayload);

    return {
        movimentoId: result.movimentoId,
        spesaId: result.spesaId,
        wbsNodeId: result.wbsNodeId,
    };
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
